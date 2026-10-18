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

  return (
    <>
      <h1>{isTutor ? 'Your sessions' : 'Your bookings'}</h1>
      {params.get('paid') && <p className="success">Payment received. Your session is booked.</p>}
      {error && <p className="error">{error}</p>}
      {bookings.length === 0 && (
        <p className="muted">
          {isTutor ? 'No bookings yet. Make sure your profile is complete.' : <>No bookings yet. <Link to="/">Find a tutor</Link>.</>}
        </p>
      )}
      <div className="list">
        {bookings.map((b) => (
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
        ))}
      </div>
    </>
  );
}
