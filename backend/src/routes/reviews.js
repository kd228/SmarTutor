import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { parseId, wrap } from '../util.js';

const router = Router();

// A student reviews a tutor once per completed single session, or once per completed course.
router.post('/', requireAuth, requireRole('student'), wrap(async (req, res) => {
  const { rating, comment = '' } = req.body || {};
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5' });
  }

  const bookingId = parseId(req.body?.bookingId);
  const enrollmentId = parseId(req.body?.enrollmentId);
  if (Boolean(bookingId) === Boolean(enrollmentId)) {
    return res.status(400).json({ error: 'Review either one session or one course' });
  }

  const target = bookingId
    ? await one('select id, tutor_id, status from bookings where id = $1 and student_id = $2', [bookingId, req.user.id])
    : await one('select id, tutor_id, status from enrollments where id = $1 and student_id = $2', [enrollmentId, req.user.id]);
  if (!target) return res.status(404).json({ error: 'Not found' });
  if (target.status !== 'completed') {
    return res.status(409).json({
      error: bookingId
        ? 'You can review a session once the tutor marks it completed'
        : 'You can review a course once every session is complete',
    });
  }

  try {
    await query(
      'insert into reviews (booking_id, enrollment_id, tutor_id, student_id, rating, comment) values ($1, $2, $3, $4, $5, $6)',
      [bookingId, enrollmentId, target.tutor_id, req.user.id, stars, String(comment).trim().slice(0, 2000)]
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already reviewed this' });
    throw err;
  }
  res.status(201).json({ ok: true });
}));

export default router;
