import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Logo from './components/Logo.jsx';
import Home from './pages/Home.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import FindTutors from './pages/FindTutors.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import MyCourses from './pages/MyCourses.jsx';
import TutorProfile from './pages/TutorProfile.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EditProfile from './pages/EditProfile.jsx';
import MockCheckout from './pages/MockCheckout.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted">Loading…</p>;
  // Remember where the visitor was headed so logging in brings them back to it.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <header className="nav">
        <Link to="/" className="brand" aria-label="SmarTutor home">
          <Logo size={36} />
          <span>SmarTutor</span>
        </Link>

        <nav className="tabs" aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/courses">Courses</NavLink>
          <NavLink to="/tutors">Find a tutor</NavLink>
        </nav>

        <div className="account">
          {user ? (
            <>
              <NavLink to="/dashboard" className="account-link">Dashboard</NavLink>
              {user.role === 'tutor' && <NavLink to="/my-courses" className="account-link">My courses</NavLink>}
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
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/my-courses" element={<Protected role="tutor"><MyCourses /></Protected>} />
          <Route path="/tutors" element={<FindTutors />} />
          <Route path="/tutors/:id" element={<TutorProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/profile/edit" element={<Protected role="tutor"><EditProfile /></Protected>} />
          <Route path="/checkout/mock/:id" element={<Protected role="student"><MockCheckout kind="booking" /></Protected>} />
          <Route path="/checkout/mock-course/:id" element={<Protected role="student"><MockCheckout kind="course" /></Protected>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>

      <footer className="footer">
        <span className="footer-brand">
          <Logo size={24} />
          SmarTutor
        </span>
        <nav aria-label="Footer">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/tutors">Find a tutor</Link>
          <Link to="/register">Become a tutor</Link>
        </nav>
      </footer>
    </>
  );
}
