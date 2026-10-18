import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await register(form);
      navigate(user.role === 'tutor' ? '/profile/edit' : '/tutors');
    } catch (err) {
      setError(err.message);
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
        <input required value={form.name} onChange={set('name')} autoComplete="name" />
      </label>
      <label>Email
        <input type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
      </label>
      <label>Password (8+ characters)
        <input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn">Sign up</button>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </form>
  );
}
