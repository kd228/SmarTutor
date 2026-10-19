// Adds demo tutors, a student, one review and a sample course. Safe to run repeatedly.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { closePool, hasDatabase, one, query } from './db.js';

if (!hasDatabase()) {
  console.error('Set DATABASE_URL first (see .env.example).');
  process.exit(1);
}

const hash = await bcrypt.hash('password123', 10);

const tutors = [
  ['Maya Patel', 'maya@example.com', 'Calculus and Physics tutor, Rice grad', 'I help high school and college students get comfortable with calculus, physics and test prep. Patient, example-driven sessions.', 'Calculus,Physics,SAT Math', 4500, 'Austin, TX'],
  ['Daniel Okafor', 'daniel@example.com', 'Python and intro CS made friendly', 'Software engineer with five years of teaching experience. Great for AP CS, beginners and career switchers.', 'Python,Computer Science,Algorithms', 6000, 'Online'],
  ['Elena Rossi', 'elena@example.com', 'Conversational Spanish and Italian', 'Native speaker focused on real conversation, grammar that sticks and travel-ready vocabulary.', 'Spanish,Italian', 3500, 'Online'],
];

const ids = {};
for (const [name, email, headline, bio, subjects, rate, location] of tutors) {
  const user = await one(
    `insert into users (email, password_hash, name, role) values ($1, $2, $3, 'tutor')
     on conflict (email) do update set name = excluded.name returning id`,
    [email, hash, name]
  );
  ids[email] = user.id;
  await query(
    `insert into tutor_profiles (user_id, headline, bio, subjects, hourly_rate_cents, location)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do update set headline = excluded.headline, bio = excluded.bio,
       subjects = excluded.subjects, hourly_rate_cents = excluded.hourly_rate_cents, location = excluded.location`,
    [user.id, headline, bio, subjects, rate, location]
  );
}

const student = await one(
  `insert into users (email, password_hash, name, role) values ('student@example.com', $1, 'Sam Student', 'student')
   on conflict (email) do update set name = excluded.name returning id`,
  [hash]
);

const maya = ids['maya@example.com'];
if (!(await one('select 1 as found from reviews where tutor_id = $1', [maya]))) {
  const booking = await one(
    `insert into bookings (tutor_id, student_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, status)
     values ($1, $2, now() - interval '7 days', 60, 4500, 675, 'completed') returning id`,
    [maya, student.id]
  );
  await query(
    'insert into reviews (booking_id, tutor_id, student_id, rating, comment) values ($1, $2, $3, 5, $4)',
    [booking.id, maya, student.id, 'Maya explained limits in a way that finally clicked. Raised my grade a full letter.']
  );
}

if (!(await one('select 1 as found from courses where tutor_id = $1', [maya]))) {
  await query(
    `insert into courses (tutor_id, title, description, subject, total_sessions, sessions_per_week, session_minutes, price_cents)
     values ($1, 'Calculus I: from limits to integrals', $2, 'Calculus', 12, 2, 60, 42000)`,
    [maya, 'Six weeks, two one-hour sessions a week. We follow a standard first-semester syllabus: limits, derivatives, applications, and an introduction to integrals, with problem sets between sessions.']
  );
}

await closePool();
console.log('Seeded. Log in with maya@example.com or student@example.com, password: password123');
