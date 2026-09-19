import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

const STATUS_COLORS = {
  pending: { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15', border: '#eab308' },
  shortlisted: { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', border: '#0284c7' },
  selected: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', border: '#22c55e' },
  rejected: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: '#ef4444' }
};

function MyApplications() {
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!user || user.role !== 'candidate') {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/applications/my');
        if (response.data.success) {
          setApplications(response.data.applications || []);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch applications.');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchApplications();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading your applications...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in as a candidate to view your applications.</p>
          <Link to="/" className="submit-btn" style={{ width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  if (user.role !== 'candidate') {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Restricted</h2>
          <div className="alert-message alert-error">
            You are logged in as a <strong>{user.role}</strong>. Only candidates have a job application history.
          </div>
          <Link to="/recruiter/dashboard" className="submit-btn" style={{ width: 'auto' }}>
            Go to Recruiter Dashboard →
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="page-subtitle">
            Track and monitor the status of your submitted job applications.
          </p>
        </div>
        <Link to="/jobs" className="submit-btn" style={{ width: 'auto' }}>
          Browse More Jobs 🔍
        </Link>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      {applications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>
            You have not applied to any job positions yet.
          </p>
          <Link to="/jobs" className="submit-btn" style={{ width: 'auto' }}>
            Explore Available Positions
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {applications.map((app) => {
            const statusStyle = STATUS_COLORS[app.status] || STATUS_COLORS.pending;
            const formattedDate = new Date(app.applied_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={app.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  borderLeft: `4px solid ${statusStyle.border}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                      {app.job_title}
                    </h3>
                    <p style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1rem' }}>
                      {app.company_name || 'Hiring Company'}
                    </p>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      📍 {app.location} &bull; 💼 {app.job_type}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'capitalize'
                      }}
                    >
                      Status: {app.status}
                    </span>
                    {app.interview_status && (
                      <span
                        style={{
                          display: 'inline-block',
                          background: app.interview_status === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                          color: app.interview_status === 'cancelled' ? '#f87171' : '#38bdf8',
                          border: `1px solid ${app.interview_status === 'cancelled' ? '#ef4444' : '#0284c7'}`,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        Interview: {app.interview_status.charAt(0).toUpperCase() + app.interview_status.slice(1)}
                      </span>
                    )}
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      Applied: {formattedDate}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <Link
                    to={`/applications/${app.id}`}
                    className="submit-btn"
                    style={{
                      width: 'auto',
                      padding: '0.45rem 1.1rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    View Application & Interview Details →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}

export default MyApplications;
