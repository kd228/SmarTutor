import { Link } from 'react-router-dom';
import { dollars } from '../api.js';
import { courseCadence, courseLength } from '../courseText.js';
import Stars from './Stars.jsx';

export default function CourseCard({ course, showTutor = true }) {
  return (
    <Link to={`/courses/${course.id}`} className="course-card">
      <span className="course-main">
        <span className="course-title">{course.title}</span>
        {showTutor && (
          <span className="course-tutor">
            with {course.tutorName}{' '}
            <Stars rating={course.tutorRating ?? 0} count={course.tutorReviewCount ?? 0} />
          </span>
        )}
        <span className="course-meta">{courseLength(course)}</span>
        <span className="course-sub">{courseCadence(course)}</span>
        {course.subject && (
          <span className="tags"><span className="tag">{course.subject}</span></span>
        )}
      </span>
      <span className="course-price">
        <span className="price">{dollars(course.priceCents)}</span>
        <span className="per-session">about {dollars(course.perSessionCents)} a session</span>
      </span>
    </Link>
  );
}
