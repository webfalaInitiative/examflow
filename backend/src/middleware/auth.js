import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';

export function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token provided' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Token error' });
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return res.status(401).json({ error: 'Malformed token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...allowed) {
  return async (req, res, next) => {
    // Prefer authoritative role from database so role changes take effect immediately
    try {
      const userId = req.user?.sub;
      let role = req.user?.role;
      if (userId) {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (dbUser && dbUser.role) role = dbUser.role;
      }

      if (!role || !allowed.includes(role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    } catch (err) {
      next(err);
    }
  };
}
