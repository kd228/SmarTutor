import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import CourseCard from '../components/CourseCard.jsx';

export default function Courses() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ q: '', subject: '', maxPrice: '', sort: '' });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && query.set(k, v));
    setLoading(true);
    const timer = setTimeout(() => {
      api(`/courses?${query}`)
        .then((d) => { setCourses(d.courses); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Courses</h1>
        <p className="lede">
          Work with one tutor over several weeks. You pay once, and every session is tracked in your dashboard.
        </p>
      </header>

      <div className="filters" role="search">
        <input aria-label="Search courses" placeholder="Search by course, subject or tutor" value={filters.q} onChange={set('q')} />
        <input aria-label="Subject" placeholder="Subject (e.g. Calculus)" value={filters.subject} onChange={set('subject')} />
        <input aria-label="Maximum price" type="number" min="0" placeholder="Max price ($)" value={filters.maxPrice} onChange={set('maxPrice')} />
        <select aria-label="Sort results" value={filters.sort} onChange={set('sort')}>
          <option value="">Best rated tutor</option>
          <option value="price">Lowest price</option>
          <option value="length">Most sessions</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Searching…</p>}
      {!loading && !error && courses.length === 0 && (
        <div className="empty">
          <p className="muted">No courses match yet.</p>
          {user?.role === 'tutor'
            ? <Link to="/my-courses" className="btn small">Create the first one</Link>
            : <Link to="/tutors" className="btn small ghost">Find a tutor for single sessions</Link>}
        </div>
      )}

      <div className="course-list">
        {courses.map((c) => <CourseCard key={c.id} course={c} />)}
      </div>
    </>
  );
}
