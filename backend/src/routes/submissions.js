import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { sendMail } from '../lib/email.js';

const router = express.Router();

function redactSubmissionForStudent(sub) {
  if (!sub.examId || !sub.exam) return sub;
  if (sub.exam.resultsPublished) return sub;
  return {
    ...sub,
    score: null,
    graded: false,
    resultsPending: true,
    exam: { id: sub.exam.id, title: sub.exam.title, resultsPublished: false },
  };
}

async function notifyExamSubmittedIfComplete(userId, examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { questions: true },
  });
  if (!exam) return;

  const assignment = await prisma.examAssignment.findUnique({
    where: { examId_userId: { examId, userId } },
  });
  if (!assignment || assignment.examSubmittedAt) return;

  const n = exam.questions.length;
  if (n === 0) return;

  const count = await prisma.submission.count({ where: { userId, examId } });
  if (count < n) return;

  await prisma.examAssignment.update({
    where: { examId_userId: { examId, userId } },
    data: { examSubmittedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: `We received your exam — ${exam.title}`,
      text: `Hello${user.name ? ` ${user.name}` : ''},\n\nWe've received your answers for "${exam.title}".\n\nYour results will be reviewed (including any theory questions). You will receive an email when your results are published and available on your dashboard.\n\nYou can sign in here: ${appUrl}/login\n\nUntil results are published, detailed scores are hidden on your results page.`,
    });
  }
}

// Get stats (OWNER/ADMIN) — must be before /:id routes
router.get('/stats', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const [totalUsers, totalQuestions, totalSubmissions, gradedSubmissions] = await Promise.all([
      prisma.user.count(),
      prisma.question.count(),
      prisma.submission.count(),
      prisma.submission.count({ where: { graded: true } }),
    ]);
    const avgScore = await prisma.submission.aggregate({
      _avg: { score: true },
      where: { graded: true },
    });
    res.json({
      totalUsers,
      totalQuestions,
      totalSubmissions,
      gradedSubmissions,
      averageScore: avgScore._avg.score || 0,
    });
  } catch (err) {
    next(err);
  }
});

// List submissions — admins see all, students see only their own (scores hidden until exam published)
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const where = req.user.role === 'STUDENT' ? { userId: req.user.sub } : {};
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        question: { select: { id: true, title: true, type: true } },
        exam: { select: { id: true, title: true, resultsPublished: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (req.user.role === 'STUDENT') {
      res.json(submissions.map(redactSubmissionForStudent));
    } else {
      res.json(submissions);
    }
  } catch (err) {
    next(err);
  }
});

// Submit an answer (STUDENT only)
router.post('/', verifyToken, requireRole('STUDENT'), async (req, res, next) => {
  try {
    const { questionId, answer, examId } = req.body;
    if (!questionId || answer === undefined) {
      return res.status(400).json({ error: 'questionId and answer are required' });
    }

    const qId = parseInt(questionId);
    const eId = examId ? parseInt(examId) : null;

    const existing = await prisma.submission.findFirst({
      where: {
        userId: req.user.sub,
        questionId: qId,
        examId: eId,
      },
    });
    if (existing) return res.status(409).json({ error: 'Already submitted' });

    const question = await prisma.question.findUnique({
      where: { id: qId },
    });
    if (!question) return res.status(404).json({ error: 'Question not found' });
    if (eId) {
      const assigned = await prisma.examAssignment.findUnique({
        where: { examId_userId: { examId: eId, userId: req.user.sub } },
      });
      if (!assigned) return res.status(403).json({ error: 'Not assigned to this exam' });
    }
    if (eId && question.approvalStatus !== 'APPROVED') {
      return res.status(403).json({ error: 'This question is not available for exams' });
    }

    let score = null;
    let graded = false;

    if (question.type === 'mcq' && question.correct != null) {
      const correctAnswer = String(question.correct);
      const studentAnswer = String(answer);
      score = correctAnswer === studentAnswer ? 1.0 : 0.0;
      graded = true;
    }

    let submission = await prisma.submission.create({
      data: {
        userId: req.user.sub,
        questionId: qId,
        examId: eId,
        answer: typeof answer === 'object' ? answer : answer,
        score,
        graded,
      },
      include: {
        question: { select: { id: true, title: true, type: true } },
        exam: { select: { id: true, title: true, resultsPublished: true } },
      },
    });

    if (eId) {
      await notifyExamSubmittedIfComplete(req.user.sub, eId);
      const exam = await prisma.exam.findUnique({ where: { id: eId } });
      if (exam && !exam.resultsPublished) {
        submission = {
          ...submission,
          score: null,
          graded: false,
          resultsPending: true,
        };
      }
    }

    res.status(201).json(submission);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

// Grade a submission (OWNER/ADMIN only) — theory marks are 0–1 (same as MCQ); display ×100 in UI
router.patch('/:id/grade', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { score } = req.body;
    if (score === undefined || score < 0 || score > 1) {
      return res.status(400).json({ error: 'Score must be between 0 and 1' });
    }
    const submission = await prisma.submission.update({
      where: { id: parseInt(req.params.id) },
      data: { score: parseFloat(score), graded: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        question: { select: { id: true, title: true, type: true } },
        exam: { select: { id: true, title: true, resultsPublished: true } },
      },
    });
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

export default router;
