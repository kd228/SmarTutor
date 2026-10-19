import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, dollars } from '../api.js';
import { courseCadence, courseLength } from '../courseText.js';

const EMPTY = { title: '', subject: '', description: '', totalSessions: 12, sessionsPerWeek: 1, sessionMinutes: 60, price: '' };

export default function MyCourses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api('/courses/mine')
      .then((d) => setCourses(d.courses))
      .catch((e) => setStatus({ type: 'error', text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const sessions = Number(form.totalSessions);
  const price = Number(form.price);
  const weeks = Math.ceil(sessions / Number(form.sessionsPerWeek));
  const summary = Number.isInteger(sessions) && sessions >= 2 && price > 0
    ? `${sessions} sessions over ${weeks} ${weeks === 1 ? 'week' : 'weeks'}, about ${dollars(Math.round((price * 100) / sessions))} a session.`
    : '';

  const reset = () => { setForm(EMPTY); setEditingId(null); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus({ type: '', text: '' });
    try {
      await api(editingId ? `/courses/${editingId}` : '/courses', {
        method: editingId ? 'PUT' : 'POST',
        body: {
          title: form.title,
          subject: form.subject,
          description: form.description,
          totalSessions: Number(form.totalSessions),
          sessionsPerWeek: Number(form.sessionsPerWeek),
          sessionMinutes: Number(form.sessionMinutes),
          price: Number(form.price),
        },
      });
      setStatus({
        type: 'ok',
        text: editingId ? 'Course updated.' : 'Course published. Students can find it under Courses.',
      });
      reset();
      load();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const edit = (c) => {
    setEditingId(c.id);
    setForm({
      title: c.title,
      subject: c.subject,
      description: c.description,
      totalSessions: c.totalSessions,
      sessionsPerWeek: c.sessionsPerWeek,
      sessionMinutes: c.sessionMinutes,
      price: c.priceCents / 100,
    });
    setStatus({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setArchived = async (c, archive) => {
    try {
      await api(`/courses/${c.id}/${archive ? 'archive' : 'restore'}`, { method: 'POST' });
      load();
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    }
  };

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Your courses</h1>
        <p className="lede">
          A course is a set of sessions over several weeks, sold at one price. Students pick the start date and
          the sessions are scheduled for them.
        </p>
      </header>

      <form className="card form-card" onSubmit={save}>
        <h2 className="box-title">{editingId ? 'Edit course' : 'Create a course'}</h2>
        <div className="form-grid">
          <label className="wide">Title
            <input required minLength={5} maxLength={120} placeholder="e.g. Calculus I in twelve weeks"
              value={form.title} onChange={set('title')} />
          </label>
          <label>Subject
            <input maxLength={60} placeholder="e.g. Calculus" value={form.subject} onChange={set('subject')} />
          </label>
          <label>Price for the whole course (USD)
            <input type="number" required min="10" max="20000" step="1" value={form.price} onChange={set('price')} />
          </label>
          <label>Number of sessions
            <input type="number" required min="2" max="52" value={form.totalSessions} onChange={set('totalSessions')} />
          </label>
          <label>Sessions per week
            <select value={form.sessionsPerWeek} onChange={set('sessionsPerWeek')}>
              <option value={1}>1 a week</option>
              <option value={2}>2 a week</option>
              <option value={3}>3 a week</option>
            </select>
          </label>
          <label>Minutes per session
            <select value={form.sessionMinutes} onChange={set('sessionMinutes')}>
              {[30, 45, 60, 75, 90, 120, 150, 180].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <label className="wide">What the course covers
            <textarea rows="5" maxLength={4000} value={form.description} onChange={set('description')}
              placeholder="The topics, who it is for, and what students will be able to do afterwards." />
          </label>
        </div>

        {summary && <p className="muted">{summary}</p>}
        {editingId && <p className="muted">Changes apply to new enrollments. Students already enrolled keep their schedule and price.</p>}
        {status.text && <p className={status.type === 'error' ? 'error' : 'success'} role="alert">{status.text}</p>}
        <div className="cta-row">
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish course'}</button>
          {editingId && <button type="button" className="btn ghost" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <h2 className="section-sub">Your published courses</h2>
      {courses.length === 0 && <p className="muted">You have not created a course yet.</p>}
      <div className="list">
        {courses.map((c) => (
          <div key={c.id} className="card booking">
            <div>
              <h3><Link to={`/courses/${c.id}`}>{c.title}</Link></h3>
              <p>{courseLength(c)}, {dollars(c.priceCents)}</p>
              <p className="muted">{courseCadence(c)}</p>
              <span className={`pill ${c.status === 'active' ? 'completed' : 'cancelled'}`}>
                {c.status === 'active' ? 'Visible to students' : 'Archived'}
              </span>
              <span className="muted"> {c.enrolled} enrolled</span>
            </div>
            <div className="actions">
              <button className="btn small ghost" onClick={() => edit(c)}>Edit</button>
              <button className="btn small ghost" onClick={() => setArchived(c, c.status === 'active')}>
                {c.status === 'active' ? 'Archive' : 'Restore'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
