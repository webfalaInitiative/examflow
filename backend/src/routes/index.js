import express from 'express';
import authRouter from './auth.js';
import usersRouter from './users.js';
import questionsRouter from './questions.js';
import submissionsRouter from './submissions.js';
import examsRouter from './exams.js';
import moderationRouter from './moderation.js';

const router = express.Router();

router.get('/ping', (req, res) => res.json({ pong: true }));

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/questions', questionsRouter);
router.use('/submissions', submissionsRouter);
router.use('/exams', examsRouter);
router.use('/moderation', moderationRouter);

export default router;
