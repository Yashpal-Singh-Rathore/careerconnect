import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function MyJobs() {
  const { user, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [closingId, setClosingId] = useState(null);

  const fetchMyJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/jobs/my');
      if (response.data.success) {
        setJobs(response.data.jobs || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch your jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role === 'recruiter') {
      fetchMyJobs();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const handleCloseJob = async (jobId) => {
    const confirmClose = window.confirm('Are you sure you want to close this job posting? Candidates will no longer see it in active listings.');
    if (!confirmClose) return;

    try {
      setClosingId(jobId);
      setActionMessage({ type: '', text: '' });
      const response = await api.delete(`/jobs/${jobId}`);
      if (response.data.success) {
        setActionMessage({
          type: 'success',
          text: response.data.message || 'Job closed successfully.'
        });
        setJobs((prevJobs) =>
          prevJobs.map((j) => (j.id === jobId ? { ...j, status: 'closed' } : j))
        );
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to close job.'
      });
    } finally {
      setClosingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading your jobs...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in as a recruiter to manage jobs.</p>
          <Link to="/" className="submit-btn" style={{ width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  if (user.role !== 'recruiter') {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Restricted</h2>
          <div className="alert-message alert-error">
            You are currently logged in as a <strong>{user.role}</strong>. Job management is restricted to recruiters.
          </div>
          <Link to="/candidate/dashboard" className="submit-btn" style={{ width: 'auto' }}>
            Go to Candidate Dashboard →
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Posted Jobs</h1>
          <p className="page-subtitle">
            Manage your company job postings, update requirements, and close fulfilled positions.
          </p>
        </div>
        <Link to="/recruiter/jobs/create" className="submit-btn" style={{ width: 'auto' }}>
          + Post a New Job
        </Link>
      </div>

      {actionMessage.text && (
        <div className={`alert-message ${actionMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {actionMessage.text}
        </div>
      )}

      {error && <div className="alert-message alert-error">{error}</div>}

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>You have not posted any job listings yet.</p>
          <Link to="/recruiter/jobs/create" className="submit-btn" style={{ width: 'auto' }}>
            Post Your First Job
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {jobs.map((job) => (
            <div
              key={job.id}
              className="card"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderLeft: job.status === 'active' ? '4px solid #22c55e' : '4px solid #ef4444'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ color: '#38bdf8', fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                    {job.title}
                  </h3>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    📍 {job.location} • 💼 {job.job_type}
                    {job.salary ? ` • 💰 ${job.salary}` : ''}
                    {job.experience ? ` • ⏳ ${job.experience}` : ''}
                  </div>
                </div>
                <span
                  style={{
                    background: job.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: job.status === 'active' ? '#4ade80' : '#f87171',
                    border: `1px solid ${job.status === 'active' ? '#22c55e' : '#ef4444'}`,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  Status: {job.status}
                </span>
              </div>

              {job.skills && (
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#64748b' }}>Skills: </span>
                  {job.skills}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <Link
                  to={`/recruiter/jobs/${job.id}/edit`}
                  className="tab-btn"
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    textDecoration: 'none',
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem'
                  }}
                >
                  Edit Job
                </Link>

                {job.status === 'active' && (
                  <button
                    type="button"
                    className="logout-btn"
                    style={{ margin: 0, padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    onClick={() => handleCloseJob(job.id)}
                    disabled={closingId === job.id}
                  >
                    {closingId === job.id ? 'Closing...' : 'Close Job'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default MyJobs;
