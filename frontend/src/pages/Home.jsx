import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import TutorRow from '../components/TutorRow.jsx';

const TOPICS = ['Calculus', 'Physics', 'Python', 'Spanish', 'SAT', 'Writing'];

const ASSURANCES = [
  {
    title: 'Reviews from real sessions',
    body: 'Only students who finished a session with a tutor can review them, so every rating comes from a lesson that happened.',
  },
  {
    title: 'Prices up front',
    body: 'Each tutor lists an hourly rate, and you see the total for your session length before you pay.',
  },
  {
    title: 'Pay online',
    body: 'Checkout runs through Stripe, so there is no cash to hand over and no card number to give a tutor.',
  },
];

// Live preview of the marketplace: pick a topic, see the top tutors for it.
function TopicFinder() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [state, setState] = useState({ loading: true, tutors: [], error: '' });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, tutors: [], error: '' });
    api(`/tutors?q=${encodeURIComponent(topic)}`)
      .then((d) => { if (!cancelled) setState({ loading: false, tutors: d.tutors.slice(0, 3), error: '' }); })
      .catch((e) => { if (!cancelled) setState({ loading: false, tutors: [], error: e.message }); });
    return () => { cancelled = true; };
  }, [topic]);

  const { loading, tutors, error } = state;

  return (
    <section className="finder" aria-labelledby="finder-title">
      <h2 id="finder-title" className="finder-title">What do you need help with?</h2>
      <div className="chips" role="group" aria-label="Pick a topic">
        {TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            className={t === topic ? 'chip on' : 'chip'}
            aria-pressed={t === topic}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="finder-results" key={topic} aria-live="polite">
        {loading && <p className="finder-note">Looking for {topic} tutors…</p>}
        {error && <p className="finder-note">Could not load tutors: {error}</p>}
        {!loading && !error && tutors.length === 0 && (
          <p className="finder-note">
            No {topic} tutors yet. <Link to="/register">Be the first to teach it.</Link>
          </p>
        )}
        {tutors.map((t) => <TutorRow key={t.id} tutor={t} compact />)}
      </div>

      <Link className="finder-link" to={`/tutors?q=${encodeURIComponent(topic)}`}>
        See all {topic} tutors
      </Link>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1 className="display">Get unstuck with a tutor who&rsquo;s been there.</h1>
          <p className="lede">
            Book a single session or sign up for a multi-week course. Compare rates and reviews from real sessions before you pay.
          </p>
          <div className="cta-row">
            <Link to="/tutors" className="btn big">Find a tutor</Link>
            <Link to="/how-it-works" className="btn big ghost">See how it works</Link>
          </div>
        </div>
        <TopicFinder />
      </section>

      <section className="assurances" aria-labelledby="assure-title">
        <h2 id="assure-title" className="section-title">What you can count on</h2>
        <ul className="assure-list">
          {ASSURANCES.map((a) => (
            <li key={a.title} className="assure-item">
              <h3>{a.title}</h3>
              <p>{a.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="course-promo" aria-labelledby="course-title">
        <div>
          <h2 id="course-title" className="section-title">Stuck on a whole course? Work through it together.</h2>
          <p>
            Tutors offer courses that run for weeks, such as twelve sessions of Calculus I. You pay one price
            up front, and every session is tracked in your dashboard.
          </p>
        </div>
        <Link to="/courses" className="btn big">Browse courses</Link>
      </section>

      <section className="tutor-band" aria-labelledby="teach-title">
        <div className="tutor-band-copy">
          <h2 id="teach-title" className="section-title">Teach what you know.</h2>
          <p>Create a profile with your subjects, rate and bio, then offer single sessions or multi-week courses. Students find you, book and pay online.</p>
        </div>
        <div className="cta-row">
          {!user && <Link to="/register" className="btn big accent">Create a tutor profile</Link>}
          {user?.role === 'tutor' && <Link to="/my-courses" className="btn big accent">Create a course</Link>}
          <Link to="/how-it-works?for=tutor" className="btn big outline-light">How tutors get started</Link>
        </div>
      </section>
    </>
  );
}
