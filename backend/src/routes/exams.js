import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { sendMail } from '../lib/email.js';

const router = express.Router();

// List exams
// Admins see all exams they created (or all if OWNER)
// Students only see exams assigned to them
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { role, sub } = req.user;
    let exams;

    if (role === 'STUDENT') {
      exams = await prisma.exam.findMany({
        where: {
          assignments: {
            some: {
              userId: sub
            }
          }
        },
        include: {
          creator: {
            select: { name: true, email: true }
          },
          _count: {
            select: { questions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // ADMIN/OWNER sees all or just theirs? 
      // For now, let's show all for ADMINs too, but filter by creator if needed.
      exams = await prisma.exam.findMany({
        include: {
          creator: {
            select: { name: true, email: true }
          },
          _count: {
            select: { questions: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    res.json(exams);
  } catch (err) {
    next(err);
  }
});

// Create exam (folder)
router.post('/', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, description, duration } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        duration: duration ? parseInt(duration) : null,
        createdBy: req.user.sub
      }
    });
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

// Per-student combined score (MCQ + theory) out of 100% when all items graded
router.get('/:id/scoreboard', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: { question: { select: { id: true, type: true, title: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        assignments: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const n = exam.questions.length;
    const qIds = new Set(exam.questions.map((eq) => eq.questionId));

    const rows = await Promise.all(
      exam.assignments.map(async (a) => {
        const subs = await prisma.submission.findMany({
          where: { userId: a.userId, examId },
          include: { question: { select: { id: true, type: true } } },
        });
        const byQ = new Map(subs.filter((s) => qIds.has(s.questionId)).map((s) => [s.questionId, s]));

        let mcqPoints = 0;
        let mcqTotal = 0;
        let theoryPoints = 0;
        let theoryTotal = 0;
        let allGraded = true;

        for (const eq of exam.questions) {
          const q = eq.question;
          const s = byQ.get(eq.questionId);
          if (q.type === 'mcq') {
            mcqTotal += 1;
            if (s && s.graded && s.score != null) mcqPoints += s.score;
            else allGraded = false;
          } else {
            theoryTotal += 1;
            if (s && s.graded && s.score != null) theoryPoints += s.score;
            else allGraded = false;
          }
        }

        const mcqPercent = mcqTotal > 0 ? (mcqPoints / mcqTotal) * 100 : null;
        const theoryPercent = theoryTotal > 0 ? (theoryPoints / theoryTotal) * 100 : null;
        const finalPercent = n > 0 && allGraded ? ((mcqPoints + theoryPoints) / n) * 100 : null;

        return {
          user: a.user,
          assignment: { examSubmittedAt: a.examSubmittedAt },
          mcqPercent,
          theoryPercent,
          finalPercent,
          gradingComplete: allGraded,
          answeredCount: subs.length,
          questionCount: n,
        };
      })
    );

    res.json({ exam: { id: exam.id, title: exam.title, resultsPublished: exam.resultsPublished }, rows });
  } catch (err) {
    next(err);
  }
});

// Publish results — students can then see scores; sends email to each assigned student
router.post('/:id/publish-results', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        resultsPublished: true,
        resultsPublishedAt: new Date(),
      },
      include: {
        assignments: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });

    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    for (const a of exam.assignments) {
      const email = a.user?.email;
      if (!email) continue;
      await sendMail({
        to: email,
        subject: `Your results are ready — ${exam.title}`,
        text: `Hello${a.user.name ? ` ${a.user.name}` : ''},\n\nYour results for "${exam.title}" have been published.\n\nPlease sign in to your dashboard to view your scores:\n${appUrl}/my-results\n\nThank you.`,
      });
    }

    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// Get single exam details
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { role, sub } = req.user;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          include: {
            question: true
          },
          orderBy: { sortOrder: 'asc' }
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        creator: {
          select: { name: true, email: true }
        }
      }
    });

    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    // Check if student is assigned to this exam
    if (role === 'STUDENT') {
      const isAssigned = await prisma.examAssignment.findUnique({
        where: {
          examId_userId: { examId, userId: sub }
        }
      });
      if (!isAssigned) return res.status(403).json({ error: 'You are not assigned to this exam' });

      // Only approved questions appear for students
      exam.questions = exam.questions.filter((eq) => eq.question?.approvalStatus === 'APPROVED');

      // Hide correct answers for students
      exam.questions = exam.questions.map((q) => {
        if (q.question) {
          q.question.correct = undefined;
        }
        return q;
      });
    }

    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// Update exam info
router.put('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { title, description, duration } = req.body;
    const exam = await prisma.exam.update({
      where: { id: parseInt(req.params.id) },
      data: { 
        title, 
        description,
        duration: duration ? parseInt(duration) : null
      }
    });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// Delete exam
router.delete('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    await prisma.exam.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Question Management in Exam ---

// Add questions to exam
router.post('/:id/questions', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { questionIds } = req.body; // Array of IDs

    if (!Array.isArray(questionIds)) return res.status(400).json({ error: 'questionIds must be an array' });

    // Create many ExamQuestion entries
    const operations = questionIds.map((qId, index) => {
      return prisma.examQuestion.upsert({
        where: {
          examId_questionId: { examId, questionId: qId }
        },
        update: {},
        create: {
          examId,
          questionId: qId,
          sortOrder: index
        }
      });
    });

    await Promise.all(operations);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Create new question and link to exam directly
router.post('/:id/questions/new', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { title, type, body, options, correct } = req.body;
    
    if (!title || !type) return res.status(400).json({ error: 'Title and type are required' });

    const approvalStatus = req.user.role === 'ADMIN' ? 'PENDING' : 'APPROVED';
    const question = await prisma.question.create({
      data: {
        title,
        type,
        body,
        options,
        correct,
        createdBy: req.user.sub,
        approvalStatus,
      },
    });

    await prisma.examQuestion.create({
      data: {
        examId,
        questionId: question.id,
        sortOrder: 0
      }
    });

    res.status(201).json(question);
  } catch (err) {
    next(err);
  }
});


// Remove question from exam
router.delete('/:id/questions/:questionId', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const questionId = parseInt(req.params.questionId);

    await prisma.examQuestion.delete({
      where: {
        examId_questionId: { examId, questionId }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Assignment Management ---

// Assign exam to users
router.post('/:id/assign', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { userIds } = req.body; // Array of student IDs

    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds must be an array' });

    const operations = userIds.map(uId => {
      return prisma.examAssignment.upsert({
        where: {
          examId_userId: { examId, userId: uId }
        },
        update: {},
        create: {
          examId,
          userId: uId
        }
      });
    });

    await Promise.all(operations);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Unassign exam from user
router.delete('/:id/assign/:userId', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    await prisma.examAssignment.delete({
      where: {
        examId_userId: { examId, userId }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
