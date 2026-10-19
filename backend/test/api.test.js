// Integration tests that run against a real PostgreSQL database.
//   TEST_DATABASE_URL=postgres://... npm test
// Use a throwaway database: the tests create rows with @smartutor-test.invalid emails and delete them afterwards.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to run the API tests';

if (url) {
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = 'test-secret';
  process.env.NODE_ENV = 'test';
  delete process.env.STRIPE_SECRET_KEY;
}

const { createApp } = await import('../src/app.js');
const { query, closePool } = await import('../src/db.js');

const server = skip ? null : createApp().listen(0);
const base = skip ? '' : `http://localhost:${server.address().port}/api`;
const tag = Date.now();
const testUsers = "select id from users where email like '%@smartutor-test.invalid'";

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

const register = (name, role) =>
  call('/auth/register', {
    method: 'POST',
    body: { name, email: `${name.toLowerCase().replace(/\W/g, '')}${tag}@smartutor-test.invalid`, password: 'longenough1', role },
  });

const tomorrow = () => new Date(Date.now() + 86400000).toISOString();

test('register, log in, and reject bad credentials', { skip }, async () => {
  const created = await register('Login Check', 'student');
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, 'student');

  const email = `logincheck${tag}@smartutor-test.invalid`;
  const dup = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Login Check', email: email.toUpperCase(), password: 'longenough1', role: 'student' },
  });
  assert.equal(dup.status, 409);

  const ok = await call('/auth/login', { method: 'POST', body: { email, password: 'longenough1' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token);
  assert.equal((await call('/auth/me', { token: ok.data.token })).data.user.email, email);

  assert.equal((await call('/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } })).status, 401);
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'nobody@x.invalid', password: 'x' } })).status, 401);
  assert.equal((await call('/bookings/mine')).status, 401);
});

