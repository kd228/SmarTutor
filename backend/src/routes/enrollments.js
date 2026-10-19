import { Router } from 'express';
import { one, query, transaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { clientUrl, mockPaymentsAllowed, paymentsUnavailable, stripe } from '../stripe.js';
import { feeFor, parseId, validTimeZone, wrap } from '../util.js';

const router = Router();

// Builds the schedule for a new enrollment in the student's own time zone, so a 5 PM class stays at
// 5 PM across daylight saving changes. Sessions per week land on days 0 | 0,3 | 0,2,4 of each week.
const SCHEDULE_SQL = `
  insert into course_sessions (enrollment_id, session_number, scheduled_at)
  select $1::int, n + 1,
    (
      ($2::timestamptz at time zone $3::text)
      + make_interval(days => (n / $4::int) * 7 + case
          when $4::int = 1 then 0
          when $4::int = 2 then (case when n % 2 = 0 then 0 else 3 end)
          else (case n % 3 when 0 then 0 when 1 then 2 else 4 end)
        end)
    ) at time zone $3::text
  from generate_series(0, $5::int - 1) as n
`;

// Student enrolls in a course and gets a payment URL back
router.post('/', requireAuth, requireRole('student'), wrap(async (req, res) => {
  const courseId = parseId(req.body?.courseId);
  const startsAt = new Date(req.body?.startsAt);
  const timeZone = String(req.body?.timeZone || 'UTC');

  if (!courseId) return res.status(400).json({ error: 'Choose a course' });
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Pick a start date and time in the future' });
  }
  if (!validTimeZone(timeZone)) return res.status(400).json({ error: 'Unknown time zone' });

  const course = await one("select * from courses where id = $1 and status = 'active'", [courseId]);
  if (!course) return res.status(404).json({ error: 'Course not available' });
  if (!stripe() && !mockPaymentsAllowed()) return paymentsUnavailable(res);

  const already = await one(
    "select 1 as found from enrollments where course_id = $1 and student_id = $2 and status = 'active'",
    [course.id, req.user.id]
  );
  if (already) return res.status(409).json({ error: 'You are already enrolled in this course' });

  const enrollmentId = await transaction(async (tx) => {
    // An abandoned checkout for this course is replaced by the new one.
    await tx.query(
      "update enrollments set status = 'cancelled' where course_id = $1 and student_id = $2 and status = 'pending_payment'",
      [course.id, req.user.id]
    );
    const created = await tx.one(
      `insert into enrollments (course_id, student_id, tutor_id, starts_at, amount_cents, platform_fee_cents)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [course.id, req.user.id, course.tutor_id, startsAt.toISOString(), course.price_cents, feeFor(course.price_cents)]
    );
    await tx.query(SCHEDULE_SQL, [
      created.id, startsAt.toISOString(), timeZone, course.sessions_per_week, course.total_sessions,
    ]);
    return created.id;
  });

  const client = stripe();
  if (!client) {
    return res.status(201).json({
      enrollmentId, mock: true, checkoutUrl: `${clientUrl()}/checkout/mock-course/${enrollmentId}`,
    });
  }

  try {
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: course.price_cents,
            product_data: {
              name: `${course.title} (${course.total_sessions} sessions)`,
              ...(course.subject ? { description: course.subject } : {}),
            },
          },
        },
      ],
      metadata: { enrollmentId: String(enrollmentId) },
      success_url: `${clientUrl()}/dashboard?enrolled=${enrollmentId}`,
      cancel_url: `${clientUrl()}/courses/${course.id}?cancelled=1`,
    });
    await query('update enrollments set stripe_session_id = $1 where id = $2', [session.id, enrollmentId]);
    res.status(201).json({ enrollmentId, mock: false, checkoutUrl: session.url });
  } catch (err) {
    await query("update enrollments set status = 'cancelled' where id = $1", [enrollmentId]);
    console.error('Stripe error:', err.message);
    res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
}));

// Enrollments for the signed-in user, each with its schedule and progress
router.get('/mine', requireAuth, wrap(async (req, res) => {
  const column = req.user.role === 'tutor' ? 'e.tutor_id' : 'e.student_id';
  const rows = await query(
    `select e.id, e.course_id as "courseId", e.tutor_id as "tutorId", e.student_id as "studentId",
            e.starts_at as "startsAt", e.amount_cents as "amountCents", e.status, e.created_at as "createdAt",
            c.title as "courseTitle", c.session_minutes as "sessionMinutes", c.sessions_per_week as "sessionsPerWeek",
            t.name as "tutorName", s.name as "studentName",
            exists (select 1 from reviews r where r.enrollment_id = e.id) as reviewed
     from enrollments e
     join courses c on c.id = e.course_id
     join users t on t.id = e.tutor_id
     join users s on s.id = e.student_id
     where ${column} = $1 and e.status <> 'cancelled'
     order by e.created_at desc`,
    [req.user.id]
  );

  const sessions = rows.length
    ? await query(
        `select id, enrollment_id as "enrollmentId", session_number as number,
                scheduled_at as "scheduledAt", status, completed_at as "completedAt"
         from course_sessions where enrollment_id = any($1::int[])
         order by enrollment_id, session_number`,
        [rows.map((r) => r.id)]
      )
    : [];

  const byEnrollment = new Map();
  for (const s of sessions) {
    if (!byEnrollment.has(s.enrollmentId)) byEnrollment.set(s.enrollmentId, []);
    byEnrollment.get(s.enrollmentId).push(s);
  }

  res.json({
    enrollments: rows.map((r) => {
      const list = byEnrollment.get(r.id) || [];
      return {
        ...r,
        sessions: list,
        totalSessions: list.length,
        completedSessions: list.filter((s) => s.status === 'completed').length,
        nextSession: list.find((s) => s.status === 'scheduled') || null,
      };
    }),
  });
}));

// Tutor marks the next session of an active enrollment as taught
router.post('/sessions/:sessionId/complete', requireAuth, requireRole('tutor'), wrap(async (req, res) => {
  const sessionId = parseId(req.params.sessionId);
  if (!sessionId) return res.status(404).json({ error: 'Session not found' });

  const outcome = await transaction(async (tx) => {
    const s = await tx.one(
      `select s.id, s.enrollment_id, s.scheduled_at, s.status, e.tutor_id, e.status as enrollment_status
       from course_sessions s join enrollments e on e.id = s.enrollment_id
       where s.id = $1 for update of s`,
      [sessionId]
    );
    if (!s || s.tutor_id !== req.user.id) return { status: 404, error: 'Session not found' };
    if (s.enrollment_status !== 'active') return { status: 409, error: 'This course is not active' };
    if (s.status !== 'scheduled') return { status: 409, error: 'This session is already marked complete' };

    const earlier = await tx.one(
      `select 1 as found from course_sessions
       where enrollment_id = $1 and status = 'scheduled' and session_number <
         (select session_number from course_sessions where id = $2)`,
      [s.enrollment_id, s.id]
    );
    if (earlier) return { status: 409, error: 'Mark the earlier sessions complete first' };
    if (new Date(s.scheduled_at).getTime() > Date.now()) {
      return { status: 409, error: 'This session has not started yet' };
    }

    await tx.query("update course_sessions set status = 'completed', completed_at = now() where id = $1", [s.id]);
    const left = await tx.one(
      "select count(*)::int as remaining from course_sessions where enrollment_id = $1 and status = 'scheduled'",
      [s.enrollment_id]
    );
    const courseCompleted = left.remaining === 0;
    if (courseCompleted) await tx.query("update enrollments set status = 'completed' where id = $1", [s.enrollment_id]);
    return { ok: true, courseCompleted };
  });

  if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
  res.json({ ok: true, courseCompleted: outcome.courseCompleted });
}));

// Mock payment confirmation (only available when Stripe is not configured)
router.post('/:id/mock-pay', requireAuth, requireRole('student'), wrap(async (req, res) => {
  if (!mockPaymentsAllowed()) return res.status(404).json({ error: 'Not found' });
  const id = parseId(req.params.id);
  const updated = id && (await one(
    "update enrollments set status = 'active' where id = $1 and student_id = $2 and status = 'pending_payment' returning id",
    [id, req.user.id]
  ));
  if (!updated) return res.status(409).json({ error: 'Enrollment not found or not awaiting payment' });
  res.json({ ok: true });
}));

// Either side can cancel an enrollment that has not been paid for
router.post('/:id/cancel', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const updated = id && (await one(
    `update enrollments set status = 'cancelled'
     where id = $1 and (student_id = $2 or tutor_id = $2) and status = 'pending_payment' returning id`,
    [id, req.user.id]
  ));
  if (!updated) return res.status(409).json({ error: 'Only enrollments awaiting payment can be cancelled' });
  res.json({ ok: true });
}));

export default router;
