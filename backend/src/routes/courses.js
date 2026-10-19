import { Router } from 'express';
import { one, query } from '../db.js';
import { optionalAuth, requireAuth, requireRole } from '../auth.js';
import { likeTerm, parseId, wrap } from '../util.js';
import { COURSE_SELECT, courseShape } from '../shapes.js';

const router = Router();

function parseCourse(body = {}) {
  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const totalSessions = Number(body.totalSessions);
  const sessionsPerWeek = Number(body.sessionsPerWeek ?? 1);
  const sessionMinutes = Number(body.sessionMinutes);
  const price = Number(body.price);

  if (title.length < 5 || title.length > 120) return { error: 'Give the course a title of 5 to 120 characters' };
  if (!Number.isInteger(totalSessions) || totalSessions < 2 || totalSessions > 52) {
    return { error: 'A course needs 2 to 52 sessions' };
  }
  if (![1, 2, 3].includes(sessionsPerWeek)) return { error: 'Choose 1, 2 or 3 sessions per week' };
  if (!Number.isInteger(sessionMinutes) || sessionMinutes < 30 || sessionMinutes > 180 || sessionMinutes % 15 !== 0) {
    return { error: 'Sessions must be 30 to 180 minutes, in 15-minute steps' };
  }
  if (!Number.isFinite(price) || price < 10 || price > 20000) {
    return { error: 'Price must be between $10 and $20,000' };
  }
  return {
    value: {
      title,
      description: description.slice(0, 4000),
      subject: subject.slice(0, 60),
      totalSessions,
      sessionsPerWeek,
      sessionMinutes,
      priceCents: Math.round(price * 100),
    },
  };
}

// Browse active courses
router.get('/', wrap(async (req, res) => {
  const { q, subject, maxPrice, sort } = req.query;
  const where = ["c.status = 'active'"];
  const params = [];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  if (subject) where.push(`lower(c.subject) like ${add(likeTerm(subject))}`);
  if (q) {
    const term = add(likeTerm(q));
    where.push(`(lower(c.title) like ${term} or lower(c.subject) like ${term} or lower(u.name) like ${term})`);
  }
  if (maxPrice && Number.isFinite(Number(maxPrice))) {
    where.push(`c.price_cents <= ${add(Math.min(Math.round(Number(maxPrice) * 100), 1_000_000_000))}`);
  }

  const order =
    sort === 'price' ? 'c.price_cents asc' :
    sort === 'length' ? 'c.total_sessions desc' :
    'coalesce(rt.avg_rating, 0) desc, c.created_at desc';

  const rows = await query(`${COURSE_SELECT} where ${where.join(' and ')} order by ${order} limit 60`, params);
  res.json({ courses: rows.map(courseShape) });
}));

// All of the signed-in tutor's courses, including archived ones
router.get('/mine', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const rows = await query(`${COURSE_SELECT} where c.tutor_id = $1 order by c.created_at desc`, [req.user.id]);
  res.json({ courses: rows.map(courseShape) });
}));

router.get('/:id', optionalAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const row = id && (await one(`${COURSE_SELECT} where c.id = $1`, [id]));
  // Archived courses stay visible to their own tutor only.
  if (!row || (row.status !== 'active' && req.user?.id !== row.tutor_id)) {
    return res.status(404).json({ error: 'Course not found' });
  }
  res.json({ course: courseShape(row) });
}));

router.post('/', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const { value, error } = parseCourse(req.body);
  if (error) return res.status(400).json({ error });
  const created = await one(
    `insert into courses (tutor_id, title, description, subject, total_sessions, sessions_per_week, session_minutes, price_cents)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [req.user.id, value.title, value.description, value.subject, value.totalSessions,
     value.sessionsPerWeek, value.sessionMinutes, value.priceCents]
  );
  const row = await one(`${COURSE_SELECT} where c.id = $1`, [created.id]);
  res.status(201).json({ course: courseShape(row) });
}));

router.put('/:id', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { value, error } = parseCourse(req.body);
  if (error) return res.status(400).json({ error });
  const updated = id && (await one(
    `update courses
     set title = $1, description = $2, subject = $3, total_sessions = $4, sessions_per_week = $5,
         session_minutes = $6, price_cents = $7, updated_at = now()
     where id = $8 and tutor_id = $9 returning id`,
    [value.title, value.description, value.subject, value.totalSessions, value.sessionsPerWeek,
     value.sessionMinutes, value.priceCents, id, req.user.id]
  ));
  if (!updated) return res.status(404).json({ error: 'Course not found' });
  const row = await one(`${COURSE_SELECT} where c.id = $1`, [id]);
  res.json({ course: courseShape(row) });
}));

// Archiving hides a course from search; students already enrolled keep their sessions.
for (const [action, status] of [['archive', 'archived'], ['restore', 'active']]) {
  router.post(`/:id/${action}`, requireAuth, requireRole('tutor'), wrap(async (req, res) => {
    const id = parseId(req.params.id);
    const updated = id && (await one(
      'update courses set status = $1, updated_at = now() where id = $2 and tutor_id = $3 returning id',
      [status, id, req.user.id]
    ));
    if (!updated) return res.status(404).json({ error: 'Course not found' });
    res.json({ ok: true });
  }));
}

export default router;
