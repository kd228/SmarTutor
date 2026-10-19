import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, dollars, formatWhen } from '../api.js';
import { useAuth } from '../auth.jsx';
import ReviewForm from '../components/ReviewForm.jsx';

const STATUS_LABEL = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  active: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function EnrollmentCard({ enrollment: e, isTutor, onChanged, onError }) {
  const [reviewing, setReviewing] = useState(false);
  const post = async (path) => {
    try {
      await api(path, { method: 'POST' });
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  // Sessions must be marked in order, so only the first unfinished one can be marked.
  const nextId = e.nextSession?.id;
  const started = e.nextSession && new Date(e.nextSession.scheduledAt) <= new Date();
  const percent = e.totalSessions ? (e.completedSessions / e.totalSessions) * 100 : 0;

  return (
    <div className="card enrollment">
      <div className="enrollment-head">
        <div>
          <h3>{e.courseTitle}</h3>
          <p>
            {isTutor ? e.studentName : <Link to={`/tutors/${e.tutorId}`}>{e.tutorName}</Link>}, {dollars(e.amountCents)}
          </p>
          <span className={`pill ${e.status}`}>{STATUS_LABEL[e.status]}</span>
        </div>
        <div className="actions">
          {e.status === 'pending_payment' && (
            <button className="btn small ghost" onClick={() => post(`/enrollments/${e.id}/cancel`)}>Cancel</button>
          )}
          {!isTutor && e.status === 'completed' && !e.reviewed && (
            <button className="btn small" onClick={() => setReviewing(true)}>Review course</button>
          )}
          {!isTutor && e.reviewed && <span className="muted">Reviewed</span>}
        </div>
      </div>

      {e.status === 'pending_payment' && (
        <p className="muted">
          Not paid yet. Starts {formatWhen(e.startsAt)}. If you closed checkout, enroll again from the course page.
        </p>
      )}

      {e.totalSessions > 0 && e.status !== 'pending_payment' && (
        <>
          <div
            className="progress"
            role="progressbar"
            aria-label="Sessions completed"
            aria-valuemin={0}
            aria-valuemax={e.totalSessions}
            aria-valuenow={e.completedSessions}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="muted">{e.completedSessions} of {e.totalSessions} sessions done</p>
          <details className="session-list">
            <summary>Session schedule</summary>
            <ol>
              {e.sessions.map((s) => (
                <li key={s.id}>
                  <span>Session {s.number}: {formatWhen(s.scheduledAt)}</span>
                  {s.status === 'completed' && <span className="session-done">Done</span>}
                  {isTutor && s.id === nextId && e.status === 'active' && (
                    <button
                      className="btn small"
                      disabled={!started}
                      title={started ? undefined : 'Available once the session has started'}
                      onClick={() => post(`/enrollments/sessions/${s.id}/complete`)}
                    >
                      Mark done
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}

      {reviewing && (
        <ReviewForm target={{ enrollmentId: e.id }} onDone={() => { setReviewing(false); onChanged(); }} />
      )}
    </div>
  );
}

function BookingCard({ booking: b, isTutor, onChanged, onError }) {
  const [reviewing, setReviewing] = useState(false);
  const post = async (path) => {
    try {
      await api(path, { method: 'POST' });
      onChanged();
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <div className="card booking">
      <div>
        <h3>{isTutor ? b.studentName : <Link to={`/tutors/${b.tutorId}`}>{b.tutorName}</Link>}</h3>
        <p>{formatWhen(b.scheduledAt)}, {b.durationMinutes} min, {dollars(b.amountCents)}</p>
        {b.notes && <p className="muted prewrap">{b.notes}</p>}
        <span className={`pill ${b.status}`}>{STATUS_LABEL[b.status]}</span>
      </div>
      <div className="actions">
        {isTutor && b.status === 'paid' && (
          <button className="btn small" onClick={() => post(`/bookings/${b.id}/complete`)}>Mark completed</button>
        )}
        {b.status === 'pending_payment' && (
          <button className="btn small ghost" onClick={() => post(`/bookings/${b.id}/cancel`)}>Cancel</button>
        )}
        {!isTutor && b.status === 'completed' && !b.reviewed && (
          <button className="btn small" onClick={() => setReviewing(true)}>Leave a review</button>
        )}
        {!isTutor && b.reviewed && <span className="muted">Reviewed</span>}
      </div>
      {reviewing && (
        <ReviewForm target={{ bookingId: b.id }} onDone={() => { setReviewing(false); onChanged(); }} />
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [bookings, setBookings] = useState(null);
  const [enrollments, setEnrollments] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api('/bookings/mine'), api('/enrollments/mine')])
      .then(([b, e]) => {
        setBookings(b.bookings);
        setEnrollments(e.enrollments);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const isTutor = user.role === 'tutor';
  const loading = !error && (bookings === null || enrollments === null);
  const empty = bookings?.length === 0 && enrollments?.length === 0;

  return (
    <>
      <h1>{isTutor ? 'Your teaching' : 'Your learning'}</h1>
      {params.get('paid') && (
        <p className="success">Payment received. If the booking still says Awaiting payment, refresh in a few seconds.</p>
      )}
      {params.get('enrolled') && (
        <p className="success">Payment received. If the course still says Awaiting payment, refresh in a few seconds.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {empty && (
        <p className="muted">
          {isTutor
            ? <>Nothing yet. Make sure your profile is complete, then <Link to="/my-courses">publish a course</Link>.</>
            : <>Nothing yet. <Link to="/courses">Browse courses</Link> or <Link to="/tutors">find a tutor</Link>.</>}
        </p>
      )}

      {enrollments?.length > 0 && (
        <>
          <h2 className="section-sub">Courses</h2>
          <div className="list">
            {enrollments.map((e) => (
              <EnrollmentCard key={e.id} enrollment={e} isTutor={isTutor} onChanged={load} onError={setError} />
            ))}
          </div>
        </>
      )}

      {bookings?.length > 0 && (
        <>
          <h2 className="section-sub">Single sessions</h2>
          <div className="list">
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} isTutor={isTutor} onChanged={load} onError={setError} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
