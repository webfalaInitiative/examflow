import express from 'express';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { sendMail } from '../lib/email.js';
import { logModeration } from '../lib/moderationLog.js';

const router = express.Router();

function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

function shuffleArrayWithSeed(array, seed) {
  const arr = [...array];
  let currentSeed = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(currentSeed++) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
    const { title, description, duration, subject, category, maxScale } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        subject: subject || null,
        category: category || 'TEST',
        maxScale: maxScale != null ? parseFloat(maxScale) : 100,
        duration: duration ? parseInt(duration) : null,
        createdBy: req.user.sub
      }
    });
    res.status(201).json(exam);
  } catch (err) {
    next(err);
  }
});

// Update exam folder settings (title, description, duration, subject, category, maxScale)
router.patch('/:id', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { title, description, duration, subject, category, maxScale } = req.body;

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (duration !== undefined) data.duration = duration ? parseInt(duration) : null;
    if (subject !== undefined) data.subject = subject || null;
    if (category !== undefined) data.category = category;
    if (maxScale !== undefined) data.maxScale = parseFloat(maxScale);

    const exam = await prisma.exam.update({
      where: { id: examId },
      data,
    });
    res.json(exam);
  } catch (err) {
    next(err);
  }
});

async function getExamScoreboardData(examId) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        include: { question: { select: { id: true, type: true, title: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      assignments: {
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true } } },
      },
    },
  });
  if (!exam) return null;

  // Gather unique users: from explicit assignments or submissions for this exam folder
  const userMap = new Map();

  for (const a of exam.assignments) {
    if (a.user) {
      userMap.set(a.user.id, {
        user: a.user,
        assignment: a,
      });
    }
  }

  const subUsers = await prisma.submission.findMany({
    where: { examId },
    select: {
      user: { select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true } },
    },
    distinct: ['userId'],
  });

  for (const s of subUsers) {
    if (s.user && !userMap.has(s.user.id)) {
      userMap.set(s.user.id, {
        user: s.user,
        assignment: null,
      });
    }
  }

  const n = exam.questions.length;
  const qIds = new Set(exam.questions.map((eq) => eq.questionId));

  const rows = await Promise.all(
    Array.from(userMap.values()).map(async ({ user, assignment }) => {
      const subs = await prisma.submission.findMany({
        where: { userId: user.id, examId },
        include: { question: { select: { id: true, type: true } } },
      });
      const byQ = new Map(subs.filter((s) => qIds.has(s.questionId)).map((s) => [s.questionId, s]));

      const nMcq = exam.questions.filter((eq) => eq.question.type === 'mcq').length;
      const nTheory = exam.questions.filter((eq) => eq.question.type === 'theory').length;
      const manual =
        assignment && assignment.manualTheoryPercent != null && !Number.isNaN(assignment.manualTheoryPercent)
          ? assignment.manualTheoryPercent
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
        const mcqP = nMcq > 0 ? (mcqPoints / nMcq) * 100 : null;
        const thP = manual != null ? manual : nTheory > 0 && theoryGradedCount === nTheory ? (theoryPoints / nTheory) * 100 : null;

        if (mcqP != null && thP != null) {
          finalPercent = (mcqP + thP) / 2;
        } else if (mcqP != null) {
          finalPercent = mcqP;
        } else if (thP != null) {
          finalPercent = thP;
        }
      }

      const scaledScore = finalPercent != null ? Math.round(((finalPercent / 100) * (exam.maxScale || 100)) * 10) / 10 : null;

      return {
        user,
        assignment: {
          examSubmittedAt: assignment ? assignment.examSubmittedAt : null,
          manualTheoryPercent: assignment ? assignment.manualTheoryPercent : null,
        },
        mcqPercent,
        theoryPercent,
        finalPercent,
        scaledScore,
        maxScale: exam.maxScale || 100,
        category: exam.category || 'TEST',
        subject: exam.subject || null,
        gradingComplete,
        answeredCount: subs.length,
        questionCount: n,
        nMcq,
        nTheory,
      };
    })
  );

  return { exam, rows };
}

