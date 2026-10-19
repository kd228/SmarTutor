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
  SELECT b.id, b.tutor_id AS tutorId, b.student_id AS studentId, b.package_id AS packageId,
         b.scheduled_at AS scheduledAt, b.duration_minutes AS durationMinutes, b.amount_cents AS amountCents, b.status, b.notes,
         b.created_at AS createdAt, t.name AS tutorName, s.name AS studentName,
         EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
  FROM bookings b
  JOIN users t ON t.id = b.tutor_id
  JOIN users s ON s.id = b.student_id
`;

const shape = (row) => ({ ...row, reviewed: Boolean(row.reviewed) });

router.post('/package', requireAuth, requireRole('student'), async (req, res) => {
  const { packageId, startDate, notes = '' } = req.body || {};
  const pkg = db.prepare('SELECT * FROM course_packages WHERE id = ?').get(Number(packageId));
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Pick a valid start date in the future' });
  }

  const insert = db.prepare(
    `INSERT INTO bookings (tutor_id, student_id, package_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 15);
  const totalAmount = pkg.price_cents;
  const feePerSession = Math.round((totalAmount / pkg.sessions_count) * (feePercent / 100));

  let firstBookingId;
  db.exec('BEGIN TRANSACTION');
  try {
    for (let i = 0; i < pkg.sessions_count; i++) {
      const sessionDate = new Date(start);
      sessionDate.setDate(sessionDate.getDate() + (i * 7));
      const result = insert.run(
        pkg.tutor_id, req.user.id, pkg.id, sessionDate.toISOString(),
        pkg.duration_minutes, Math.round(totalAmount / pkg.sessions_count), feePerSession, String(notes).slice(0, 1000)
      );
      if (i === 0) firstBookingId = Number(result.lastInsertRowid);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Could not create package bookings' });
  }

  const client = stripe();
  if (!client) {
    return res.status(201).json({ bookingId: firstBookingId, mock: true, checkoutUrl: `${clientUrl()}/checkout/mock/${firstBookingId}` });
  }

  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: totalAmount, product_data: { name: pkg.title, description: `${pkg.sessions_count} sessions with ${pkg.subject}` } },
      }],
      metadata: { packageId: String(pkg.id), studentId: String(req.user.id) },
      success_url: `${clientUrl()}/dashboard?paid=${firstBookingId}`,
      cancel_url: `${clientUrl()}/tutors/${pkg.tutor_id}?cancelled=1`,
    });
    
    db.prepare('UPDATE bookings SET stripe_session_id = ? WHERE package_id = ? AND student_id = ? AND status = "pending_payment"')
      .run(session.id, pkg.id, req.user.id);

    res.status(201).json({ bookingId: firstBookingId, mock: false, checkoutUrl: session.url });
  } catch (err) {
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE package_id = ? AND student_id = ?").run(pkg.id, req.user.id);
    res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
});

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

  const tutor = db.prepare(`SELECT u.id, u.name, p.hourly_rate_cents AS rate, p.headline FROM users u JOIN tutor_profiles p ON p.user_id = u.id WHERE u.id = ?`).get(Number(tutorId));
  if (!tutor || !tutor.rate) return res.status(404).json({ error: 'Tutor not available for booking' });

  const amount = Math.round((tutor.rate * duration) / 60);
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 15);
  const fee = Math.round((amount * feePercent) / 100);

  const result = db.prepare(`INSERT INTO bookings (tutor_id, student_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(tutor.id, req.user.id, when.toISOString(), duration, amount, fee, String(notes).slice(0, 1000));
  const bookingId = Number(result.lastInsertRowid);

  const client = stripe();
  if (!client) return res.status(201).json({ bookingId, mock: true, checkoutUrl: `${clientUrl()}/checkout/mock/${bookingId}` });

  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: amount, product_data: { name: `${duration}-minute tutoring session with ${tutor.name}`, description: tutor.headline } } }],
      metadata: { bookingId: String(bookingId) },
      success_url: `${clientUrl()}/dashboard?paid=${bookingId}`,
      cancel_url: `${clientUrl()}/tutors/${tutor.id}?cancelled=1`,
    });
    db.prepare('UPDATE bookings SET stripe_session_id = ? WHERE id = ?').run(session.id, bookingId);
    res.status(201).json({ bookingId, mock: false, checkoutUrl: session.url });
  } catch (err) {
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(bookingId);
    res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
});

router.get('/mine', requireAuth, (req, res) => {
  const column = req.user.role === 'tutor' ? 'b.tutor_id' : 'b.student_id';
  const rows = db.prepare(`${BOOKING_SELECT} WHERE ${column} = ? ORDER BY b.scheduled_at DESC`).all(req.user.id);
  res.json({ bookings: rows.map(shape) });
});

router.post('/:id/mock-pay', requireAuth, requireRole('student'), (req, res) => {
  if (process.env.STRIPE_SECRET_KEY) return res.status(404).json({ error: 'Not found' });
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND student_id = ?').get(Number(req.params.id), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  
  if (booking.package_id) {
    db.prepare("UPDATE bookings SET status = 'paid' WHERE package_id = ? AND student_id = ? AND status = 'pending_payment'").run(booking.package_id, req.user.id);
  } else {
    db.prepare("UPDATE bookings SET status = 'paid' WHERE id = ?").run(booking.id);
  }
  res.json({ ok: true });
});

router.post('/:id/complete', requireAuth, requireRole('tutor'), (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND tutor_id = ?').get(Number(req.params.id), req.user.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== 'paid') return res.status(409).json({ error: 'Only paid bookings can be completed' });
  db.prepare("UPDATE bookings SET status = 'completed' WHERE id = ?").run(booking.id);
  res.json({ ok: true });
});

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

export function stripeWebhook(req, res) {
  const client = stripe();
  if (!client || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(404).end();

  let event;
  try {
    event = client.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const alreadyProcessed = db.prepare('SELECT 1 FROM processed_stripe_events WHERE event_id = ?').get(event.id);
  if (alreadyProcessed) return res.json({ received: true, duplicate: true });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = Number(session.metadata?.bookingId);
    const packageId = Number(session.metadata?.packageId);
    const studentId = Number(session.metadata?.studentId);

    if (bookingId) {
      db.prepare("UPDATE bookings SET status = 'paid' WHERE id = ? AND status = 'pending_payment'").run(bookingId);
    } else if (packageId && studentId) {
      db.prepare("UPDATE bookings SET status = 'paid' WHERE package_id = ? AND student_id = ? AND status = 'pending_payment'").run(packageId, studentId);
    }
  }

  db.prepare('INSERT INTO processed_stripe_events (event_id) VALUES (?)').run(event.id);
  res.json({ received: true });
}

export default router;
