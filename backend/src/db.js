import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Vercel's filesystem is read-only except /tmp, and /tmp is wiped between instances,
// so on Vercel this database is demo-only until it moves to a hosted database.
const onVercel = Boolean(process.env.VERCEL);
const dbPath = process.env.DB_PATH || (onVercel ? '/tmp/tutoring.db' : './data/tutoring.db');
if (onVercel && !process.env.DB_PATH) {
  console.warn('Running on Vercel with a temporary SQLite file: data will NOT persist. Use a hosted database for real use.');
}
if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'tutor')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  subjects TEXT NOT NULL DEFAULT '',
  hourly_rate_cents INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tutor_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'completed', 'cancelled')),
  stripe_session_id TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
  tutor_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_tutor ON bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tutor ON reviews(tutor_id);
`);

export default db;
