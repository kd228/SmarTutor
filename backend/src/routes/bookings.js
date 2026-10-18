import { Router } from 'express';
import Stripe from 'stripe';
import db from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();

const stripe = () => (process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null);
const clientUrl = () =>
  process.env.CLIENT_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5173');

const BOOKING_SELECT = `
  SELECT b.id, b.tutor_id AS tutorId, b.student_id AS studentId, b.scheduled_at AS scheduledAt,
         b.duration_minutes AS durationMinutes, b.amount_cents AS amountCents, b.status, b.notes,
         b.created_at AS createdAt,
         t.name AS tutorName, s.name AS studentName,
         EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
  FROM bookings b
  JOIN users t ON t.id = b.tutor_id
  JOIN users s ON s.id = b.student_id
`;

const shape = (row) => ({ ...row, reviewed: Boolean(row.reviewed) });

// Student creates a booking and gets a payment URL back
router.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const { tutorId, scheduledAt, durationMinutes = 60, notes = '' } = req.body || {};
  const duration = Number(durationMinutes);
  const when = new Date(scheduledAt);

  if (!Number.isInteger(duration) || duration < 30 || duration > 240 || duration % 30 !== 0) {
    return res.status(400).json({ error: 'Duration must be 30 to 240 minutes, in 30-minute steps' });
  }
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Pick a date and time in the future' });
  }

  const tutor = db
    .prepare(
      `SELECT u.id, u.name, p.hourly_rate_cents AS rate, p.headline
       FROM users u JOIN tutor_profiles p ON p.user_id = u.id WHERE u.id = ?`
    )
    .get(Number(tutorId));
  if (!tutor || !tutor.rate) return res.status(404).json({ error: 'Tutor not available for booking' });

  const amount = Math.round((tutor.rate * duration) / 60);
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 15);
  const fee = Math.round((amount * feePercent) / 100);

  const result = db
    .prepare(
      `INSERT INTO bookings (tutor_id, student_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(tutor.id, req.user.id, when.toISOString(), duration, amount, fee, String(notes).slice(0, 1000));
  const bookingId = Number(result.lastInsertRowid);

  const client = stripe();
  if (!client) {
    // Local development without Stripe keys: a mock checkout the frontend can confirm
    return res.status(201).json({ bookingId, mock: true, checkoutUrl: `${clientUrl()}/checkout/mock/${bookingId}` });
  }

  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: `${duration}-minute tutoring session with ${tutor.name}`, description: tutor.headline },
          },
        },
      ],
      metadata: { bookingId: String(bookingId) },
      success_url: `${clientUrl()}/dashboard?paid=${bookingId}`,
      cancel_url: `${clientUrl()}/tutors/${tutor.id}?cancelled=1`,
    });
    db.prepare('UPDATE bookings SET stripe_session_id = ? WHERE id = ?').run(session.id, bookingId);
    res.status(201).json({ bookingId, mock: false, checkoutUrl: session.url });
  } catch (err) {
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(bookingId);
    console.error('Stripe error:', err.message);
    res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
});

// Bookings for the signed-in user (student or tutor)
router.get('/mine', requireAuth, (req, res) => {
  const column = req.user.role === 'tutor' ? 'b.tutor_id' : 'b.student_id';
  const rows = db
    .prepare(`${BOOKING_SELECT} WHERE ${column} = ? ORDER BY b.scheduled_at DESC`)
    .all(req.user.id);
  res.json({ bookings: rows.map(shape) });
});

// Mock payment confirmation (only available when Stripe is not configured)
router.post('/:id/mock-pay', requireAuth, requireRole('student'), (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) return res.status(404).json({ error: 'Not found' });
  const booking = db
    .prepare('SELECT * FROM bookings WHERE id = ? AND student_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'pending_payment') return res.status(409).json({ error: 'Booking is not awaiting payment' });
  db.prepare("UPDATE bookings SET status = 'paid' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

// Tutor marks a paid session as completed (unlocks reviews)
router.post('/:id/complete', requireAuth, requireRole('tutor'), (req, res) => {
  const booking = db
    .prepare('SELECT * FROM bookings WHERE id = ? AND tutor_id = ?')
    .get(Number(req.params.id), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') return res.status(409).json({ error: 'Only paid bookings can be completed' });
  db.prepare("UPDATE bookings SET status = 'completed' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

// Either side can cancel an unpaid booking
router.post('/:id/cancel', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(req.params.id));
  if (!booking || (booking.student_id !== req.user.id && booking.tutor_id !== req.user.id)) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  if (booking.status !== 'pending_payment') {
    return res.status(409).json({ error: 'Paid bookings need a refund; contact support' });
  }
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

// Stripe webhook: mounted with a raw body in server.js
export function stripeWebhook(req, res) {
  const client = stripe();
  if (!client || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(404).end();

  let event;
  try {
    event = client.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const bookingId = Number(event.data.object.metadata?.bookingId);
    if (bookingId) {
      db.prepare("UPDATE bookings SET status = 'paid' WHERE id = ? AND status = 'pending_payment'").run(bookingId);
    }
  }
  res.json({ received: true });
}

export default router;
