import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, dollars } from '../api.js';
import { useAuth } from '../auth.jsx';
import Stars from '../components/Stars.jsx';

function defaultSlot() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function TutorProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ scheduledAt: defaultSlot(), durationMinutes: 60, notes: '' });
  const [busy, setBusy] = useState(false);
  const [packageStartDate, setPackageStartDate] = useState(defaultSlot());
  const [busyPackage, setBusyPackage] = useState(null);

  useEffect(() => {
    api(`/tutors/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error && !data) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { tutor, reviews, packages = [] } = data;
  const total = Math.round((tutor.hourlyRateCents * form.durationMinutes) / 60);

  const bookSession = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    setBusy(true); setError('');
    try {
      const res = await api('/bookings', {
        method: 'POST',
        body: { tutorId: tutor.id, scheduledAt: new Date(form.scheduledAt).toISOString(), durationMinutes: Number(form.durationMinutes), notes: form.notes },
      });
      if (res.mock) navigate(`/checkout/mock/${res.bookingId}`);
      else window.location.href = res.checkoutUrl;
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const bookPackage = async (pkg) => {
    if (!user) return navigate('/login');
    setBusyPackage(pkg.id); setError('');
    try {
      const res = await api('/bookings/package', {
        method: 'POST',
        body: { packageId: pkg.id, startDate: new Date(packageStartDate).toISOString() },
      });
      if (res.mock) navigate(`/checkout/mock/${res.bookingId}`);
      else window.location.href = res.checkoutUrl;
    } catch (err) { setError(err.message); setBusyPackage(null); }
  };

  return (
    <div className="profile-layout">
      <section>
        <div className="profile-head">
          <div className="avatar big">{tutor.name[0]}</div>
          <div>
            <h1>{tutor.name}</h1>
            <p className="headline">{tutor.headline}</p>
            <Stars rating={tutor.avgRating} count={tutor.reviewCount} />
            {tutor.location && <p className="muted">{tutor.location}</p>}
          </div>
        </div>
        <h2>About</h2>
        <p className="prewrap">{tutor.bio || 'This tutor has not added a bio yet.'}</p>
        <p className="tags">{tutor.subjects.map((s) => <span key={s} className="tag">{s}</span>)}</p>

        {packages.length > 0 && (
          <>
            <h2>Course Packages</h2>
            <p className="muted">Book a series of sessions to help you through an entire course.</p>
            <div className="package-list">
              {packages.map((pkg) => (
                <div key={pkg.id} className="card package-card">
                  <div className="package-head">
                    <h3>{pkg.title}</h3>
                    <span className="package-price">{dollars(pkg.price_cents)}</span>
                  </div>
                  <p className="muted">{pkg.subject} · {pkg.sessions_count} sessions · {pkg.duration_minutes} min each</p>
                  <p>{pkg.description}</p>
                  {user?.role === 'student' && (
                    <div className="package-book-form">
                      <label>First session date
                        <input type="datetime-local" required value={packageStartDate} onChange={(e) => setPackageStartDate(e.target.value)} />
                      </label>
                      <button className="btn small" onClick={() => bookPackage(pkg)} disabled={busyPackage === pkg.id}>
                        {busyPackage === pkg.id ? 'Starting checkout…' : 'Book Package'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <h2>Reviews ({reviews.length})</h2>
        {reviews.length === 0 && <p className="muted">No reviews yet. Reviews come from students after completed sessions.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <Stars rating={r.rating} />
            <p className="prewrap">{r.comment || 'No written comment.'}</p>
            <p className="muted">{r.studentName} · {new Date(r.createdAt + 'Z').toLocaleDateString()}</p>
          </article>
        ))}
      </section>

      <aside className="card booking-box">
        <div className="price">{dollars(tutor.hourlyRateCents)}<small>/hr</small></div>
        {user?.role === 'tutor' ? (
          <p className="muted">Sign in with a student account to book sessions.</p>
        ) : (
          <form onSubmit={bookSession}>
            <h3>Book a single session</h3>
            <label>Date and time
              <input type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </label>
            <label>Length
              <select value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}>
                {[30, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </label>
            <label>What would you like help with?
              <textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" disabled={busy}>
              {busy ? 'Starting checkout…' : `Book and pay ${dollars(total)}`}
            </button>
            {!user && <p className="muted">You will be asked to log in first.</p>}
          </form>
        )}
      </aside>
    </div>
  );
}
