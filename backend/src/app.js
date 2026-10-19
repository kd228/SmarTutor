import express from 'express';
import cors from 'cors';
import { hasDatabase, query } from './db.js';
import { wrap } from './util.js';
import authRoutes from './routes/auth.js';
import tutorRoutes from './routes/tutors.js';
import courseRoutes from './routes/courses.js';
import enrollmentRoutes from './routes/enrollments.js';
import bookingRoutes from './routes/bookings.js';
import reviewRoutes from './routes/reviews.js';
import { stripeWebhook } from './routes/webhook.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

  // Stripe needs the raw body to verify signatures, so this goes before express.json()
  app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

  app.use(express.json({ limit: '100kb' }));

  // Visit /api/health after deploying to check configuration. It reports yes/no only, never secrets.
  app.get('/api/health', wrap(async (_req, res) => {
    let database = 'not configured';
    if (hasDatabase()) {
      try {
        await query('select 1');
        database = 'connected';
      } catch (err) {
        console.error('Health check: database unreachable:', err.message);
        database = 'unreachable';
      }
    }
    res.json({
      ok: database === 'connected' && Boolean(process.env.JWT_SECRET),
      database,
      jwtSecretSet: Boolean(process.env.JWT_SECRET),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  }));

  app.use('/api/auth', authRoutes);
  app.use('/api/tutors', tutorRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/reviews', reviewRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
    if (err.expose && err.status) return res.status(err.status).json({ error: err.message });
    if (!hasDatabase()) {
      console.error('DATABASE_URL is not set');
      return res.status(503).json({ error: 'The server has no database configured yet.' });
    }
    const unreachable =
      ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', '28P01', '28000', '3D000', 'XX000'].includes(err.code) ||
      /timeout exceeded when trying to connect|tenant or user not found/i.test(err.message || '');
    if (unreachable) {
      console.error('Database unreachable:', err.message);
      return res.status(503).json({ error: 'The service cannot reach its database right now. Please try again in a few minutes.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}
