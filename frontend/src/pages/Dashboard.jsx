import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, dollars } from '../api.js';
import { useAuth } from '../auth.jsx';

const STATUS_LABEL = {
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function ReviewForm({ bookingId, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/reviews', { method: 'POST', body: { bookingId, rating, comment } });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <label>Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 && 's'}</option>)}
        </select>
      </label>
      <textarea rows="2" placeholder="How did the session go?" value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn small">Submit review</button>
    </form>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/bookings/mine').then((d) => setBookings(d.bookings)).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const act = async (id, action) => {
    try {
      await api(`/bookings/${id}/${action}`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const isTutor = user.role === 'tutor';

  const grouped = [];
  const packageMap = {};

  bookings.forEach((b) => {
    if (b.packageId && !isTutor) {
      if (!packageMap[b.packageId]) {
        packageMap[b.packageId] = { ...b, sessions: [] };
        grouped.push(packageMap[b.packageId]);
      }
      packageMap[b.packageId].sessions.push(b);
    } else {
      grouped.push(b);
    }
  });

  return (
    <>
      <h1>{isTutor ? 'Your sessions' : 'Your bookings'}</h1>
      {params.get('paid') && <p className="success">Payment received. Your sessions are booked.</p>}
      {error && <p className="error">{error}</p>}
      {bookings.length === 0 && (
        <p className="muted">
          {isTutor ? 'No bookings yet. Make sure your profile is complete.' : <>No bookings yet. <Link to="/tutors">Find a tutor</Link>.</>}
        </p>
      )}
      <div className="list">
        {grouped.map((item) => {
          if (item.sessions) {
            const completedCount = item.sessions.filter(s => s.status === 'completed').length;
            const totalAmount = item.sessions.reduce((sum, s) => sum + s.amountCents, 0);
            const nextSession = item.sessions.find(s => s.status === 'paid') || item.sessions[0];

            return (
              <div key={`pkg-${item.packageId}`} className="card booking package-group">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link to={`/tutors/${item.tutorId}`}>{item.tutorName}</Link>
                    <span className="tag" style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#3730a3' }}>Course Package</span>
                  </h3>
                  <p className="muted">
                    {completedCount} of {item.sessions.length} sessions completed · Total: {dollars(totalAmount)}
                  </p>
                  
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {item.sessions.map(s => (
                      <div key={s.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #eee' }}>
                        <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                        <span className={`pill ${s.status}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{STATUS_LABEL[s.status]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  {nextSession && nextSession.status === 'completed' && !nextSession.reviewed && (
                    <button className="btn small" onClick={() => setReviewing(nextSession.id)}>Leave a review for next session</button>
                  )}
                </div>
                {reviewing === nextSession?.id && (
                  <ReviewForm bookingId={nextSession.id} onDone={() => { setReviewing(null); load(); }} />
                )}
              </div>
            );
          }

          const b = item;
          return (
            <div key={b.id} className="card booking">
              <div>
                <h3>{isTutor ? b.studentName : <Link to={`/tutors/${b.tutorId}`}>{b.tutorName}</Link>}</h3>
                <p>{new Date(b.scheduledAt).toLocaleString()} · {b.durationMinutes} min · {dollars(b.amountCents)}</p>
                {b.notes && <p className="muted prewrap">{b.notes}</p>}
                <span className={`pill ${b.status}`}>{STATUS_LABEL[b.status]}</span>
              </div>
              <div className="actions">
                {isTutor && b.status === 'paid' && (
                  <button className="btn small" onClick={() => act(b.id, 'complete')}>Mark completed</button>
                )}
                {b.status === 'pending_payment' && (
                  <button className="btn small ghost" onClick={() => act(b.id, 'cancel')}>Cancel</button>
                )}
                {!isTutor && b.status === 'completed' && !b.reviewed && (
                  <button className="btn small" onClick={() => setReviewing(b.id)}>Leave a review</button>
                )}
                {!isTutor && b.reviewed && <span className="muted">Reviewed</span>}
              </div>
              {reviewing === b.id && (
                <ReviewForm bookingId={b.id} onDone={() => { setReviewing(null); load(); }} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
