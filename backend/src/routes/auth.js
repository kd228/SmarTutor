import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { one, transaction } from '../db.js';
import { assertAuthConfigured, signToken, requireAuth } from '../auth.js';
import { wrap } from '../util.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

router.post('/register', authLimiter, wrap(async (req, res) => {
  assertAuthConfigured();
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name || !['student', 'tutor'].includes(role)) {
    return res.status(400).json({ error: 'Name, email, password and a role (student or tutor) are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  const pw = String(password);
  const displayName = String(name).trim();

  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 200) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (pw.length < 8 || pw.length > 128) {
    return res.status(400).json({ error: 'Password must be 8 to 128 characters' });
  }
  if (!displayName || displayName.length > 100) {
    return res.status(400).json({ error: 'Enter your name (up to 100 characters)' });
  }

  const hash = await bcrypt.hash(pw, 10);
  try {
    const user = await transaction(async (tx) => {
      const created = await tx.one(
        'insert into users (email, password_hash, name, role) values ($1, $2, $3, $4) returning id, email, name, role',
        [normalized, hash, displayName, role]
      );
      if (role === 'tutor') await tx.query('insert into tutor_profiles (user_id) values ($1)', [created.id]);
      return created;
    });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with that email already exists' });
    throw err;
  }
}));

router.post('/login', authLimiter, wrap(async (req, res) => {
  assertAuthConfigured();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await one('select id, email, name, role, password_hash from users where email = $1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await one('select id, email, name, role from users where id = $1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(user) });
}));

export default router;
