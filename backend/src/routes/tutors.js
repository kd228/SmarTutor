import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

const TUTOR_SELECT = `
  SELECT u.id, u.name, p.headline, p.bio, p.subjects, p.hourly_rate_cents, p.location,
         COALESCE(ROUND(AVG(r.rating), 2), 0) AS avg_rating,
         COUNT(r.id) AS review_count
  FROM users u
  JOIN tutor_profiles p ON p.user_id = u.id
  LEFT JOIN reviews r ON r.tutor_id = u.id
`;

const shape = (row) => ({
  id: row.id,
  name: row.name,
  headline: row.headline,
  bio: row.bio,
  subjects: row.subjects ? row.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
  hourlyRateCents: row.hourly_rate_cents,
  location: row.location,
  avgRating: Number(row.avg_rating),
  reviewCount: Number(row.review_count),
});

// Browse / search tutors
router.get('/', (req, res) => {
  const { q, subject, maxRate, sort } = req.query;
  const where = ["p.hourly_rate_cents > 0", "p.headline != ''"];
  const params = [];

  if (subject) {
    where.push('LOWER(p.subjects) LIKE ?');
    params.push(`%${String(subject).toLowerCase()}%`);
  }
  if (q) {
    where.push('(LOWER(u.name) LIKE ? OR LOWER(p.headline) LIKE ? OR LOWER(p.subjects) LIKE ?)');
    const term = `%${String(q).toLowerCase()}%`;
    params.push(term, term, term);
  }
  if (maxRate && !Number.isNaN(Number(maxRate))) {
    where.push('p.hourly_rate_cents <= ?');
    params.push(Math.round(Number(maxRate) * 100));
  }

  const order =
    sort === 'price' ? 'p.hourly_rate_cents ASC' :
    sort === 'reviews' ? 'review_count DESC' :
    'avg_rating DESC, review_count DESC';

  const rows = db
    .prepare(`${TUTOR_SELECT} WHERE ${where.join(' AND ')} GROUP BY u.id ORDER BY ${order} LIMIT 60`)
    .all(...params);
  res.json({ tutors: rows.map(shape) });
});

// The signed-in tutor's own profile (declared before /:id so "me" isn't treated as an id)
router.get('/me/profile', requireAuth, requireRole('tutor'), (req, res) => {
  const row = db.prepare(`${TUTOR_SELECT} WHERE u.id = ? GROUP BY u.id`).get(req.user.id);
  res.json({ tutor: shape(row) });
});

router.put('/me/profile', requireAuth, requireRole('tutor'), (req, res) => {
  const { headline = '', bio = '', subjects = [], hourlyRate, location = '' } = req.body || {};
  const rate = Number(hourlyRate);
  if (!Number.isFinite(rate) || rate < 5 || rate > 500) {
    return res.status(400).json({ error: 'Hourly rate must be between $5 and $500' });
  }
  if (String(headline).trim().length < 5) {
    return res.status(400).json({ error: 'Add a headline of at least 5 characters' });
  }
  const subjectList = (Array.isArray(subjects) ? subjects : String(subjects).split(','))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 12);

  db.prepare(
    `UPDATE tutor_profiles
     SET headline = ?, bio = ?, subjects = ?, hourly_rate_cents = ?, location = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(
    String(headline).trim().slice(0, 120),
    String(bio).trim().slice(0, 4000),
    subjectList.join(','),
    Math.round(rate * 100),
    String(location).trim().slice(0, 120),
    req.user.id
  );

  const row = db.prepare(`${TUTOR_SELECT} WHERE u.id = ? GROUP BY u.id`).get(req.user.id);
  res.json({ tutor: shape(row) });
});

// Public tutor profile with reviews
router.get('/:id', (req, res) => {
  const row = db.prepare(`${TUTOR_SELECT} WHERE u.id = ? GROUP BY u.id`).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Tutor not found' });

  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, s.name AS studentName
       FROM reviews r JOIN users s ON s.id = r.student_id
       WHERE r.tutor_id = ? ORDER BY r.created_at DESC LIMIT 50`
    )
    .all(row.id);

  res.json({ tutor: shape(row), reviews });
});

export default router;
