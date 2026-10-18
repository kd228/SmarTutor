import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

// Stand-in for Stripe Checkout, used only when the backend has no STRIPE_SECRET_KEY.
export default function MockCheckout() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const pay = async () => {
    try {
      await api(`/bookings/${bookingId}/mock-pay`, { method: 'POST' });
      navigate(`/dashboard?paid=${bookingId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card narrow">
      <h1>Test checkout</h1>
      <p className="muted">
        Stripe is not configured, so no real payment is taken. Add STRIPE_SECRET_KEY to the backend
        environment to switch to real checkout.
      </p>
      {error && <p className="error">{error}</p>}
      <button className="btn" onClick={pay}>Simulate successful payment</button>
    </div>
  );
}