// Combine / Merge results across multiple exam folders (e.g. Midterm 30% + Final Exam 70%)
router.post('/combine-results', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const { items } = req.body; // Array of { examId: number, weight: number }
    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'At least 2 exam items with examId and weight are required' });
    }

    // Filter out duplicate exam IDs to prevent double-counting
    const seenExamIds = new Set();
    const cleanItems = [];
    for (const item of items) {
      const examId = parseInt(item.examId);
      const weight = parseFloat(item.weight) || 0;
      if (Number.isNaN(examId) || weight <= 0) continue;
      if (seenExamIds.has(examId)) continue;
      seenExamIds.add(examId);
      cleanItems.push({ examId, weight });
    }

    if (cleanItems.length < 2) {
      return res.status(400).json({ error: 'Please select at least 2 distinct exam folders.' });
    }

    const folderDetails = [];
    const studentMap = new Map(); // userId -> { user, folderScores: {}, hasParticipated: boolean }

    for (const item of cleanItems) {
      const { examId, weight } = item;
      const data = await getExamScoreboardData(examId);
      if (!data) continue;

      folderDetails.push({
        id: data.exam.id,
        title: data.exam.title,
        weight,
      });

      for (const row of data.rows) {
        const uId = row.user.id;
        if (!studentMap.has(uId)) {
          studentMap.set(uId, {
            user: row.user,
            folderScores: {},
            hasParticipated: false,
          });
        }

        const studentData = studentMap.get(uId);
        const scorePercent = row.finalPercent;
        const weightedScore = scorePercent != null ? (scorePercent * weight) / 100 : null;

        if (row.answeredCount > 0 || row.gradingComplete || row.finalPercent != null || row.assignment?.examSubmittedAt != null) {
          studentData.hasParticipated = true;
        }

        studentData.folderScores[examId] = {
          examTitle: data.exam.title,
          percent: scorePercent,
          weight,
          weightedScore,
          gradingComplete: row.gradingComplete,
        };
      }
    }

    // Only include students who have participated (assigned or answered) in AT LEAST ONE selected folder
    const activeStudents = Array.from(studentMap.values()).filter((s) => s.hasParticipated);

    const combinedRows = activeStudents.map((student) => {
      let totalCombined = 0;
      let hasAnyScore = false;
      let hasAllScores = true;

      for (const f of folderDetails) {
        const fs = student.folderScores[f.id];
        if (fs && fs.weightedScore != null) {
          totalCombined += fs.weightedScore;
          hasAnyScore = true;
        } else {
          hasAllScores = false;
        }
      }

      let gradeLetter = '—';
      const finalVal = hasAnyScore ? Math.round(totalCombined * 10) / 10 : null;
      if (finalVal != null) {
        if (finalVal >= 70) gradeLetter = 'A';
        else if (finalVal >= 60) gradeLetter = 'B';
        else if (finalVal >= 50) gradeLetter = 'C';
        else if (finalVal >= 40) gradeLetter = 'D';
        else if (finalVal >= 30) gradeLetter = 'E';
        else gradeLetter = 'F';
      }

      let status = 'Incomplete';
      if (hasAllScores && finalVal != null) {
        status = finalVal >= 40 ? 'Passed' : 'Failed';
      } else if (hasAnyScore) {
        status = 'In Progress';
      }

      return {
        user: student.user,
        folderScores: student.folderScores,
        totalCombined: finalVal,
        hasAllScores,
        status,
        gradeLetter: finalVal != null ? gradeLetter : '—',
      };
    });

    res.json({
      folders: folderDetails,
      rows: combinedRows,
    });
  } catch (err) {
    next(err);
  }
});

// Publish a Combined Result Report (OWNER only)
router.post('/combine-results/publish', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { title, description, items } = req.body;
    if (!title || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'Title and at least 2 exam items are required' });
    }

    const report = await prisma.combinedResultReport.create({
      data: {
        title,
        description: description || null,
        items,
        published: true,
        publishedAt: new Date(),
        createdBy: req.user.sub,
      },
    });

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

// Get all published combined result reports
router.get('/combine-results/published', verifyToken, async (req, res, next) => {
  try {
    const reports = await prisma.combinedResultReport.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { name: true, email: true } } },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// Delete / Unpublish a Combined Result Report (OWNER only)
router.delete('/combine-results/published/:id', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.combinedResultReport.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get logged-in student's combined score for published reports
router.get('/combine-results/my-summary', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const reports = await prisma.combinedResultReport.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    });

    const userObj = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true },
    });

    const results = [];
    for (const rep of reports) {
      const items = rep.items;
      if (!Array.isArray(items)) continue;

      let totalCombined = 0;
      let hasAnyScore = false;
      let hasAllScores = true;
      const folderBreakdown = [];

      for (const item of items) {
        const examId = parseInt(item.examId);
        const weight = parseFloat(item.weight) || 0;
        if (Number.isNaN(examId)) continue;

        const data = await getExamScoreboardData(examId);
        if (!data) continue;

        const studentRow = data.rows.find((r) => r.user.id === userId);
        const scorePercent = studentRow ? studentRow.finalPercent : null;
        const weightedScore = scorePercent != null ? (scorePercent * weight) / 100 : null;

        if (scorePercent != null) {
          totalCombined += weightedScore;
          hasAnyScore = true;
        } else {
          hasAllScores = false;
        }

        folderBreakdown.push({
          examId,
          examTitle: data.exam.title,
          weight,
          scorePercent,
          weightedScore,
          gradingComplete: studentRow ? studentRow.gradingComplete : false,
        });
      }

      let gradeLetter = '—';
      const finalVal = hasAnyScore ? Math.round(totalCombined * 10) / 10 : null;
      if (finalVal != null) {
        if (finalVal >= 70) gradeLetter = 'A';
        else if (finalVal >= 60) gradeLetter = 'B';
        else if (finalVal >= 50) gradeLetter = 'C';
        else if (finalVal >= 40) gradeLetter = 'D';
        else if (finalVal >= 30) gradeLetter = 'E';
        else gradeLetter = 'F';
      }

      let status = 'Incomplete';
      if (hasAllScores && finalVal != null) {
        status = finalVal >= 40 ? 'Passed' : 'Failed';
      } else if (hasAnyScore) {
        status = 'In Progress';
      }

      results.push({
        id: rep.id,
        title: rep.title,
        description: rep.description,
        publishedAt: rep.publishedAt,
        student: userObj,
        folderBreakdown,
        totalCombined: finalVal,
        hasAllScores,
        status,
        gradeLetter: finalVal != null ? gradeLetter : '—',
      });
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Per-student combined score: MCQ (objective) + theory (scoreboard column and/or per-question grades)
router.get('/:id/scoreboard', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const data = await getExamScoreboardData(examId);
    if (!data) return res.status(404).json({ error: 'Exam not found' });

    res.json({
      exam: {
        id: data.exam.id,
        title: data.exam.title,
        resultsPublished: data.exam.resultsPublished,
        publishRequested: data.exam.publishRequested,
        publishRequestedAt: data.exam.publishRequestedAt,
        publishRequestedBy: data.exam.publishRequestedBy,
      },
      rows: data.rows,
    });
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

// Request publish results — ADMIN requests Superadmin (OWNER) to publish exam results
router.post('/:id/request-publish', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        publishRequested: true,
        publishRequestedAt: new Date(),
        publishRequestedBy: req.user.sub,
      },
    });

    const requester = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { name: true, email: true },
    });
    const requesterName = requester?.name || requester?.email || 'An admin';

    const owners = await prisma.user.findMany({
      where: { role: 'OWNER' },
      select: { email: true },
    });

    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    for (const owner of owners) {
      if (!owner.email) continue;
      await sendMail({
        to: owner.email,
        subject: `Publish Request: "${exam.title}"`,
        text: `Hello Superadmin,\n\n${requesterName} has requested that you publish results for the exam "${exam.title}".\n\nPlease log in to review and publish the results:\n${appUrl}/exams/${exam.id}/grading\n\nThank you.`,
      });
    }

    res.json(exam);
  } catch (err) {
    next(err);
  }
});

