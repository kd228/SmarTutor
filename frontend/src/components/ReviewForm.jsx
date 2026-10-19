import { useState } from 'react';
import { api } from '../api.js';

// `target` is { bookingId } for a single session or { enrollmentId } for a whole course.
export default function ReviewForm({ target, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/reviews', { method: 'POST', body: { ...target, rating, comment } });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <label>Rating
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 && 's'}</option>)}
        </select>
      </label>
      <textarea
        rows="2"
        aria-label="Your review"
        placeholder="How did it go?"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn small" disabled={busy}>{busy ? 'Saving…' : 'Submit review'}</button>
    </form>
  );
}
