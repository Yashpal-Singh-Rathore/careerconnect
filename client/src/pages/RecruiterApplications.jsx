import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

const STATUS_OPTIONS = ['pending', 'shortlisted', 'rejected', 'selected'];

const STATUS_COLORS = {
  pending: { bg: 'rgba(234, 179, 8, 0.2)', text: '#facc15', border: '#eab308' },
  shortlisted: { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', border: '#0284c7' },
  selected: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', border: '#22c55e' },
  rejected: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: '#ef4444' }
};

function RecruiterApplications() {
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });
  const [updatingId, setUpdatingId] = useState(null);
  const [viewingResumeId, setViewingResumeId] = useState(null);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/recruiter/applications');
      if (response.data.success) {
        setApplications(response.data.applications || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch candidate applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role === 'recruiter') {
      fetchApplications();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const handleStatusChange = async (appId, newStatus) => {
    try {
      setUpdatingId(appId);
      setActionMessage({ type: '', text: '' });
      const response = await api.put(`/applications/${appId}/status`, { status: newStatus });
      if (response.data.success) {
        setActionMessage({
          type: 'success',
          text: `Application #${appId} status updated to ${newStatus}.`
        });
        setApplications((prev) =>
          prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app))
        );
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to update application status.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewResume = async (resumeId, fileName) => {
    if (!resumeId) return;

    try {
      setViewingResumeId(resumeId);
      const response = await api.get(`/resumes/${resumeId}`, {
        responseType: 'blob'
      });

      const contentType = response.headers['content-type'] || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);

      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName || 'resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Failed to access resume: ' + (err.response?.data?.message || err.message));
    } finally {
      setViewingResumeId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading candidate applications...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in as a recruiter to review applications.</p>
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
            You are currently logged in as a <strong>{user.role}</strong>. Application management is restricted to recruiters.
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
          <h1 className="page-title">Candidate Applications</h1>
          <p className="page-subtitle">
            Review applicant profiles, evaluate candidate resumes, update hiring statuses, and schedule interviews.
          </p>
        </div>
        <Link to="/recruiter/reports" className="tab-btn" style={{ textDecoration: 'none' }}>
          View Analytics 📊
        </Link>
      </div>

      {actionMessage.text && (
        <div className={`alert-message ${actionMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {actionMessage.text}
        </div>
      )}

      {error && <div className="alert-message alert-error">{error}</div>}

      {applications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>No candidates have applied to your jobs yet.</p>
          <Link to="/recruiter/jobs" className="submit-btn" style={{ width: 'auto' }}>
            View Posted Jobs
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
                {/* Top Row: Candidate Name & Applied Job */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ color: '#38bdf8', fontSize: '1.3rem', marginBottom: '0.2rem' }}>
                      {app.candidate_name}
                    </h3>
                    <p style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>
                      Applied for: <span style={{ color: '#38bdf8' }}>{app.job_title}</span>
                    </p>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      📧 {app.candidate_email} {app.candidate_phone ? `| 📞 ${app.candidate_phone}` : ''}
                      {app.candidate_location ? ` | 📍 ${app.candidate_location}` : ''}
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
                        textTransform: 'uppercase'
                      }}
                    >
                      {app.status}
                    </span>
                    <span
                      style={{
                        display: 'inline-block',
                        background: app.interview_status
                          ? (app.interview_status === 'cancelled' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)')
                          : 'rgba(100, 116, 139, 0.2)',
                        color: app.interview_status
                          ? (app.interview_status === 'cancelled' ? '#f87171' : '#38bdf8')
                          : '#94a3b8',
                        border: `1px solid ${
                          app.interview_status
                            ? (app.interview_status === 'cancelled' ? '#ef4444' : '#0284c7')
                            : '#475569'
                        }`,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      Interview: {app.interview_status ? app.interview_status.charAt(0).toUpperCase() + app.interview_status.slice(1) : 'Not Scheduled'}
                    </span>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      Applied: {formattedDate}
                    </div>
                  </div>
                </div>

                {/* Candidate Resume & Profile Info Snippet */}
                <div
                  style={{
                    padding: '1rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong style={{ color: '#cbd5e1' }}>Attached Resume: </strong>
                      {app.resume ? (
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>📄 {app.resume.file_name}</span>
                      ) : (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>Not uploaded</span>
                      )}
                    </div>

                    {app.resume && (
                      <button
                        type="button"
                        className="tab-btn"
                        onClick={() => handleViewResume(app.resume.id, app.resume.file_name)}
                        disabled={viewingResumeId === app.resume.id}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        {viewingResumeId === app.resume.id ? 'Loading...' : '👁️ View Resume'}
                      </button>
                    )}
                  </div>

                  {app.candidate_skills && (
                    <div style={{ borderTop: '1px solid #1e293b', paddingTop: '0.5rem' }}>
                      <strong style={{ color: '#cbd5e1' }}>Skills: </strong>
                      <span style={{ color: '#94a3b8' }}>{app.candidate_skills}</span>
                    </div>
                  )}
                  {app.candidate_experience && (
                    <div>
                      <strong style={{ color: '#cbd5e1' }}>Experience: </strong>
                      <span style={{ color: '#94a3b8' }}>{app.candidate_experience}</span>
                    </div>
                  )}
                </div>

                {/* Status Update Dropdown & View Details Action */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Update Status:</label>
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.id, e.target.value)}
                      disabled={updatingId === app.id}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </option>
                      ))}
                    </select>
                    {updatingId === app.id && (
                      <span className="status-value status-checking" style={{ fontSize: '0.8rem' }}>Updating...</span>
                    )}
                  </div>

                  <Link
                    to={`/recruiter/applications/${app.id}`}
                    className="submit-btn"
                    style={{
                      width: 'auto',
                      padding: '0.45rem 1rem',
                      fontSize: '0.85rem'
                    }}
                  >
                    View Full Details & Interview →
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

export default RecruiterApplications;
