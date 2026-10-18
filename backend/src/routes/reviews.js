import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

// A student can review a tutor once per completed, paid session
router.post('/', requireAuth, requireRole('student'), (req, res) => {
  const { bookingId, rating, comment = '' } = req.body || {};
  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5' });
  }

  const booking = db
    .prepare('SELECT * FROM bookings WHERE id = ? AND student_id = ?')
    .get(Number(bookingId), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'completed') {
    return res.status(409).json({ error: 'You can review a session once the tutor marks it completed' });
  }
  if (db.prepare('SELECT 1 FROM reviews WHERE booking_id = ?').get(booking.id)) {
    return res.status(409).json({ error: 'You already reviewed this session' });
  }

  db.prepare(
    'INSERT INTO reviews (booking_id, tutor_id, student_id, rating, comment) VALUES (?, ?, ?, ?, ?)'
  ).run(booking.id, booking.tutor_id, req.user.id, stars, String(comment).trim().slice(0, 2000));

  res.status(201).json({ ok: true });
});

export default router;
