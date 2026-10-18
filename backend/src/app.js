import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import tutorRoutes from './routes/tutors.js';
import bookingRoutes, { stripeWebhook } from './routes/bookings.js';
import reviewRoutes from './routes/reviews.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

  // Stripe needs the raw body to verify signatures, so this goes before express.json()
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/tutors', tutorRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/reviews', reviewRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
