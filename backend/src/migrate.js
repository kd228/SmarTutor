// Applies schema.sql to the database in DATABASE_URL. Safe to run repeatedly.
import 'dotenv/config';
import fs from 'node:fs';
import { closePool, hasDatabase, query } from './db.js';

if (!hasDatabase()) {
  console.error('Set DATABASE_URL first (see .env.example).');
  process.exit(1);
}

const sql = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
await query(sql);
await closePool();
console.log('Schema applied.');
