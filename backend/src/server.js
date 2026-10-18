import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 4000;

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set; using an insecure development secret. Set it before deploying.');
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is not set; payments run through the mock checkout.');
}

createApp().listen(port, () => console.log(`API listening on http://localhost:${port}`));
