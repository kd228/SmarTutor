import { query } from '../db.js';
import { stripe } from '../stripe.js';
import { wrap } from '../util.js';

// Stripe tells us when a Checkout payment succeeds. Mounted with a raw body in app.js so the
// signature can be verified. A failure returns 500, which makes Stripe retry later.
export const stripeWebhook = wrap(async (req, res) => {
  const client = stripe();
  if (!client || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(404).end();

  let event;
  try {
    event = client.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const metadata = event.data.object.metadata || {};
    const bookingId = Number(metadata.bookingId);
    const enrollmentId = Number(metadata.enrollmentId);
    if (Number.isInteger(bookingId) && bookingId > 0) {
      await query("update bookings set status = 'paid' where id = $1 and status = 'pending_payment'", [bookingId]);
    }
    if (Number.isInteger(enrollmentId) && enrollmentId > 0) {
      await query("update enrollments set status = 'active' where id = $1 and status = 'pending_payment'", [enrollmentId]);
    }
  }
  res.json({ received: true });
});
