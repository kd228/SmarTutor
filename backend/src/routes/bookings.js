import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { clientUrl, mockPaymentsAllowed, paymentsUnavailable, stripe } from '../stripe.js';
import { feeFor, parseId, wrap } from '../util.js';

const router = Router();

const BOOKING_SELECT = `
  select b.id, b.tutor_id as "tutorId", b.student_id as "studentId", b.scheduled_at as "scheduledAt",
         b.duration_minutes as "durationMinutes", b.amount_cents as "amountCents", b.status, b.notes,
         b.created_at as "createdAt",
         t.name as "tutorName", s.name as "studentName",
         exists (select 1 from reviews r where r.booking_id = b.id) as reviewed
  from bookings b
  join users t on t.id = b.tutor_id
  join users s on s.id = b.student_id
`;

// Student creates a single-session booking and gets a payment URL back
router.post('/', requireAuth, requireRole('student'), wrap(async (req, res) => {
  const { scheduledAt, durationMinutes = 60, notes = '' } = req.body || {};
  const tutorId = parseId(req.body?.tutorId);
  const duration = Number(durationMinutes);
  const when = new Date(scheduledAt);

  if (!Number.isInteger(duration) || duration < 30 || duration > 240 || duration % 30 !== 0) {
    return res.status(400).json({ error: 'Duration must be 30 to 240 minutes, in 30-minute steps' });
  }
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Pick a date and time in the future' });
  }

  const tutor = tutorId && (await one(
    `select u.id, u.name, p.hourly_rate_cents as rate, p.headline
     from users u join tutor_profiles p on p.user_id = u.id where u.id = $1`,
    [tutorId]
  ));
  if (!tutor || !tutor.rate) return res.status(404).json({ error: 'Tutor not available for booking' });
  if (!stripe() && !mockPaymentsAllowed()) return paymentsUnavailable(res);

  const amount = Math.round((tutor.rate * duration) / 60);
  const created = await one(
    `insert into bookings (tutor_id, student_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, notes)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [tutor.id, req.user.id, when.toISOString(), duration, amount, feeFor(amount), String(notes).slice(0, 1000)]
  );
  const bookingId = created.id;

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
            product_data: {
              name: `${duration}-minute tutoring session with ${tutor.name}`,
              ...(tutor.headline ? { description: tutor.headline } : {}),
            },
          },
        },
      ],
      metadata: { bookingId: String(bookingId) },
      success_url: `${clientUrl()}/dashboard?paid=${bookingId}`,
      cancel_url: `${clientUrl()}/tutors/${tutor.id}?cancelled=1`,
    });
    await query('update bookings set stripe_session_id = $1 where id = $2', [session.id, bookingId]);
    res.status(201).json({ bookingId, mock: false, checkoutUrl: session.url });
  } catch (err) {
    await query("update bookings set status = 'cancelled' where id = $1", [bookingId]);
    console.error('Stripe error:', err.message);
    res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
}));

// Bookings for the signed-in user (student or tutor)
router.get('/mine', requireAuth, wrap(async (req, res) => {
  const column = req.user.role === 'tutor' ? 'b.tutor_id' : 'b.student_id';
  const rows = await query(`${BOOKING_SELECT} where ${column} = $1 order by b.scheduled_at desc`, [req.user.id]);
  res.json({ bookings: rows });
}));

// Mock payment confirmation (only available when Stripe is not configured)
router.post('/:id/mock-pay', requireAuth, requireRole('student'), wrap(async (req, res) => {
  if (!mockPaymentsAllowed()) return res.status(404).json({ error: 'Not found' });
  const id = parseId(req.params.id);
  const updated = id && (await one(
    "update bookings set status = 'paid' where id = $1 and student_id = $2 and status = 'pending_payment' returning id",
    [id, req.user.id]
  ));
  if (!updated) return res.status(409).json({ error: 'Booking not found or not awaiting payment' });
  res.json({ ok: true });
}));

// Tutor marks a paid session as completed (unlocks reviews)
router.post('/:id/complete', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const updated = id && (await one(
    "update bookings set status = 'completed' where id = $1 and tutor_id = $2 and status = 'paid' returning id",
    [id, req.user.id]
  ));
  if (!updated) return res.status(409).json({ error: 'Only your paid bookings can be completed' });
  res.json({ ok: true });
}));

// Either side can cancel an unpaid booking
router.post('/:id/cancel', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const updated = id && (await one(
    `update bookings set status = 'cancelled'
     where id = $1 and (student_id = $2 or tutor_id = $2) and status = 'pending_payment' returning id`,
    [id, req.user.id]
  ));
  if (!updated) return res.status(409).json({ error: 'Only bookings awaiting payment can be cancelled' });
  res.json({ ok: true });
}));

export default router;
