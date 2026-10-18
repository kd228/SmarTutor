import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';
delete process.env.STRIPE_SECRET_KEY;

const { createApp } = await import('../src/app.js');

const server = createApp().listen(0);
const base = `http://localhost:${server.address().port}/api`;

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

test('full flow: tutor profile, booking, payment, completion, review', async () => {
  const tutor = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Tina Tutor', email: 'tina@test.com', password: 'longenough1', role: 'tutor' },
  });
  assert.equal(tutor.status, 201);

  const dup = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Tina', email: 'TINA@test.com', password: 'longenough1', role: 'tutor' },
  });
  assert.equal(dup.status, 409);

  const profile = await call('/tutors/me/profile', {
    method: 'PUT',
    token: tutor.data.token,
    body: { headline: 'Algebra made easy', bio: 'Hello', subjects: ['Algebra', 'Geometry'], hourlyRate: 40, location: 'Online' },
  });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.tutor.hourlyRateCents, 4000);

  const list = await call('/tutors?subject=algebra');
  assert.equal(list.data.tutors.length, 1);

  const student = await call('/auth/register', {
    method: 'POST',
    body: { name: 'Sid Student', email: 'sid@test.com', password: 'longenough1', role: 'student' },
  });

  // Tutors cannot book
  const wrongRole = await call('/bookings', {
    method: 'POST',
    token: tutor.data.token,
    body: { tutorId: tutor.data.user.id, scheduledAt: new Date(Date.now() + 86400000).toISOString() },
  });
  assert.equal(wrongRole.status, 403);

  const booking = await call('/bookings', {
    method: 'POST',
    token: student.data.token,
    body: { tutorId: tutor.data.user.id, scheduledAt: new Date(Date.now() + 86400000).toISOString(), durationMinutes: 90 },
  });
  assert.equal(booking.status, 201);
  assert.equal(booking.data.mock, true);
  const id = booking.data.bookingId;

  // Cannot review before the session is completed
  const early = await call('/reviews', { method: 'POST', token: student.data.token, body: { bookingId: id, rating: 5 } });
  assert.equal(early.status, 409);

  assert.equal((await call(`/bookings/${id}/mock-pay`, { method: 'POST', token: student.data.token })).status, 200);
  assert.equal((await call(`/bookings/${id}/complete`, { method: 'POST', token: tutor.data.token })).status, 200);

  const review = await call('/reviews', {
    method: 'POST',
    token: student.data.token,
    body: { bookingId: id, rating: 5, comment: 'Great session' },
  });
  assert.equal(review.status, 201);

  const again = await call('/reviews', { method: 'POST', token: student.data.token, body: { bookingId: id, rating: 4 } });
  assert.equal(again.status, 409);

  const detail = await call(`/tutors/${tutor.data.user.id}`);
  assert.equal(detail.data.tutor.reviewCount, 1);
  assert.equal(detail.data.tutor.avgRating, 5);
  assert.equal(detail.data.reviews[0].studentName, 'Sid Student');

  const mine = await call('/bookings/mine', { token: student.data.token });
  assert.equal(mine.data.bookings[0].amountCents, 6000);
  assert.equal(mine.data.bookings[0].reviewed, true);
});

test('login rejects bad credentials and protects routes', async () => {
  assert.equal((await call('/auth/login', { method: 'POST', body: { email: 'nobody@test.com', password: 'x' } })).status, 401);
  assert.equal((await call('/bookings/mine')).status, 401);
});

test.after(() => server.close());
