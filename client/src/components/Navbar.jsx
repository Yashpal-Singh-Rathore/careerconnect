import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return (
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="nav-brand">
            CareerConnect
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-link">
              Sign In
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const isCandidate = user.role === 'candidate';
  const homePath = isCandidate ? '/candidate/dashboard' : '/recruiter/dashboard';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={homePath} className="nav-brand">
          CareerConnect
        </Link>

        {/* Role-Specific Navigation Links */}
        <nav className="nav-links">
          {isCandidate ? (
            <>
              <NavLink
                to="/candidate/dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/jobs"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Find Jobs
              </NavLink>
              <NavLink
                to="/applications"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                My Applications
              </NavLink>
              <NavLink
                to="/messages"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Messages
              </NavLink>
              <NavLink
                to="/candidate/profile"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                My Profile
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/recruiter/dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/recruiter/jobs"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                My Jobs
              </NavLink>
              <NavLink
                to="/recruiter/applications"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Applications
              </NavLink>
              <NavLink
                to="/messages"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Messages
              </NavLink>
              <NavLink
                to="/recruiter/reports"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Reports
              </NavLink>
              <NavLink
                to="/recruiter/profile"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Profile
              </NavLink>
            </>
          )}
        </nav>

        {/* User Session & Logout */}
        <div className="nav-user">
          <div className="user-badge">
            <span>{user.name}</span>
            <span className="badge-role">{user.role}</span>
          </div>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
