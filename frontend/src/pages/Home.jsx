import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dollars } from '../api.js';
import Stars from '../components/Stars.jsx';

export default function Home() {
  const [filters, setFilters] = useState({ q: '', subject: '', maxRate: '', sort: '' });
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    setLoading(true);
    const timer = setTimeout(() => {
      api(`/tutors?${params}`)
        .then((d) => { setTutors(d.tutors); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <section className="hero">
        <h1>Find the right tutor for you</h1>
        <p>Browse independent tutors, read real reviews, and book and pay securely.</p>
        <div className="filters">
          <input placeholder="Search by name or topic" value={filters.q} onChange={set('q')} />
          <input placeholder="Subject (e.g. Calculus)" value={filters.subject} onChange={set('subject')} />
          <input type="number" min="0" placeholder="Max $/hour" value={filters.maxRate} onChange={set('maxRate')} />
          <select value={filters.sort} onChange={set('sort')}>
            <option value="">Top rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="price">Lowest price</option>
          </select>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}
      {!loading && !error && tutors.length === 0 && <p className="muted">No tutors match those filters yet.</p>}

      <div className="grid">
        {tutors.map((t) => (
          <Link key={t.id} to={`/tutors/${t.id}`} className="card tutor-card">
            <div className="avatar">{t.name[0]}</div>
            <div>
              <h3>{t.name}</h3>
              <p className="headline">{t.headline}</p>
              <Stars rating={t.avgRating} count={t.reviewCount} />
              <p className="tags">{t.subjects.slice(0, 4).map((s) => <span key={s} className="tag">{s}</span>)}</p>
            </div>
            <div className="price">{dollars(t.hourlyRateCents)}<small>/hr</small></div>
          </Link>
        ))}
      </div>
    </>
  );
}
