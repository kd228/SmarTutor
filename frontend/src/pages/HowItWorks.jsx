import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const FLOWS = {
  student: {
    label: 'For students',
    intro: 'From search to review in five steps.',
    steps: [
      ['Search and compare', 'Filter by subject, price and rating. Every profile shows the tutor’s bio, rate and reviews from past students.'],
      ['Pick a time', 'Choose a date and a length from 30 to 120 minutes, and tell the tutor what you want to work on.'],
      ['Pay online', 'You pay through Stripe Checkout. Your booking is confirmed once the payment goes through.'],
      ['Have your session', 'When it’s done, your tutor marks it complete in their dashboard.'],
      ['Leave a review', 'Rate the session and write a few lines. Reviews unlock only after a session is marked complete, which keeps ratings honest.'],
    ],
    cta: { to: '/tutors', text: 'Find a tutor' },
  },
  tutor: {
    label: 'For tutors',
    intro: 'From sign-up to your first review in five steps.',
    steps: [
      ['Create a tutor account', 'Sign up and choose “I want to tutor.”'],
      ['Build your profile', 'Add a headline, a bio, your subjects, a location and your hourly rate. You show up in search once your headline and rate are set.'],
      ['Get booked', 'Students pick a time and pay online. New bookings appear in your dashboard.'],
      ['Mark sessions complete', 'After each paid session, mark it complete in your dashboard.'],
      ['Build your reputation', 'Each completed session lets the student leave a review. Your average rating shows on your profile and in search.'],
    ],
    cta: { to: '/register', text: 'Create a tutor profile' },
  },
};

const FAQ = [
  ['Who can leave a review?', 'Only a student whose session was marked complete, and only once per session.'],
  ['Can I cancel a booking?', 'You can cancel while a booking is waiting for payment. Cancelling after you have paid is not available in the app yet.'],
  ['How much does a session cost?', 'Tutors set their own hourly rate. The total you see when booking is that rate for the length you choose.'],
];

export default function HowItWorks() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const role = params.get('for') === 'tutor' ? 'tutor' : 'student';
  const flow = FLOWS[role];

  const choose = (next) => setParams(next === 'tutor' ? { for: 'tutor' } : {}, { replace: true });

  // Tutors who already have an account don't need the sign-up call to action.
  const cta = role === 'tutor' && user ? { to: '/profile/edit', text: 'Edit your profile' } : flow.cta;

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
