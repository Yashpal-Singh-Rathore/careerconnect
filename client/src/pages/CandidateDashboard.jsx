import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function CandidateDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    shortlisted: 0,
    selected: 0,
    rejected: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCandidateStats = async () => {
      if (!user || user.role !== 'candidate') {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/applications/my');
        if (response.data.success) {
          const apps = response.data.applications || [];
          const total = apps.length;
          const pending = apps.filter((a) => a.status === 'pending').length;
          const shortlisted = apps.filter((a) => a.status === 'shortlisted').length;
          const selected = apps.filter((a) => a.status === 'selected').length;
          const rejected = apps.filter((a) => a.status === 'rejected').length;

          setStats({ total, pending, shortlisted, selected, rejected });
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchCandidateStats();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <p className="status-value status-checking">Loading Candidate Dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">Please log in to access your candidate dashboard.</p>
          <Link to="/" className="submit-btn" style={{ display: 'inline-block', width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  if (user.role !== 'candidate') {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <h2 className="title">Access Restricted</h2>
          <div className="alert-message alert-error">
            You are logged in as a <strong>{user.role}</strong>. This dashboard is for candidates only.
          </div>
          <Link to="/recruiter/dashboard" className="submit-btn" style={{ display: 'inline-block', width: 'auto' }}>
            Go to Recruiter Dashboard →
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header Section */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidate Dashboard</h1>
          <p className="page-subtitle">
            Welcome, <strong style={{ color: '#38bdf8' }}>{user.name}</strong>! Explore opportunities and track your applications.
          </p>
        </div>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      {/* Application Stats Section */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1rem' }}>
          Application Overview
        </h2>
        <div className="grid-stats">
          <div className="stat-card" style={{ borderColor: '#38bdf8' }}>
            <div className="stat-label">Total Applications</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.total}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#eab308' }}>
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: '#facc15' }}>{stats.pending}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#0284c7' }}>
            <div className="stat-label">Shortlisted</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.shortlisted}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#22c55e' }}>
            <div className="stat-label">Selected</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.selected}</div>
          </div>
        </div>
      </section>

      {/* Quick Action Cards Grid */}
      <section>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1rem' }}>
          Quick Actions
        </h2>
        <div className="grid-2">
          {/* Find Jobs */}
          <Link to="/jobs" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">🔍 Find Jobs</span>
                <span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  Active Positions
                </span>
              </div>
              <p className="action-card-desc">
                Browse through verified active job listings, search by skills, keywords, or locations, and submit your applications.
              </p>
            </div>
            <div className="action-card-footer">
              Browse Available Jobs →
            </div>
          </Link>

          {/* My Applications */}
          <Link to="/applications" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">📄 My Applications</span>
                <span className="badge-tag" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                  {stats.total} Submitted
                </span>
              </div>
              <p className="action-card-desc">
                Review your submitted applications, monitor hiring status updates, and check scheduled interviews in real time.
              </p>
            </div>
            <div className="action-card-footer">
              View Application Statuses →
            </div>
          </Link>

          {/* My Profile */}
          <Link to="/candidate/profile" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">👤 My Profile</span>
                <span className="badge-tag" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }}>
                  Profile & Resume
                </span>
              </div>
              <p className="action-card-desc">
                Keep your candidate profile, contact details, educational background, work experience, and resume updated.
              </p>
            </div>
            <div className="action-card-footer">
              Edit Profile & Resume →
            </div>
          </Link>

          {/* Messages */}
          <Link to="/messages" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">💬 Messages</span>
                <span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  Real-Time Chat
                </span>
              </div>
              <p className="action-card-desc">
                Direct real-time communication channel with recruiters for application queries and interview coordination.
              </p>
            </div>
            <div className="action-card-footer">
              Open Messages →
            </div>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

export default CandidateDashboard;
