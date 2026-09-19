import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Application state
  const [hasApplied, setHasApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchJobAndApplication = async () => {
      try {
        setLoading(true);
        setError(null);
        const jobRes = await api.get(`/jobs/${id}`);
        if (jobRes.data.success) {
          setJob(jobRes.data.job);
        }

        // If logged-in user is candidate, check if already applied
        if (user && user.role === 'candidate') {
          try {
            const appsRes = await api.get('/applications/my');
            if (appsRes.data.success && appsRes.data.applications) {
              const alreadyApplied = appsRes.data.applications.some(
                (app) => String(app.job_id) === String(id)
              );
              setHasApplied(alreadyApplied);
            }
          } catch (appErr) {
            console.warn('Could not check application status:', appErr.message);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load job details.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndApplication();
  }, [id, user]);

  const handleApply = async () => {
    setApplyMessage({ type: '', text: '' });
    setApplying(true);

    try {
      const response = await api.post('/applications', { job_id: parseInt(id, 10) });
      if (response.data.success) {
        setHasApplied(true);
        setApplyMessage({
          type: 'success',
          text: response.data.message || 'Application submitted successfully'
        });
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setHasApplied(true);
      }
      setApplyMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to submit application.'
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading job details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !job) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title" style={{ color: '#f87171' }}>Job Not Found</h2>
          <p className="subtitle">{error || 'The requested job posting does not exist.'}</p>
          <Link to="/jobs" className="submit-btn" style={{ width: 'auto' }}>
            ← Back to Find Jobs
          </Link>
        </div>
      </Layout>
    );
  }

  const formattedDate = new Date(job.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to="/jobs" className="tab-btn" style={{ textDecoration: 'none', marginBottom: '0.75rem', display: 'inline-block' }}>
            ← Back to Jobs
          </Link>
          <h1 className="page-title">{job.title}</h1>
          <p className="page-subtitle" style={{ fontSize: '1.1rem', color: '#38bdf8', fontWeight: 600 }}>
            {job.company_name || 'Hiring Company'}
          </p>
        </div>

        <div>
          <span
            style={{
              background: job.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: job.status === 'active' ? '#4ade80' : '#f87171',
              border: `1px solid ${job.status === 'active' ? '#22c55e' : '#ef4444'}`,
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          >
            {job.status}
          </span>
        </div>
      </div>

      {applyMessage.text && (
        <div className={`alert-message ${applyMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {applyMessage.text}
        </div>
      )}

      {/* Details Grid & Description */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid #334155',
            marginBottom: '1.5rem'
          }}
        >
          <div>
            <div className="status-label">Location</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>📍 {job.location}</div>
          </div>
          <div>
            <div className="status-label">Employment Type</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>💼 {job.job_type}</div>
          </div>
          <div>
            <div className="status-label">Experience</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>⏳ {job.experience || 'Not specified'}</div>
          </div>
          <div>
            <div className="status-label">Compensation</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>💰 {job.salary || 'Competitive'}</div>
          </div>
          <div>
            <div className="status-label">Posted Date</div>
            <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>📅 {formattedDate}</div>
          </div>
        </div>

        {job.skills && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.5rem', fontWeight: 700 }}>
              Required Technical Skills
            </h3>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.95rem' }}>{job.skills}</p>
            </div>
          </div>
        )}

        <div>
          <h3 style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.5rem', fontWeight: 700 }}>
            Job Description & Responsibilities
          </h3>
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1.5rem',
              lineHeight: 1.7,
              color: '#cbd5e1',
              whiteSpace: 'pre-line',
              fontSize: '0.95rem'
            }}
          >
            {job.description}
          </div>
        </div>

        {/* Action Button Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Link to="/jobs" className="tab-btn" style={{ textDecoration: 'none' }}>
            ← Back to All Jobs
          </Link>

          {job.status === 'active' && user?.role === 'candidate' && (
            <div>
              {hasApplied ? (
                <button
                  className="submit-btn"
                  disabled
                  style={{
                    background: '#334155',
                    color: '#94a3b8',
                    cursor: 'not-allowed',
                    width: 'auto'
                  }}
                >
                  ✓ Already Applied
                </button>
              ) : (
                <button
                  className="submit-btn"
                  onClick={handleApply}
                  disabled={applying}
                  style={{ width: 'auto' }}
                >
                  {applying ? 'Submitting Application...' : 'Apply Now 🚀'}
                </button>
              )}
            </div>
          )}

          {!user && job.status === 'active' && (
            <Link
              to="/"
              className="submit-btn"
              style={{ width: 'auto' }}
            >
              Sign In to Apply
            </Link>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default JobDetails;
