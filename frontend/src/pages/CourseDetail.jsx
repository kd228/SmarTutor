import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, browserTimeZone, dollars, formatWhen } from '../api.js';
import { useAuth } from '../auth.jsx';
import { courseCadence, courseLength } from '../courseText.js';
import { previewSchedule } from '../schedule.js';
import Stars from '../components/Stars.jsx';

// Default start: one week from now, on the hour, in the format <input type="datetime-local"> expects.
function defaultStart() {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/courses/${id}`).then((d) => setCourse(d.course)).catch((e) => setError(e.message));
  }, [id, user?.id]);

  if (error && !course) return <p className="error">{error}</p>;
  if (!course) return <p className="muted">Loading…</p>;

  const dates = previewSchedule(startsAt, course.totalSessions, course.sessionsPerWeek);
  const isOwner = user?.id === course.tutorId;

  const enroll = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: location.pathname } });
    setBusy(true);
    setError('');
    try {
      const res = await api('/enrollments', {
        method: 'POST',
        body: { courseId: course.id, startsAt: new Date(startsAt).toISOString(), timeZone: browserTimeZone() },
      });
      if (res.mock) navigate(`/checkout/mock-course/${res.enrollmentId}`);
      else window.location.href = res.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="profile-layout">
      <section>
        <header className="page-head tight">
          <h1 className="page-title">{course.title}</h1>
          <p className="headline">
            Taught by <Link to={`/tutors/${course.tutorId}`}>{course.tutorName}</Link>{' '}
            <Stars rating={course.tutorRating ?? 0} count={course.tutorReviewCount ?? 0} />
          </p>
          {course.status === 'archived' && <p className="muted">This course is archived. Only you can see it.</p>}
        </header>

        <dl className="facts">
          <div><dt>Length</dt><dd>{courseLength(course)}</dd></div>
          <div><dt>Pace</dt><dd>{courseCadence(course)}</dd></div>
          <div><dt>Price</dt><dd>{dollars(course.priceCents)} in total, about {dollars(course.perSessionCents)} a session</dd></div>
          {course.subject && <div><dt>Subject</dt><dd>{course.subject}</dd></div>}
        </dl>

        <h2>About this course</h2>
        <p className="prewrap">{course.description || 'The tutor has not added a description yet.'}</p>
      </section>

      <aside className="card booking-box">
        <h2 className="box-title">Enroll in this course</h2>
        <div className="price">{dollars(course.priceCents)}</div>

        {isOwner ? (
          <p className="muted">This is your course. <Link to="/my-courses">Manage your courses</Link></p>
        ) : user?.role === 'tutor' ? (
          <p className="muted">Log in with a student account to enroll.</p>
        ) : (
          <form onSubmit={enroll}>
            <label>First session
              <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>

            {dates.length > 0 && (
              <div className="schedule-preview">
                <p className="muted">Your sessions</p>
                <ol>
                  {dates.slice(0, 3).map((d, i) => <li key={i}>{formatWhen(d)}</li>)}
                  {dates.length > 4 && <li className="more">and {dates.length - 4} more</li>}
                  {dates.length > 3 && <li>{formatWhen(dates[dates.length - 1])}</li>}
                </ol>
                <p className="muted">Times are in your time zone ({browserTimeZone()}).</p>
              </div>
            )}

            {params.get('cancelled') && <p className="muted">Payment cancelled. You have not been charged.</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn" disabled={busy}>
              {busy ? 'Starting checkout…' : `Enroll and pay ${dollars(course.priceCents)}`}
            </button>
            {!user && <p className="muted">You will be asked to log in first.</p>}
          </form>
        )}
      </aside>
    </div>
  );
}
