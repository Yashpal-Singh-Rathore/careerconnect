import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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

const INTERVIEW_STATUS_COLORS = {
  scheduled: { bg: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8', border: '#0284c7' },
  completed: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', border: '#22c55e' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: '#ef4444' }
};

function ApplicationDetails() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();

  const [application, setApplication] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [viewingResume, setViewingResume] = useState(false);
  const [updateMessage, setUpdateMessage] = useState({ type: '', text: '' });

  // Interview state and form
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [isEditingInterview, setIsEditingInterview] = useState(false);
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewMessage, setInterviewMessage] = useState({ type: '', text: '' });
  const [interviewForm, setInterviewForm] = useState({
    interview_date: '',
    interview_time: '',
    mode: 'Online',
    notes: '',
    status: 'scheduled'
  });

  const fetchApplicationAndInterview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const appResponse = await api.get(`/applications/${id}`);
      if (appResponse.data.success) {
        setApplication(appResponse.data.application);
      }

      // Fetch interview details
      try {
        const interviewResponse = await api.get(`/interviews/application/${id}`);
        if (interviewResponse.data.success) {
          setInterview(interviewResponse.data.interview);
        }
      } catch (intErr) {
        setInterview(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchApplicationAndInterview();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [id, user, authLoading]);

  const handleStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === application?.status) return;

    try {
      setUpdating(true);
      setUpdateMessage({ type: '', text: '' });
      const response = await api.put(`/applications/${id}/status`, { status: newStatus });
      if (response.data.success) {
        setApplication((prev) => ({ ...prev, status: newStatus }));
        setUpdateMessage({ type: 'success', text: 'Application status updated successfully.' });
      }
    } catch (err) {
      setUpdateMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to update status.'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleViewResume = async (resumeId, fileName) => {
    if (!resumeId) return;

    try {
      setViewingResume(true);
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
      alert('Failed to view resume file: ' + (err.response?.data?.message || err.message));
    } finally {
      setViewingResume(false);
    }
  };

  // Open Schedule Form
  const handleOpenScheduleForm = () => {
    setInterviewForm({
      interview_date: '',
      interview_time: '',
      mode: 'Online',
      notes: '',
      status: 'scheduled'
    });
    setIsEditingInterview(false);
    setShowInterviewForm(true);
    setInterviewMessage({ type: '', text: '' });
  };

  // Open Edit Form
  const handleOpenEditForm = () => {
    if (!interview) return;
    setInterviewForm({
      interview_date: interview.interview_date || '',
      interview_time: interview.interview_time ? interview.interview_time.substring(0, 5) : '',
      mode: interview.mode || 'Online',
      notes: interview.notes || '',
      status: interview.status || 'scheduled'
    });
    setIsEditingInterview(true);
    setShowInterviewForm(true);
    setInterviewMessage({ type: '', text: '' });
  };

  // Submit Schedule / Edit Form
  const handleInterviewSubmit = async (e) => {
    e.preventDefault();
    setInterviewSubmitting(true);
    setInterviewMessage({ type: '', text: '' });

    try {
      if (isEditingInterview && interview) {
        const res = await api.put(`/interviews/${interview.id}`, {
          interview_date: interviewForm.interview_date,
          interview_time: interviewForm.interview_time,
          mode: interviewForm.mode,
          notes: interviewForm.notes,
          status: interviewForm.status
        });

        if (res.data.success) {
          setInterview(res.data.interview);
          setShowInterviewForm(false);
          setInterviewMessage({ type: 'success', text: 'Interview updated successfully.' });
        }
      } else {
        const res = await api.post('/interviews', {
          application_id: parseInt(id, 10),
          interview_date: interviewForm.interview_date,
          interview_time: interviewForm.interview_time,
          mode: interviewForm.mode,
          notes: interviewForm.notes
        });

        if (res.data.success) {
          setInterview(res.data.interview);
          setShowInterviewForm(false);
          setInterviewMessage({ type: 'success', text: 'Interview scheduled successfully.' });
        }
      }
    } catch (err) {
      setInterviewMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to save interview.'
      });
    } finally {
      setInterviewSubmitting(false);
    }
  };

  // Cancel Interview
  const handleCancelInterview = async () => {
    if (!interview) return;
    if (!window.confirm('Are you sure you want to cancel this interview?')) return;

    setInterviewSubmitting(true);
    setInterviewMessage({ type: '', text: '' });

    try {
      const res = await api.delete(`/interviews/${interview.id}`);
      if (res.data.success) {
        setInterview((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
        setInterviewMessage({ type: 'success', text: 'Interview cancelled successfully.' });
      }
    } catch (err) {
      setInterviewMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to cancel interview.'
      });
    } finally {
      setInterviewSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading application details...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">Please log in to view application details.</p>
          <Link to="/" className="submit-btn" style={{ width: 'auto' }}>
            Back to Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  if (error || !application) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title" style={{ color: '#f87171' }}>Application Unavailable</h2>
          <p className="subtitle">{error || 'The requested application could not be found.'}</p>
          <Link
            to={user.role === 'recruiter' ? '/recruiter/applications' : '/applications'}
            className="submit-btn"
            style={{ width: 'auto' }}
          >
            ← {user.role === 'recruiter' ? 'Back to Applications' : 'Back to My Applications'}
          </Link>
        </div>
      </Layout>
    );
  }

  const isRecruiter = user.role === 'recruiter';
  const statusStyle = STATUS_COLORS[application.status] || STATUS_COLORS.pending;
  const formattedDate = new Date(application.applied_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <Layout>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <Link
            to={isRecruiter ? '/recruiter/applications' : '/applications'}
            className="tab-btn"
            style={{ textDecoration: 'none', marginBottom: '0.75rem', display: 'inline-block' }}
          >
            ← {isRecruiter ? 'Back to Applications' : 'Back to My Applications'}
          </Link>
          <h1 className="page-title">{application.job_title}</h1>
          <p className="page-subtitle" style={{ color: '#38bdf8', fontSize: '1.05rem', fontWeight: 600 }}>
            {application.company_name} &bull; 📍 {application.location} &bull; 💼 {application.job_type}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              background: statusStyle.bg,
              color: statusStyle.text,
              border: `1px solid ${statusStyle.border}`,
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          >
            Status: {application.status}
          </span>
        </div>
      </div>

      {updateMessage.text && (
        <div className={`alert-message ${updateMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {updateMessage.text}
        </div>
      )}

      {/* Recruiter Status Decision Controls */}
      {isRecruiter && (
        <div
          className="card"
          style={{
            borderColor: '#38bdf8',
            marginBottom: '2rem',
            background: '#0f172a',
            padding: '1.25rem 1.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="status-label" style={{ color: '#38bdf8', fontWeight: 700 }}>
                Hiring Decision Status
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                Update applicant status across the recruitment pipeline.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <select
                value={application.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                style={{ width: 'auto', minWidth: '160px', padding: '0.5rem 0.85rem', fontWeight: 600 }}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
              {updating && <span className="status-value status-checking">Saving status...</span>}
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Responsive Layout: Left: Candidate Details & Resume | Right: Interview Scheduling */}
      <div className="grid-2" style={{ alignItems: 'start', marginBottom: '2rem' }}>
        {/* Left Column: Candidate Profile & Resume */}
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', marginBottom: '1.25rem' }}>
            Candidate Profile & Credentials
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div className="status-label">Candidate Name</div>
              <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>{application.candidate_name}</div>
            </div>

            <div>
              <div className="status-label">Email Address</div>
              <div style={{ color: '#cbd5e1' }}>{application.candidate_email}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div className="status-label">Phone</div>
                <div style={{ color: '#cbd5e1' }}>{application.candidate_phone || 'Not provided'}</div>
              </div>
              <div>
                <div className="status-label">Location</div>
                <div style={{ color: '#cbd5e1' }}>{application.candidate_location || 'Not provided'}</div>
              </div>
            </div>

            {/* Attached Resume */}
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
              <div className="status-label">Attached Resume</div>
              {application.resume ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>📄 {application.resume.file_name}</span>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={() => handleViewResume(application.resume.id, application.resume.file_name)}
                    disabled={viewingResume}
                    style={{ width: 'auto', margin: 0, padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                  >
                    {viewingResume ? 'Loading Resume...' : '👁️ View Resume'}
                  </button>
                </div>
              ) : (
                <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>No resume uploaded</span>
              )}
            </div>

            <div>
              <div className="status-label">Technical Skills</div>
              <div style={{ color: '#cbd5e1' }}>{application.candidate_skills || 'Not specified'}</div>
            </div>

            <div>
              <div className="status-label">Education</div>
              <div style={{ color: '#cbd5e1' }}>{application.candidate_education || 'Not specified'}</div>
            </div>

            <div>
              <div className="status-label">Work Experience</div>
              <div style={{ color: '#cbd5e1' }}>{application.candidate_experience || 'Not specified'}</div>
            </div>

            {application.candidate_bio && (
              <div>
                <div className="status-label">Candidate Bio</div>
                <div style={{ color: '#cbd5e1', whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{application.candidate_bio}</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interview Information & Scheduling Form */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', margin: 0 }}>
              Interview Details
            </h2>
            {interview && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  background: (INTERVIEW_STATUS_COLORS[interview.status] || INTERVIEW_STATUS_COLORS.scheduled).bg,
                  color: (INTERVIEW_STATUS_COLORS[interview.status] || INTERVIEW_STATUS_COLORS.scheduled).text,
                  border: `1px solid ${(INTERVIEW_STATUS_COLORS[interview.status] || INTERVIEW_STATUS_COLORS.scheduled).border}`
                }}
              >
                Status: {interview.status}
              </span>
            )}
          </div>

          {interviewMessage.text && (
            <div
              className={`alert-message ${interviewMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
            >
              {interviewMessage.text}
            </div>
          )}

          {!showInterviewForm ? (
            <div>
              {interview ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div className="status-label">Interview Date</div>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>📅 {interview.interview_date}</div>
                    </div>

                    <div>
                      <div className="status-label">Interview Time</div>
                      <div style={{ color: '#cbd5e1' }}>⏰ {interview.interview_time}</div>
                    </div>

                    <div>
                      <div className="status-label">Mode</div>
                      <div style={{ color: '#38bdf8', fontWeight: 600 }}>🌐 {interview.mode}</div>
                    </div>

                    <div>
                      <div className="status-label">Instructions / Notes</div>
                      <div style={{ color: '#cbd5e1', whiteSpace: 'pre-line', fontSize: '0.9rem' }}>
                        {interview.notes || 'No specific notes provided.'}
                      </div>
                    </div>
                  </div>

                  {isRecruiter && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="tab-btn"
                        onClick={handleOpenEditForm}
                        disabled={interviewSubmitting}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          padding: '0.45rem 1rem'
                        }}
                      >
                        Edit Interview Details
                      </button>

                      {interview.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="tab-btn"
                          onClick={handleCancelInterview}
                          disabled={interviewSubmitting}
                          style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            padding: '0.45rem 1rem'
                          }}
                        >
                          {interviewSubmitting ? 'Cancelling...' : 'Cancel Interview'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
                    {isRecruiter ? 'No interview scheduled for this applicant yet.' : 'Not scheduled.'}
                  </p>

                  {isRecruiter && (
                    <div>
                      {application.status === 'shortlisted' ? (
                        <button
                          type="button"
                          className="submit-btn"
                          onClick={handleOpenScheduleForm}
                          style={{ width: 'auto' }}
                        >
                          Schedule Interview 📅
                        </button>
                      ) : (
                        <p style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                          (Interviews can only be scheduled once the application is shortlisted)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleInterviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
                {isEditingInterview ? 'Edit Interview Information' : 'Schedule Interview'}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Interview Date *</label>
                <input
                  type="date"
                  required
                  value={interviewForm.interview_date}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interview_date: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Interview Time *</label>
                <input
                  type="time"
                  required
                  value={interviewForm.interview_time}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interview_time: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label>Mode *</label>
                <select
                  value={interviewForm.mode}
                  onChange={(e) => setInterviewForm({ ...interviewForm, mode: e.target.value })}
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              {isEditingInterview && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Status *</label>
                  <select
                    value={interviewForm.status}
                    onChange={(e) => setInterviewForm({ ...interviewForm, status: e.target.value })}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div className="form-group" style={{ margin: 0 }}>
                <label>Notes / Instructions</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Technical interview, coding round details, or office location..."
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={interviewSubmitting}
                  style={{ width: 'auto' }}
                >
                  {interviewSubmitting
                    ? 'Saving...'
                    : isEditingInterview
                    ? 'Save Changes'
                    : 'Schedule Interview'}
                </button>
                <button
                  type="button"
                  className="tab-btn"
                  onClick={() => setShowInterviewForm(false)}
                  disabled={interviewSubmitting}
                  style={{ background: '#334155', color: '#f8fafc' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default ApplicationDetails;
