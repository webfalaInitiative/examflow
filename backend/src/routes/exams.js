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
    } else if (role === 'ADMIN') {
      // ADMIN sees only exams they created
      exams = await prisma.exam.findMany({
        where: { createdBy: sub },
        include: {
          creator: {
            select: { name: true, email: true }
          },
          _count: {
            select: { questions: true, assignments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      // OWNER sees all exams. Include counts so frontend can show assigned numbers.
      exams = await prisma.exam.findMany({
        include: {
          creator: {
            select: { name: true, email: true }
          },
          _count: {
            select: { questions: true, assignments: true }
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

// Per-student combined score: MCQ (objective) + theory (scoreboard column and/or per-question grades)
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

        const nMcq = exam.questions.filter((eq) => eq.question.type === 'mcq').length;
        const nTheory = exam.questions.filter((eq) => eq.question.type === 'theory').length;
        const manual =
          a.manualTheoryPercent != null && !Number.isNaN(a.manualTheoryPercent)
            ? a.manualTheoryPercent
            : null;

        let mcqPoints = 0;
        let mcqGradedCount = 0;
        let theoryPoints = 0;
        let theoryGradedCount = 0;

        for (const eq of exam.questions) {
          const q = eq.question;
          const s = byQ.get(eq.questionId);
          if (q.type === 'mcq') {
            if (s && s.graded && s.score != null) {
              mcqPoints += s.score;
              mcqGradedCount += 1;
            }
          } else if (s && s.graded && s.score != null) {
            theoryPoints += s.score;
            theoryGradedCount += 1;
          }
        }

        const mcqPercent = nMcq > 0 ? (mcqPoints / nMcq) * 100 : null;

        let theoryPercent = null;
        if (nTheory > 0) {
          if (manual != null) {
            theoryPercent = manual;
          } else if (theoryGradedCount === nTheory) {
            theoryPercent = (theoryPoints / nTheory) * 100;
          }
        } else if (nMcq > 0 && manual != null) {
          theoryPercent = manual;
        }

        const mcqReady = nMcq === 0 || mcqGradedCount === nMcq;
        const theoryReady =
          nTheory === 0 ||
          manual != null ||
          theoryGradedCount === nTheory;

        const gradingComplete = mcqReady && theoryReady;

        let finalPercent = null;
        if (gradingComplete) {
          const mcqP = nMcq > 0 ? (mcqPoints / nMcq) * 100 : 0;
          let thP = 0;
          let theoryWeight = 0;
          if (nTheory > 0) {
            theoryWeight = nTheory;
            thP =
              manual != null
                ? manual
                : theoryGradedCount === nTheory
                  ? (theoryPoints / nTheory) * 100
                  : 0;
          } else if (nMcq > 0 && manual != null) {
            theoryWeight = 1;
            thP = manual;
          }
          const totalW = nMcq + theoryWeight;
          if (totalW > 0) {
            finalPercent = (mcqP * nMcq + thP * theoryWeight) / totalW;
          }
        }

        return {
          user: a.user,
          assignment: {
            examSubmittedAt: a.examSubmittedAt,
            manualTheoryPercent: a.manualTheoryPercent,
          },
          mcqPercent,
          theoryPercent,
          finalPercent,
          gradingComplete,
          answeredCount: subs.length,
          questionCount: n,
          nMcq,
          nTheory,
        };
      })
    );

    res.json({ exam: { id: exam.id, title: exam.title, resultsPublished: exam.resultsPublished }, rows });
  } catch (err) {
    next(err);
  }
});

// Set manual theory % for a student (0–100). Combined with MCQ objective on scoreboard. Send null to clear.
router.patch(
  '/:id/assignments/:userId/theory-score',
  verifyToken,
  requireRole('OWNER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const examId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      const raw = req.body.manualTheoryPercent;

      if (raw === null || raw === '') {
        const cleared = await prisma.examAssignment.update({
          where: { examId_userId: { examId, userId } },
          data: { manualTheoryPercent: null },
        });
        return res.json(cleared);
      }

      const val = parseFloat(raw);
      if (Number.isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: 'manualTheoryPercent must be between 0 and 100' });
      }

      const updated = await prisma.examAssignment.update({
        where: { examId_userId: { examId, userId } },
        data: { manualTheoryPercent: val },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

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

// Unpublish results — sets resultsPublished to false, resultsPublishedAt to null
router.post('/:id/unpublish-results', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        resultsPublished: false,
        resultsPublishedAt: null,
      },
    });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// Get student's own exam folder results (MCQ%, Theory%, Final score)
router.get('/my-results', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.sub;

    // Get all assignments for this student
    const assignments = await prisma.examAssignment.findMany({
      where: { userId },
      include: {
        exam: {
          include: {
            questions: {
              include: { question: { select: { id: true, type: true } } },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const results = await Promise.all(
      assignments.map(async (a) => {
        const exam = a.exam;
        const examId = exam.id;

        // Count questions
        const nMcq = exam.questions.filter((eq) => eq.question.type === 'mcq').length;
        const nTheory = exam.questions.filter((eq) => eq.question.type === 'theory').length;

        // If results are not published yet, return redacted/pending status
        if (!exam.resultsPublished) {
          return {
            examId,
            title: exam.title,
            description: exam.description,
            examSubmittedAt: a.examSubmittedAt,
            resultsPublished: false,
            mcqPercent: null,
            theoryPercent: null,
            finalPercent: null,
            status: a.examSubmittedAt ? 'Results pending' : 'Incomplete',
            nQuestions: exam.questions.length,
          };
        }

        // If published, calculate scores
        const subs = await prisma.submission.findMany({
          where: { userId, examId },
          include: { question: { select: { id: true, type: true } } },
        });

        const qIds = new Set(exam.questions.map((eq) => eq.questionId));
        const byQ = new Map(subs.filter((s) => qIds.has(s.questionId)).map((s) => [s.questionId, s]));

        const manual =
          a.manualTheoryPercent != null && !Number.isNaN(a.manualTheoryPercent)
            ? a.manualTheoryPercent
            : null;

        let mcqPoints = 0;
        let mcqGradedCount = 0;
        let theoryPoints = 0;
        let theoryGradedCount = 0;

        for (const eq of exam.questions) {
          const q = eq.question;
          const s = byQ.get(eq.questionId);
          if (q.type === 'mcq') {
            if (s && s.graded && s.score != null) {
              mcqPoints += s.score;
              mcqGradedCount += 1;
            }
          } else if (s && s.graded && s.score != null) {
            theoryPoints += s.score;
            theoryGradedCount += 1;
          }
        }

        const mcqPercent = nMcq > 0 ? (mcqPoints / nMcq) * 100 : null;

        let theoryPercent = null;
        if (nTheory > 0) {
          if (manual != null) {
            theoryPercent = manual;
          } else if (theoryGradedCount === nTheory) {
            theoryPercent = (theoryPoints / nTheory) * 100;
          }
        } else if (nMcq > 0 && manual != null) {
          theoryPercent = manual;
        }

        const mcqReady = nMcq === 0 || mcqGradedCount === nMcq;
        const theoryReady =
          nTheory === 0 ||
          manual != null ||
          theoryGradedCount === nTheory;

        const gradingComplete = mcqReady && theoryReady;

        let finalPercent = null;
        if (gradingComplete) {
          const mcqP = nMcq > 0 ? (mcqPoints / nMcq) * 100 : 0;
          let thP = 0;
          let theoryWeight = 0;
          if (nTheory > 0) {
            theoryWeight = nTheory;
            thP =
              manual != null
                ? manual
                : theoryGradedCount === nTheory
                  ? (theoryPoints / nTheory) * 100
                  : 0;
          } else if (nMcq > 0 && manual != null) {
            theoryWeight = 1;
            thP = manual;
          }
          const totalW = nMcq + theoryWeight;
          if (totalW > 0) {
            finalPercent = (mcqP * nMcq + thP * theoryWeight) / totalW;
          }
        }

        // Determine passed/failed status
        let status = 'Pending';
        if (a.examSubmittedAt) {
          if (gradingComplete && finalPercent != null) {
            status = finalPercent >= 50 ? 'Passed' : 'Failed';
          } else {
            status = 'Pending';
          }
        } else {
          status = 'Incomplete';
        }

        return {
          examId,
          title: exam.title,
          description: exam.description,
          examSubmittedAt: a.examSubmittedAt,
          resultsPublished: true,
          mcqPercent,
          theoryPercent,
          finalPercent,
          status,
          nQuestions: exam.questions.length,
        };
      })
    );

    res.json(results);
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
