import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { logModeration } from '../lib/moderationLog.js';

const router = express.Router();

// Superadmin (OWNER) only — history of approvals / rejections
router.get('/logs', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const logs = await prisma.moderationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        actor: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

// Pending questions (ADMIN-created awaiting approval)
router.get('/questions/pending', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const questions = await prisma.question.findMany({
      where: { approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// Pending student accounts
router.get('/users/pending', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'STUDENT', accountStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, accountStatus: true, createdAt: true },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Pending publish requests (exams where admin requested superadmin to publish)
router.get('/exams/pending-publish', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const exams = await prisma.exam.findMany({
      where: { publishRequested: true, resultsPublished: false },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { questions: true, assignments: true } },
      },
      orderBy: { publishRequestedAt: 'desc' },
    });
    res.json(exams);
  } catch (err) {
    next(err);
  }
});

router.post('/questions/:id/approve', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const q = await prisma.question.update({
      where: { id },
      data: { approvalStatus: 'APPROVED' },
    });
    await logModeration({
      actorId: req.user.sub,
      entityType: 'QUESTION',
      entityId: id,
      action: 'QUESTION_APPROVE',
      details: { title: q.title },
    });
    res.json(q);
  } catch (err) {
    next(err);
  }
});

router.post('/questions/:id/reject', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const q = await prisma.question.update({
      where: { id },
      data: { approvalStatus: 'REJECTED' },
    });
    await logModeration({
      actorId: req.user.sub,
      entityType: 'QUESTION',
      entityId: id,
      action: 'QUESTION_REJECT',
      details: { title: q.title, reason: reason || null },
    });
    res.json(q);
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/approve', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'ACTIVE' },
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });
    await logModeration({
      actorId: req.user.sub,
      entityType: 'USER',
      entityId: id,
      action: 'USER_APPROVE',
      details: { email: user.email },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/reject', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { accountStatus: 'REJECTED' },
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });
    await logModeration({
      actorId: req.user.sub,
      entityType: 'USER',
      entityId: id,
      action: 'USER_REJECT',
      details: { email: user.email, reason: reason || null },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
