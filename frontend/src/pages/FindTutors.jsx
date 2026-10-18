import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import TutorRow from '../components/TutorRow.jsx';

export default function FindTutors() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ q: params.get('q') || '', subject: '', maxRate: '', sort: '' });
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && query.set(k, v));
    setLoading(true);
    const timer = setTimeout(() => {
      api(`/tutors?${query}`)
        .then((d) => { setTutors(d.tutors); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Find a tutor</h1>
        <p className="lede">Search by name or topic, then narrow by subject and price.</p>
      </header>

      <div className="filters" role="search">
        <input aria-label="Search by name or topic" placeholder="Search by name or topic" value={filters.q} onChange={set('q')} />
        <input aria-label="Subject" placeholder="Subject (e.g. Calculus)" value={filters.subject} onChange={set('subject')} />
        <input aria-label="Maximum hourly rate" type="number" min="0" placeholder="Max $/hour" value={filters.maxRate} onChange={set('maxRate')} />
        <select aria-label="Sort results" value={filters.sort} onChange={set('sort')}>
          <option value="">Top rated</option>
          <option value="reviews">Most reviewed</option>
          <option value="price">Lowest price</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}
      {!loading && !error && tutors.length === 0 && (
        <p className="muted">No tutors match those filters. Try a broader search.</p>
      )}

      <div className="tutor-list">
        {tutors.map((t) => <TutorRow key={t.id} tutor={t} />)}
      </div>
    </>
  );
}
