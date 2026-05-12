import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List all questions
// Admins see all. Students see nothing here (they must use exams/folders)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT') {
      // Students should not see the general list of questions
      // They access questions via the /exams/:id route
      return res.json([]);
    }
    const questions = await prisma.question.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// Get single question
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!question) return res.status(404).json({ error: 'Not found' });
    // For students, hide correct answers
    if (req.user.role === 'STUDENT') {
      question.correct = undefined;
    }
    res.json(question);
  } catch (err) {
    next(err);
  }
});

// Create question (OWNER/ADMIN only)
router.post('/', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, type, body, options, correct } = req.body;
    if (!title || !type) return res.status(400).json({ error: 'Title and type are required' });
    if (!['mcq', 'theory'].includes(type)) return res.status(400).json({ error: 'Type must be mcq or theory' });
    if (type === 'mcq' && (!options || !correct)) {
      return res.status(400).json({ error: 'MCQ questions require options and correct answer' });
    }
    const approvalStatus = req.user.role === 'ADMIN' ? 'PENDING' : 'APPROVED';
    const question = await prisma.question.create({
      data: { title, type, body, options, correct, createdBy: req.user.sub, approvalStatus },
    });
    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});

// Update question (OWNER/ADMIN only) — ADMIN edits reset approval to PENDING for Superadmin review
router.put('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, type, body, options, correct } = req.body;
    const approvalStatus = req.user.role === 'OWNER' ? 'APPROVED' : 'PENDING';
    const question = await prisma.question.update({
      where: { id: parseInt(req.params.id) },
      data: { title, type, body, options, correct, approvalStatus },
    });
    res.json(question);
  } catch (err) {
    next(err);
  }
});

// Delete question (OWNER/ADMIN only)
router.delete('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.submission.deleteMany({ where: { questionId: id } });
    await prisma.question.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
