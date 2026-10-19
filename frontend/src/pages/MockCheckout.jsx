import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

// Stand-in for Stripe Checkout, used only when the backend has no STRIPE_SECRET_KEY.
// `kind` is "booking" for a single session or "course" for a course enrollment.
export default function MockCheckout({ kind = 'booking' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/${kind === 'course' ? 'enrollments' : 'bookings'}/${id}/mock-pay`, { method: 'POST' });
      navigate(kind === 'course' ? `/dashboard?enrolled=${id}` : `/dashboard?paid=${id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="card narrow">
      <h1>Test checkout</h1>
      <p className="muted">
        Stripe is not set up on this server, so no real payment is taken. Add STRIPE_SECRET_KEY to the backend
        environment to switch to real checkout.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" onClick={pay} disabled={busy}>
        {busy ? 'Confirming…' : 'Simulate successful payment'}
      </button>
    </div>
  );
}
