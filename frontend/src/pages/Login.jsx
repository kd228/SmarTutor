import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Log in</h1>
      {location.state?.from && <p className="muted">Log in to continue.</p>}
      <label>Email
        <input type="email" required autoComplete="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label>Password
        <input type="password" required autoComplete="current-password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
    </form>
  );
}
