import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { likeTerm, parseId, wrap } from '../util.js';
import { COURSE_SELECT, courseShape } from '../shapes.js';

const router = Router();

const TUTOR_SELECT = `
  select u.id, u.name, p.headline, p.bio, p.subjects, p.hourly_rate_cents, p.location,
         coalesce(round(avg(r.rating)::numeric, 2), 0)::float8 as avg_rating,
         count(r.id)::int as review_count
  from users u
  join tutor_profiles p on p.user_id = u.id
  left join reviews r on r.tutor_id = u.id
`;
const GROUP_BY = 'group by u.id, p.user_id';

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
router.get('/', wrap(async (req, res) => {
  const { q, subject, maxRate, sort } = req.query;
  const where = ['p.hourly_rate_cents > 0', "p.headline <> ''"];
  const params = [];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  if (subject) where.push(`lower(p.subjects) like ${add(likeTerm(subject))}`);
  if (q) {
    const term = add(likeTerm(q));
    where.push(`(lower(u.name) like ${term} or lower(p.headline) like ${term} or lower(p.subjects) like ${term})`);
  }
  if (maxRate && Number.isFinite(Number(maxRate))) {
    where.push(`p.hourly_rate_cents <= ${add(Math.min(Math.round(Number(maxRate) * 100), 1_000_000_000))}`);
  }

  const order =
    sort === 'price' ? 'p.hourly_rate_cents asc' :
    sort === 'reviews' ? 'review_count desc, avg_rating desc' :
    'avg_rating desc, review_count desc';

  const rows = await query(
    `${TUTOR_SELECT} where ${where.join(' and ')} ${GROUP_BY} order by ${order} limit 60`,
    params
  );
  res.json({ tutors: rows.map(shape) });
}));

// The signed-in tutor's own profile (declared before /:id so "me" isn't treated as an id)
router.get('/me/profile', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const row = await one(`${TUTOR_SELECT} where u.id = $1 ${GROUP_BY}`, [req.user.id]);
  if (!row) return res.status(404).json({ error: 'Profile not found' });
  res.json({ tutor: shape(row) });
}));

router.put('/me/profile', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
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

  await query(
    `update tutor_profiles
     set headline = $1, bio = $2, subjects = $3, hourly_rate_cents = $4, location = $5, updated_at = now()
     where user_id = $6`,
    [
      String(headline).trim().slice(0, 120),
      String(bio).trim().slice(0, 4000),
      subjectList.join(','),
      Math.round(rate * 100),
      String(location).trim().slice(0, 120),
      req.user.id,
    ]
  );

  const row = await one(`${TUTOR_SELECT} where u.id = $1 ${GROUP_BY}`, [req.user.id]);
  res.json({ tutor: shape(row) });
}));

// Public tutor profile with reviews and active courses
router.get('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const row = id && (await one(`${TUTOR_SELECT} where u.id = $1 ${GROUP_BY}`, [id]));
  if (!row) return res.status(404).json({ error: 'Tutor not found' });

  const reviews = await query(
    `select r.id, r.rating, r.comment, r.created_at as "createdAt",
            s.name as "studentName", c.title as "courseTitle"
     from reviews r
     join users s on s.id = r.student_id
     left join enrollments e on e.id = r.enrollment_id
     left join courses c on c.id = e.course_id
     where r.tutor_id = $1
     order by r.created_at desc
     limit 50`,
    [row.id]
  );

  const courses = await query(
    `${COURSE_SELECT} where c.tutor_id = $1 and c.status = 'active' order by c.created_at desc`,
    [row.id]
  );

  res.json({ tutor: shape(row), reviews, courses: courses.map(courseShape) });
}));

export default router;
