import express from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prismaClient.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List all users (OWNER/ADMIN only)
router.get('/', verifyToken, requireRole('OWNER', 'ADMIN'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true, role: true, accountStatus: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true, role: true, accountStatus: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Update own profile (name, avatarUrl, matricNumber)
router.patch('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, avatarUrl, matricNumber } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (matricNumber !== undefined) data.matricNumber = matricNumber;

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data,
      select: { id: true, email: true, name: true, avatarUrl: true, matricNumber: true, role: true, accountStatus: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Update a user's role (OWNER only)
router.patch('/:id/role', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['ADMIN', 'STUDENT'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const data = { role };
    if (role === 'STUDENT') data.accountStatus = 'ACTIVE';

    const user = await prisma.user.update({
      where: { id: parseInt(req.params.id) },
      data,
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Delete a user (OWNER only)
router.delete('/:id', verifyToken, requireRole('OWNER'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.sub) return res.status(400).json({ error: 'Cannot delete yourself' });
    await prisma.submission.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
