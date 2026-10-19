import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

router.post('/register', authLimiter, (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name || !['student', 'tutor'].includes(role)) {
    return res.status(400).json({ error: 'Name, email, password and a role (student or tutor) are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)')
    .run(normalized, hash, name.trim(), role);
  const userId = Number(result.lastInsertRowid);

  if (role === 'tutor') {
    db.prepare('INSERT INTO tutor_profiles (user_id) VALUES (?)').run(userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email || '').trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  res.json({ user: publicUser(user) });
});

export default router;
