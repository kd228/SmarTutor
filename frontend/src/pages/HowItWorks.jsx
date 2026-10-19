import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const FLOWS = {
  student: {
    label: 'For students',
    intro: 'From search to review in five steps.',
    steps: [
      ['Search and compare', 'Filter tutors by subject, price and rating, or browse courses. Every profile shows the tutor’s bio, rate and reviews from past students.'],
      ['Choose one session or a course', 'Book a single session for a date and length you pick, or enroll in a multi-week course and choose the day it starts. A course is a set number of sessions over several weeks, for one price.'],
      ['Pay online', 'You pay through Stripe Checkout. A course is paid once, up front, and its full schedule appears in your dashboard.'],
      ['Show up and learn', 'Your tutor marks each session done afterwards. For a course, your dashboard shows your progress session by session.'],
      ['Leave a review', 'You can review a single session once it is marked complete, or a course once every session is done. That keeps ratings honest.'],
    ],
    cta: { to: '/courses', text: 'Browse courses' },
    second: { to: '/tutors', text: 'Find a tutor' },
  },
  tutor: {
    label: 'For tutors',
    intro: 'From sign-up to your first review in five steps.',
    steps: [
      ['Create a tutor account', 'Sign up and choose “I want to tutor.”'],
      ['Build your profile', 'Add a headline, a bio, your subjects, a location and your hourly rate. You show up in tutor search once your headline and rate are set.'],
      ['Offer sessions and courses', 'Students can book single sessions at your hourly rate. You can also publish courses, such as 12 sessions over twelve weeks, and set your own price for the whole course.'],
      ['Teach and mark sessions done', 'After each session, mark it done in your dashboard. Course sessions are marked in order, once they have started.'],
      ['Build your reputation', 'Each finished session or course lets the student leave a review. Your average rating shows on your profile and in search.'],
    ],
    cta: { to: '/register', text: 'Create a tutor profile' },
    second: null,
  },
};

const FAQ = [
  ['Who can leave a review?', 'Only a student whose session or course was marked complete, and only once for each.'],
  ['Can I cancel?', 'You can cancel while a booking or enrollment is waiting for payment. Cancelling after you have paid is not available in the app yet.'],
  ['How much does it cost?', 'Tutors set their own hourly rate and their own course prices. The total you see before paying is what you pay.'],
  ['Can I reschedule a course session?', 'Not in the app yet. Course sessions are scheduled automatically from the start date you choose.'],
];

export default function HowItWorks() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = params.get('for') === 'tutor' ? 'tutor' : 'student';
  const flow = FLOWS[role];

  const choose = (next) => setParams(next === 'tutor' ? { for: 'tutor' } : {}, { replace: true });

  // Tutors who already have an account go straight to managing their courses.
  const cta = role === 'tutor' && user?.role === 'tutor' ? { to: '/my-courses', text: 'Create a course' } : flow.cta;
  const second = role === 'tutor' && user?.role === 'tutor' ? { to: '/profile/edit', text: 'Edit your profile' } : flow.second;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">How SmarTutor works</h1>
        <p className="lede">{flow.intro}</p>
        <div className="segmented" role="tablist" aria-label="Choose your role">
          {Object.entries(FLOWS).map(([key, f]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={role === key}
              aria-controls="how-panel"
              className={role === key ? 'seg on' : 'seg'}
              onClick={() => choose(key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div id="how-panel" role="tabpanel" aria-labelledby={`tab-${role}`}>
        <ol className="steps">
          {flow.steps.map(([title, body], i) => (
            <li key={title} className="step">
              <span className="step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h2 className="step-title">{title}</h2>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="cta-row steps-cta">
          <Link to={cta.to} className="btn big">{cta.text}</Link>
          {second && <Link to={second.to} className="btn big ghost">{second.text}</Link>}
        </div>
      </div>

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-title">Good to know</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