// Publish results — Superadmin (OWNER) only; students can then see scores; sends email to each assigned student
router.post('/:id/publish-results', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        resultsPublished: true,
        resultsPublishedAt: new Date(),
        publishRequested: false,
      },
      include: {
        assignments: { include: { user: { select: { id: true, email: true, name: true } } } },
      },
    });

    await logModeration({
      actorId: req.user.sub,
      entityType: 'EXAM',
      entityId: examId,
      action: 'EXAM_PUBLISH_RESULTS',
      details: { title: exam.title },
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

// Unpublish results — Superadmin (OWNER) only; sets resultsPublished to false, resultsPublishedAt to null
router.post('/:id/unpublish-results', verifyToken, requireRole('OWNER'), async (req, res, next) => {
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
          const mcqP = nMcq > 0 ? (mcqPoints / nMcq) * 100 : null;
          const thP = manual != null ? manual : nTheory > 0 && theoryGradedCount === nTheory ? (theoryPoints / nTheory) * 100 : null;

          if (mcqP != null && thP != null) {
            finalPercent = (mcqP + thP) / 2;
          } else if (mcqP != null) {
            finalPercent = mcqP;
          } else if (thP != null) {
            finalPercent = thP;
          }
        }

        // Determine passed/failed status
        let status = 'Pending';
        if (a.examSubmittedAt) {
          if (gradingComplete && finalPercent != null) {
            status = finalPercent >= 40 ? 'Passed' : 'Failed';
          } else {
            status = 'Pending';
          }
        } else {
          status = 'Incomplete';
        }

        const maxScale = exam.maxScale || 100;
        const category = exam.category || 'TEST';
        const subject = exam.subject || null;
        const scaledScore = finalPercent != null ? Math.round(((finalPercent / 100) * maxScale) * 10) / 10 : null;

        return {
          examId,
          title: exam.title,
          description: exam.description,
          subject,
          category,
          maxScale,
          examSubmittedAt: a.examSubmittedAt,
          resultsPublished: true,
          mcqPercent,
          theoryPercent,
          finalPercent,
          scaledScore,
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

      // Deterministically shuffle questions per student using seed (userId + examId)
      const seed = sub * 10007 + examId * 997;
      exam.questions = shuffleArrayWithSeed(exam.questions, seed);
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

// Add/update questions in exam
router.post('/:id/questions', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id);
    const { questionIds } = req.body; // Array of IDs

    if (!Array.isArray(questionIds)) return res.status(400).json({ error: 'questionIds must be an array' });

    // Delete any exam questions that are no longer selected
    await prisma.examQuestion.deleteMany({
      where: {
        examId,
        questionId: { notIn: questionIds },
      },
    });

    // Upsert remaining selected questions
    const operations = questionIds.map((qId, index) => {
      return prisma.examQuestion.upsert({
        where: {
          examId_questionId: { examId, questionId: qId }
        },
        update: { sortOrder: index },
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

    // Delete any assignments that are no longer selected
    await prisma.examAssignment.deleteMany({
      where: {
        examId,
        userId: { notIn: userIds },
      },
    });

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
