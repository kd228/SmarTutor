import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
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
        <Link to="/" className="brand">TutorHub</Link>
        <nav>
          <NavLink to="/">Find a tutor</NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              {user.role === 'tutor' && <NavLink to="/profile/edit">My profile</NavLink>}
              <button className="link" onClick={() => { logout(); navigate('/'); }}>
                Log out ({user.name.split(' ')[0]})
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn small">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/profile/edit" element={<Protected role="tutor"><EditProfile /></Protected>} />
          <Route path="/checkout/mock/:bookingId" element={<Protected role="student"><MockCheckout /></Protected>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
