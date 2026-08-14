import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';

const router = express.Router();

// Register — new students require Superadmin (OWNER) approval before full access
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);

    // Never allow public registration as ADMIN/OWNER
    const resolvedRole = role === 'ADMIN' || role === 'OWNER' ? 'STUDENT' : role || 'STUDENT';
    const accountStatus = resolvedRole === 'STUDENT' ? 'PENDING' : 'ACTIVE';

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        role: resolvedRole,
        accountStatus,
      },
      select: { id: true, email: true, name: true, role: true, accountStatus: true },
    });
    res.status(201).json({ ok: true, user });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.role === 'STUDENT' && user.accountStatus === 'PENDING') {
      return res.status(403).json({
        error: 'Your account is pending approval by an administrator. You will be able to sign in once approved.',
      });
    }
    if (user.role === 'STUDENT' && user.accountStatus === 'REJECTED') {
      return res.status(403).json({ error: 'Your registration was not approved. Please contact support.' });
    }

    const payload = { sub: user.id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'changeme', { expiresIn: '8h' });
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        matricNumber: user.matricNumber,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
