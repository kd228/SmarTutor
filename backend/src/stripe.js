import Stripe from 'stripe';

let cached;

// Returns a Stripe client, or null when STRIPE_SECRET_KEY is not set (mock checkout mode).
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached || cached.key !== key) cached = { key, client: new Stripe(key) };
  return cached.client;
}

// Mock checkout marks things "paid" with no money taken, so on a production server it must be
// switched on deliberately (ALLOW_MOCK_PAYMENTS=true) and never by simply forgetting a Stripe key.
export function mockPaymentsAllowed() {
  if (process.env.STRIPE_SECRET_KEY) return false;
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_MOCK_PAYMENTS === 'true';
}

export function paymentsUnavailable(res) {
  return res.status(503).json({ error: 'Payments are not set up on this server yet.' });
}

export function clientUrl() {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:5173';
}
