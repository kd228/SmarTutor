import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await register({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate(user.role === 'tutor' ? '/profile/edit' : location.state?.from || '/tutors', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Create your account</h1>
      <div className="role-picker">
        {['student', 'tutor'].map((r) => (
          <label key={r} className={form.role === r ? 'active' : ''}>
            <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} />
            {r === 'student' ? 'I want to learn' : 'I want to tutor'}
          </label>
        ))}
      </div>
      <label>Full name
        <input required maxLength={100} value={form.name} onChange={set('name')} autoComplete="name" />
      </label>
      <label>Email
        <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
      </label>
      <label>Password
        <input type="password" required minLength={8} maxLength={128} value={form.password}
          onChange={set('password')} autoComplete="new-password" aria-describedby="pw-hint" />
        <span id="pw-hint" className="muted field-hint">At least 8 characters.</span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}
