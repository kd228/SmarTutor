// Entrypoint for Vercel: it looks for a file that imports `express` and default-exports the app.
// Local development still uses src/server.js, which calls listen().
import 'dotenv/config';
import express from 'express';
import { createApp } from './app.js';

const app = express();
app.use(createApp());

export default app;