test('single session: profile, booking, payment, completion, review', { skip }, async () => {
  const tutor = await register('Tina Tutor', 'tutor');
  const student = await register('Sid Student', 'student');

  const profile = await call('/tutors/me/profile', {
    method: 'PUT',
    token: tutor.data.token,
    body: { headline: 'Algebra made easy', bio: 'Hello', subjects: ['Algebra', 'Geometry'], hourlyRate: 40, location: 'Online' },
  });
  assert.equal(profile.data.tutor.hourlyRateCents, 4000);
  assert.ok((await call('/tutors?subject=algebra')).data.tutors.some((t) => t.id === tutor.data.user.id));

  const wrongRole = await call('/bookings', {
    method: 'POST', token: tutor.data.token, body: { tutorId: tutor.data.user.id, scheduledAt: tomorrow() },
  });
  assert.equal(wrongRole.status, 403);

  const booking = await call('/bookings', {
    method: 'POST',
    token: student.data.token,
    body: { tutorId: tutor.data.user.id, scheduledAt: tomorrow(), durationMinutes: 90 },
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.data.mock, true);
  const id = booking.data.bookingId;

  assert.equal((await call('/reviews', { method: 'POST', token: student.data.token, body: { bookingId: id, rating: 5 } })).status, 409);
  assert.equal((await call(`/bookings/${id}/mock-pay`, { method: 'POST', token: student.data.token })).status, 200);
  assert.equal((await call(`/bookings/${id}/complete`, { method: 'POST', token: tutor.data.token })).status, 200);
  assert.equal((await call('/reviews', { method: 'POST', token: student.data.token, body: { bookingId: id, rating: 5, comment: 'Great' } })).status, 201);
  assert.equal((await call('/reviews', { method: 'POST', token: student.data.token, body: { bookingId: id, rating: 4 } })).status, 409);

  const detail = await call(`/tutors/${tutor.data.user.id}`);
  assert.equal(detail.data.tutor.reviewCount, 1);
  assert.equal(detail.data.tutor.avgRating, 5);
  assert.equal((await call('/bookings/mine', { token: student.data.token })).data.bookings[0].amountCents, 6000);
});

test('course: create, enroll, pay, teach every session in order, review', { skip }, async () => {
  const tutor = await register('Cora Course', 'tutor');
  const student = await register('Stu Dent', 'student');

  const bad = await call('/courses', { method: 'POST', token: tutor.data.token, body: { title: 'Too short', totalSessions: 1, sessionMinutes: 60, price: 100 } });
  assert.equal(bad.status, 400);

  const created = await call('/courses', {
    method: 'POST',
    token: tutor.data.token,
    body: { title: 'Calculus I in six weeks', subject: 'Calculus', totalSessions: 6, sessionsPerWeek: 2, sessionMinutes: 60, price: 300 },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.course.weeks, 3);
  assert.equal(created.data.course.perSessionCents, 5000);
  const courseId = created.data.course.id;

  assert.ok((await call('/courses?subject=calculus')).data.courses.some((c) => c.id === courseId));
  assert.equal((await call('/courses', { method: 'POST', token: student.data.token, body: {} })).status, 403);

  const enroll = await call('/enrollments', {
    method: 'POST',
    token: student.data.token,
    body: { courseId, startsAt: tomorrow(), timeZone: 'America/Chicago' },
  });
  assert.equal(enroll.status, 201);
  const enrollmentId = enroll.data.enrollmentId;

  assert.equal((await call(`/enrollments/${enrollmentId}/mock-pay`, { method: 'POST', token: student.data.token })).status, 200);
  assert.equal((await call('/enrollments', { method: 'POST', token: student.data.token, body: { courseId, startsAt: tomorrow() } })).status, 409);

  let mine = (await call('/enrollments/mine', { token: student.data.token })).data.enrollments[0];
  assert.equal(mine.totalSessions, 6);
  assert.equal(mine.completedSessions, 0);
  assert.equal(mine.status, 'active');

  // Sessions are in the future, so the tutor cannot mark them yet. Move them into the past for the test.
  const early = await call(`/enrollments/sessions/${mine.sessions[0].id}/complete`, { method: 'POST', token: tutor.data.token });
  assert.equal(early.status, 409);
  await query("update course_sessions set scheduled_at = now() - make_interval(days => 10 - session_number) where enrollment_id = $1", [enrollmentId]);

  const complete = (n) => call(`/enrollments/sessions/${mine.sessions[n].id}/complete`, { method: 'POST', token: tutor.data.token });
  assert.equal((await complete(2)).status, 409, 'sessions must be completed in order');
  for (let n = 0; n < 5; n += 1) assert.equal((await complete(n)).status, 200);

  assert.equal((await call('/reviews', { method: 'POST', token: student.data.token, body: { enrollmentId, rating: 5 } })).status, 409);
  const last = await complete(5);
  assert.equal(last.data.courseCompleted, true);

  assert.equal((await call('/reviews', { method: 'POST', token: student.data.token, body: { enrollmentId, rating: 5, comment: 'Clear and patient' } })).status, 201);
  const profile = await call(`/tutors/${tutor.data.user.id}`);
  assert.equal(profile.data.reviews[0].courseTitle, 'Calculus I in six weeks');
  assert.equal(profile.data.courses.length, 1);

  mine = (await call('/enrollments/mine', { token: student.data.token })).data.enrollments[0];
  assert.equal(mine.status, 'completed');
  assert.equal(mine.reviewed, true);
});

after(async () => {
  if (skip) return;
  server.close();
  const mineIds = `(${testUsers})`;
  await query(`delete from reviews where tutor_id in ${mineIds}`);
  await query(`delete from course_sessions where enrollment_id in (select id from enrollments where tutor_id in ${mineIds})`);
  await query(`delete from enrollments where tutor_id in ${mineIds}`);
  await query(`delete from courses where tutor_id in ${mineIds}`);
  await query(`delete from bookings where tutor_id in ${mineIds}`);
  await query(`delete from tutor_profiles where user_id in ${mineIds}`);
  await query("delete from users where email like '%@smartutor-test.invalid'");
  await closePool();
});
