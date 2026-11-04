import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { normalizeQuestionInput, normalizeStoredQuestion, toPrismaData } from '../lib/questionUtils.js';

const router = express.Router();

let columnChecked = false;
router.use(async (_req, _res, next) => {
  if (!columnChecked) {
    columnChecked = true;
    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "explanation" TEXT;');
    } catch {
      // Ignore if DB user lacks DDL privileges or column already exists
    }
  }
  next();
});

/**
 * Role-based question access:
 *   - OWNER (Super Admin): can view / edit / delete every question.
 *   - ADMIN: can only view / edit / delete questions they created (createdBy = their id).
 *   - STUDENT: no access to the question bank (they receive questions through exam folders).
 */
const isOwner = (req) => req.user?.role === 'OWNER';

/** Prisma where-clause that scopes question queries to what the current user may access. */
function questionScope(req) {
  return isOwner(req) ? {} : { createdBy: req.user.sub };
}

/** Loads a question and enforces ownership. Sends the error response and returns null if not allowed. */
async function loadManageableQuestion(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid question id' });
    return null;
  }
  const question = await prisma.question.findUnique({ where: { id } });
  // Respond 404 (not 403) for other admins' questions so their existence is not disclosed
  if (!question || (!isOwner(req) && question.createdBy !== req.user.sub)) {
    res.status(404).json({ error: 'Question not found' });
    return null;
  }
  return question;
}

/** Attach creator info (Question has no Prisma relation to User, so resolve manually). */
async function attachCreators(questions) {
  const ids = [...new Set(questions.map((q) => q.createdBy).filter((v) => v != null))];
  if (ids.length === 0) return questions.map((q) => ({ ...q, creator: null }));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return questions.map((q) => ({ ...q, creator: q.createdBy != null ? byId.get(q.createdBy) || null : null }));
}

// List questions — OWNER sees all; ADMIN sees only their own; STUDENT sees none
router.get('/', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT') {
      // Students should not see the general list of questions
      // They access questions via the /exams/:id route
      return res.json([]);
    }
    // Re-check the authoritative role from the database (role may have changed since token issue)
    const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    if (dbUser?.role) req.user.role = dbUser.role;
    if (req.user.role === 'STUDENT') return res.json([]);

    const questions = await prisma.question.findMany({
      where: questionScope(req),
      orderBy: { createdAt: 'desc' },
    });
    const normalized = questions.map(normalizeStoredQuestion);
    res.json(isOwner(req) ? await attachCreators(normalized) : normalized);
  } catch (err) {
    next(err);
  }
});

// Get single question
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role === 'STUDENT') {
      const question = await prisma.question.findUnique({
        where: { id: parseInt(req.params.id) },
      });
      if (!question) return res.status(404).json({ error: 'Not found' });
      // For students, hide correct answers and explanations
      question.correct = undefined;
      question.explanation = undefined;
      return res.json(question);
    }

    const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { role: true } });
    if (dbUser?.role) req.user.role = dbUser.role;

    const question = await loadManageableQuestion(req, res);
    if (!question) return;
    res.json(normalizeStoredQuestion(question));
  } catch (err) {
    next(err);
  }
});

// Create question (OWNER/ADMIN only)
router.post('/', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    let data;
    try {
      data = normalizeQuestionInput(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const approvalStatus = req.user.role === 'ADMIN' ? 'PENDING' : 'APPROVED';
    const question = await prisma.question.create({
      data: { ...toPrismaData(data), createdBy: req.user.sub, approvalStatus },
    });
    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});

// Bulk create questions from JSON / CSV import (OWNER/ADMIN only)
// Imported questions are normalized to exactly the same shape as manually created ones,
// so they can be edited with the same form afterwards.
router.post('/bulk', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    let { questions } = req.body;
    // Accept { questions: [...] } wrapped exports as well
    if (questions && !Array.isArray(questions) && Array.isArray(questions.questions)) {
      questions = questions.questions;
    }
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'questions must be an array' });
    }
    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions found to import' });
    }

    const approvalStatus = req.user.role === 'ADMIN' ? 'PENDING' : 'APPROVED';

    let dataToInsert;
    try {
      dataToInsert = questions.map((q, i) => ({
        ...toPrismaData(normalizeQuestionInput(q, { label: `Question #${i + 1}` })),
        createdBy: req.user.sub,
        approvalStatus,
      }));
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const created = await prisma.question.createMany({
      data: dataToInsert,
    });

    res.status(201).json({ ok: true, count: created.count });
  } catch (err) {
    next(err);
  }
});

// Update question (OWNER: any question; ADMIN: own questions only)
// ADMIN edits reset approval to PENDING for Superadmin review
router.put('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await loadManageableQuestion(req, res);
    if (!existing) return;

    let data;
    try {
      data = normalizeQuestionInput(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const approvalStatus = req.user.role === 'OWNER' ? 'APPROVED' : 'PENDING';
    const question = await prisma.question.update({
      where: { id: existing.id },
      data: { ...toPrismaData(data), approvalStatus },
    });
    res.json(question);
  } catch (err) {
    next(err);
  }
});

// Delete question (OWNER: any question; ADMIN: own questions only)
router.delete('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const existing = await loadManageableQuestion(req, res);
    if (!existing) return;
    await prisma.submission.deleteMany({ where: { questionId: existing.id } });
    await prisma.question.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
