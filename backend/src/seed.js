import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';

const hash = bcrypt.hashSync('password123', 10);

const tutors = [
  ['Maya Patel', 'maya@example.com', 'Calculus and Physics tutor, Rice grad', 'I help high school and college students get comfortable with calculus, physics and test prep. Patient, example-driven sessions.', 'Calculus,Physics,SAT Math', 4500, 'Austin, TX'],
  ['Daniel Okafor', 'daniel@example.com', 'Python and intro CS made friendly', 'Software engineer with five years of teaching experience. Great for AP CS, beginners and career switchers.', 'Python,Computer Science,Algorithms', 6000, 'Online'],
  ['Elena Rossi', 'elena@example.com', 'Conversational Spanish and Italian', 'Native speaker focused on real conversation, grammar that sticks and travel-ready vocabulary.', 'Spanish,Italian', 3500, 'Online'],
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)');
const insertProfile = db.prepare(
  `INSERT OR REPLACE INTO tutor_profiles (user_id, headline, bio, subjects, hourly_rate_cents, location)
   VALUES (?, ?, ?, ?, ?, ?)`
);

for (const [name, email, headline, bio, subjects, rate, location] of tutors) {
  insertUser.run(email, hash, name, 'tutor');
  const { id } = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  insertProfile.run(id, headline, bio, subjects, rate, location);
}
insertUser.run('student@example.com', hash, 'Sam Student', 'student');

const student = db.prepare("SELECT id FROM users WHERE email = 'student@example.com'").get();
const maya = db.prepare("SELECT id FROM users WHERE email = 'maya@example.com'").get();

if (!db.prepare('SELECT 1 FROM reviews WHERE tutor_id = ?').get(maya.id)) {
  const b = db
    .prepare(
      `INSERT INTO bookings (tutor_id, student_id, scheduled_at, duration_minutes, amount_cents, platform_fee_cents, status)
       VALUES (?, ?, datetime('now', '-7 days'), 60, 4500, 675, 'completed')`
    )
    .run(maya.id, student.id);
  db.prepare('INSERT INTO reviews (booking_id, tutor_id, student_id, rating, comment) VALUES (?, ?, ?, 5, ?)').run(
    Number(b.lastInsertRowid),
    maya.id,
    student.id,
    'Maya explained limits in a way that finally clicked. Raised my grade a full letter.'
  );
}

console.log('Seeded. Log in with maya@example.com / student@example.com, password: password123');
