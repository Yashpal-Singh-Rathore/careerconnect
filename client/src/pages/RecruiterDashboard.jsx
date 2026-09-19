import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function RecruiterDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    active_jobs: 0,
    total_applications: 0,
    pending_applications: 0,
    shortlisted_applications: 0,
    selected_applications: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecruiterStats = async () => {
      if (!user || user.role !== 'recruiter') {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/recruiter/reports');
        if (response.data.success) {
          setStats(response.data.stats || {});
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchRecruiterStats();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <p className="status-value status-checking">Loading Recruiter Dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">Please log in to access the recruiter dashboard.</p>
          <Link to="/" className="submit-btn" style={{ display: 'inline-block', width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  if (user.role !== 'recruiter') {
    return (
      <Layout>
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
          <h2 className="title">Access Restricted</h2>
          <div className="alert-message alert-error">
            You are logged in as a <strong>{user.role}</strong>. This dashboard is for recruiters only.
          </div>
          <Link to="/candidate/dashboard" className="submit-btn" style={{ display: 'inline-block', width: 'auto' }}>
            Go to Candidate Dashboard →
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
          <h1 className="page-title">Recruiter Dashboard</h1>
          <p className="page-subtitle">
            Welcome, <strong style={{ color: '#38bdf8' }}>{user.name}</strong>! Manage job vacancies, applicants, and recruiting workflows.
          </p>
        </div>
        <Link
          to="/recruiter/jobs/create"
          className="submit-btn"
          style={{ width: 'auto' }}
        >
          + Post a New Job
        </Link>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      {/* Recruiter Stats Section */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1rem' }}>
          Hiring Pipeline Statistics
        </h2>
        <div className="grid-stats">
          <div className="stat-card" style={{ borderColor: '#38bdf8' }}>
            <div className="stat-label">Active Jobs</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.active_jobs ?? 0}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#818cf8' }}>
            <div className="stat-label">Total Applications</div>
            <div className="stat-value" style={{ color: '#818cf8' }}>{stats.total_applications ?? 0}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#eab308' }}>
            <div className="stat-label">Pending Review</div>
            <div className="stat-value" style={{ color: '#facc15' }}>{stats.pending_applications ?? 0}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#0284c7' }}>
            <div className="stat-label">Shortlisted</div>
            <div className="stat-value" style={{ color: '#38bdf8' }}>{stats.shortlisted_applications ?? 0}</div>
          </div>
          <div className="stat-card" style={{ borderColor: '#22c55e' }}>
            <div className="stat-label">Selected</div>
            <div className="stat-value" style={{ color: '#4ade80' }}>{stats.selected_applications ?? 0}</div>
          </div>
        </div>
      </section>

      {/* Recruiter Action Cards Grid */}
      <section>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '1rem' }}>
          Recruiter Management
        </h2>
        <div className="grid-3">
          {/* My Jobs */}
          <Link to="/recruiter/jobs" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">📋 My Jobs</span>
                <span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  {stats.active_jobs ?? 0} Active
                </span>
              </div>
              <p className="action-card-desc">
                Review and update your posted job listings, edit descriptions, or close filled positions.
              </p>
            </div>
            <div className="action-card-footer">
              Manage Job Postings →
            </div>
          </Link>

          {/* Applications */}
          <Link to="/recruiter/applications" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">👥 Candidate Applications</span>
                <span className="badge-tag" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>
                  {stats.total_applications ?? 0} Total
                </span>
              </div>
              <p className="action-card-desc">
                Inspect applicant details, download candidate resumes, schedule interviews, and update statuses.
              </p>
            </div>
            <div className="action-card-footer">
              Review Applicants →
            </div>
          </Link>

          {/* Reports & Analytics */}
          <Link to="/recruiter/reports" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">📊 Reports & Analytics</span>
                <span className="badge-tag" style={{ background: 'rgba(129, 140, 248, 0.2)', color: '#818cf8' }}>
                  Charts & Stats
                </span>
              </div>
              <p className="action-card-desc">
                Analyze your recruiting funnel distribution and view application status charts.
              </p>
            </div>
            <div className="action-card-footer">
              Open Analytics Report →
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
                Engage in direct real-time chats with applicants who have submitted applications to your job postings.
              </p>
            </div>
            <div className="action-card-footer">
              Open Messages →
            </div>
          </Link>

          {/* Recruiter Profile */}
          <Link to="/recruiter/profile" className="action-card">
            <div>
              <div className="action-card-header">
                <span className="action-card-title">🏢 Recruiter Profile</span>
                <span className="badge-tag" style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }}>
                  Company Info
                </span>
              </div>
              <p className="action-card-desc">
                Update company name, description, phone, and office location displayed to applicants.
              </p>
            </div>
            <div className="action-card-footer">
              Edit Company Profile →
            </div>
          </Link>

          {/* Post New Job */}
          <Link to="/recruiter/jobs/create" className="action-card" style={{ borderColor: '#0284c7' }}>
            <div>
              <div className="action-card-header">
                <span className="action-card-title">+ Post a New Job</span>
                <span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                  New Listing
                </span>
              </div>
              <p className="action-card-desc">
                Publish a new career opportunity with requirements, salary range, job type, and target location.
              </p>
            </div>
            <div className="action-card-footer">
              Create Job Vacancy →
            </div>
          </Link>
        </div>
      </section>
    </Layout>
  );
}

export default RecruiterDashboard;
