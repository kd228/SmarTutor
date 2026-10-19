import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dollars } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function EditProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ headline: '', bio: '', subjects: '', hourlyRate: '', location: '' });
  const [status, setStatus] = useState({ type: '', text: '' });
  const [packages, setPackages] = useState([]);
  const [pkgForm, setPkgForm] = useState({ title: '', subject: '', description: '', sessionsCount: 5, price: '' });
  const [pkgStatus, setPkgStatus] = useState({ type: '', text: '' });

  const loadPackages = () => {
    if (user?.id) api(`/tutors/${user.id}/packages`).then((res) => setPackages(res.packages));
  };

  useEffect(() => {
    api('/tutors/me/profile').then(({ tutor }) =>
      setForm({
        headline: tutor.headline, bio: tutor.bio, subjects: tutor.subjects.join(', '),
        hourlyRate: tutor.hourlyRateCents ? tutor.hourlyRateCents / 100 : '', location: tutor.location,
      })
    ).catch((e) => setStatus({ type: 'error', text: e.message }));
    loadPackages();
  }, [user]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setPkg = (key) => (e) => setPkgForm({ ...pkgForm, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault(); setStatus({ type: '', text: '' });
    try {
      await api('/tutors/me/profile', { method: 'PUT', body: { ...form, subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean) } });
      setStatus({ type: 'ok', text: 'Profile saved. Students can now find you.' });
    } catch (err) { setStatus({ type: 'error', text: err.message }); }
  };

  const createPackage = async (e) => {
    e.preventDefault(); setPkgStatus({ type: '', text: '' });
    try {
      await api('/tutors/me/packages', {
        method: 'POST',
        body: { ...pkgForm, sessionsCount: Number(pkgForm.sessionsCount), price: Number(pkgForm.price) },
      });
      setPkgStatus({ type: 'ok', text: 'Package created successfully!' });
      setPkgForm({ title: '', subject: '', description: '', sessionsCount: 5, price: '' });
      loadPackages();
    } catch (err) { setPkgStatus({ type: 'error', text: err.message }); }
  };

  return (
    <div className="edit-profile-container">
      <form className="card narrow" onSubmit={save}>
        <h1>Your tutor profile</h1>
        <label>Headline<input required maxLength={120} placeholder="e.g. Calculus and Physics tutor, Rice grad" value={form.headline} onChange={set('headline')} /></label>
        <label>About you<textarea rows="6" value={form.bio} onChange={set('bio')} placeholder="Your experience, teaching style, and who you work best with." /></label>
        <label>Subjects (comma separated)<input placeholder="Calculus, Physics, SAT Math" value={form.subjects} onChange={set('subjects')} /></label>
        <label>Hourly rate (USD)<input type="number" min="5" max="500" step="1" required value={form.hourlyRate} onChange={set('hourlyRate')} /></label>
        <label>Location<input placeholder="City, or Online" value={form.location} onChange={set('location')} /></label>
        {status.text && <p className={status.type === 'error' ? 'error' : 'success'}>{status.text}</p>}
        <button className="btn">Save profile</button>
        <p className="muted"><Link to={`/tutors/${user.id}`}>View your public profile</Link></p>
      </form>

      <div className="card narrow" style={{ marginTop: '2rem' }}>
        <h2>Course Packages</h2>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>Offer a discounted bundle of sessions to help a student through an entire course.</p>
        {packages.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>Your current packages</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {packages.map((pkg) => (
                <li key={pkg.id} style={{ padding: '0.75rem', background: '#f5f5f5', borderRadius: '4px', marginBottom: '0.5rem' }}>
                  <strong>{pkg.title}</strong> — {dollars(pkg.price_cents)} for {pkg.sessions_count} sessions
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={createPackage}>
          <h3>Create a new package</h3>
          <label>Package Title<input required placeholder="e.g. AP Calculus AB - Full Semester Support" value={pkgForm.title} onChange={setPkg('title')} /></label>
          <label>Subject<input required placeholder="e.g. Calculus" value={pkgForm.subject} onChange={setPkg('subject')} /></label>
          <label>Description<textarea rows="3" placeholder="What does this package include?" value={pkgForm.description} onChange={setPkg('description')} /></label>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <label style={{ flex: 1 }}>Number of Sessions<input type="number" min="2" max="50" required value={pkgForm.sessionsCount} onChange={setPkg('sessionsCount')} /></label>
            <label style={{ flex: 1 }}>Total Price (USD)<input type="number" min="10" step="1" required placeholder="e.g. 450" value={pkgForm.price} onChange={setPkg('price')} /></label>
          </div>
          {pkgStatus.text && <p className={pkgStatus.type === 'error' ? 'error' : 'success'}>{pkgStatus.text}</p>}
          <button className="btn">Create Package</button>
        </form>
      </div>
    </div>
  );
}
