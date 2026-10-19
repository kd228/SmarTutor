import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import FindTutors from './pages/FindTutors.jsx';
import TutorProfile from './pages/TutorProfile.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EditProfile from './pages/EditProfile.jsx';
import MockCheckout from './pages/MockCheckout.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="nav">
        <Link to="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="SmarTutor Logo" style={{ height: '36px', width: 'auto' }} />
          <span>SmarTutor</span>
        </Link>

        <nav className="tabs" aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/tutors">Find a tutor</NavLink>
        </nav>

        <div className="account">
          {user ? (
            <>
              <NavLink to="/dashboard" className="account-link">Dashboard</NavLink>
              {user.role === 'tutor' && <NavLink to="/profile/edit" className="account-link">My profile</NavLink>}
              <button className="link" onClick={() => { logout(); navigate('/'); }}>
                Log out ({user.name.split(' ')[0]})
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="account-link">Log in</NavLink>
              <Link to="/register" className="btn small">Sign up</Link>
            </>
          )}
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/tutors" element={<FindTutors />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/profile/edit" element={<Protected role="tutor"><EditProfile /></Protected>} />
          <Route path="/checkout/mock/:bookingId" element={<Protected role="student"><MockCheckout /></Protected>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>

      <footer className="footer">
        <span className="footer-brand">SmarTutor</span>
        <nav aria-label="Footer">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/tutors">Find a tutor</Link>
          <Link to="/register">Become a tutor</Link>
        </nav>
      </footer>
    </>
  );
}
