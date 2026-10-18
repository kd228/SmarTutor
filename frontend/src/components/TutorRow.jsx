import { Link } from 'react-router-dom';
import { dollars } from '../api.js';
import Stars from './Stars.jsx';

// One tutor as a clickable row. `compact` is the dark variant used inside the home page finder.
export default function TutorRow({ tutor, compact = false }) {
  return (
    <Link to={`/tutors/${tutor.id}`} className={compact ? 'tutor-row compact' : 'tutor-row'}>
      <span className="avatar">{tutor.name[0]}</span>
      <span className="tutor-main">
        <span className="tutor-name">{tutor.name}</span>
        <span className="tutor-headline">{tutor.headline}</span>
        <Stars rating={tutor.avgRating} count={tutor.reviewCount} />
        {!compact && tutor.subjects.length > 0 && (
          <span className="tags">
            {tutor.subjects.slice(0, 5).map((s) => (
              <span key={s} className="tag">{s}</span>
            ))}
          </span>
        )}
      </span>
      <span className="price">
        {dollars(tutor.hourlyRateCents)}
        <small>/hr</small>
      </span>
    </Link>
  );
}
