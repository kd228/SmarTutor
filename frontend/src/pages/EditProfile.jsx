import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function EditProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ headline: '', bio: '', subjects: '', hourlyRate: '', location: '' });
  const [status, setStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    api('/tutors/me/profile').then(({ tutor }) =>
      setForm({
        headline: tutor.headline,
        bio: tutor.bio,
        subjects: tutor.subjects.join(', '),
        hourlyRate: tutor.hourlyRateCents ? tutor.hourlyRateCents / 100 : '',
        location: tutor.location,
      })
    ).catch((e) => setStatus({ type: 'error', text: e.message }));
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setStatus({ type: '', text: '' });
    try {
      await api('/tutors/me/profile', {
        method: 'PUT',
        body: { ...form, subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean) },
      });
      setStatus({ type: 'ok', text: 'Profile saved. Students can now find you.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  return (
    <form className="card narrow" onSubmit={save}>
      <h1>Your tutor profile</h1>
      <label>Headline
        <input required maxLength={120} placeholder="e.g. Calculus and Physics tutor, Rice grad"
          value={form.headline} onChange={set('headline')} />
      </label>
      <label>About you
        <textarea rows="6" value={form.bio} onChange={set('bio')}
          placeholder="Your experience, teaching style, and who you work best with." />
      </label>
      <label>Subjects (comma separated)
        <input placeholder="Calculus, Physics, SAT Math" value={form.subjects} onChange={set('subjects')} />
      </label>
      <label>Hourly rate (USD)
        <input type="number" min="5" max="500" step="1" required value={form.hourlyRate} onChange={set('hourlyRate')} />
      </label>
      <label>Location
        <input placeholder="City, or Online" value={form.location} onChange={set('location')} />
      </label>
      {status.text && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}
      <button className="btn">Save profile</button>
      <p className="muted"><Link to={`/tutors/${user.id}`}>View your public profile</Link></p>
    </form>
  );
}
