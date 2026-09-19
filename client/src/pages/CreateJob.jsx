import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

const JOB_TYPES = ['Full Time', 'Part Time', 'Internship', 'Remote'];

function CreateJob() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    salary: '',
    experience: '',
    job_type: 'Full Time',
    skills: '',
    status: 'active'
  });

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEditing) {
      const fetchJob = async () => {
        try {
          setLoading(true);
          const response = await api.get(`/jobs/${id}`);
          if (response.data.success && response.data.job) {
            const job = response.data.job;
            // Ensure logged in recruiter owns the job
            if (user && job.recruiter_id !== user.id) {
              setError('You do not have permission to edit this job.');
              setLoading(false);
              return;
            }
            setFormData({
              title: job.title || '',
              description: job.description || '',
              location: job.location || '',
              salary: job.salary || '',
              experience: job.experience || '',
              job_type: job.job_type || 'Full Time',
              skills: job.skills || '',
              status: job.status || 'active'
            });
          }
        } catch (err) {
          setError(err.response?.data?.message || err.message || 'Failed to load job details.');
        } finally {
          setLoading(false);
        }
      };

      if (!authLoading && user) {
        fetchJob();
      }
    }
  }, [id, isEditing, user, authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isEditing) {
        await api.put(`/jobs/${id}`, formData);
      } else {
        await api.post('/jobs', formData);
      }
      navigate('/recruiter/jobs');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save job.');
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">
            {isEditing ? 'Loading job for editing...' : 'Checking session...'}
          </p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in as a recruiter to access this page.</p>
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
            You are logged in as a <strong>{user.role}</strong>. Only recruiters can create or edit jobs.
          </div>
          <Link to="/jobs" className="submit-btn" style={{ width: 'auto' }}>
            Browse Jobs
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEditing ? 'Edit Job Posting' : 'Post a New Job Opportunity'}
          </h1>
          <p className="page-subtitle">
            {isEditing
              ? 'Update the requirements, role details, or visibility status for this position.'
              : 'Create a new job listing to attract qualified candidates.'}
          </p>
        </div>
        <Link to="/recruiter/jobs" className="tab-btn" style={{ textDecoration: 'none' }}>
          ← Cancel & Return
        </Link>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Job Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Senior Java Developer, Frontend React Engineer"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Location *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bangalore, Remote, Hybrid - Mumbai"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Employment Type *</label>
              <select
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
              >
                {JOB_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Experience Requirement</label>
              <input
                type="text"
                placeholder="e.g. 0-2 years, 3+ years, Freshers"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Salary / Compensation</label>
              <input
                type="text"
                placeholder="e.g. ₹6-10 LPA, $80k-$100k, Competitive"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Required Skills (Comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Java 17, Spring Boot, MySQL, Docker, REST APIs"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
            />
          </div>

          {isEditing && (
            <div className="form-group">
              <label>Job Listing Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="active">Active (Visible to all candidates)</option>
                <option value="closed">Closed (Hidden from public listings)</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Job Description & Responsibilities *</label>
            <textarea
              required
              rows={6}
              placeholder="Detail the daily responsibilities, technical stack, team expectations, and candidate qualifications..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
            <button type="submit" className="submit-btn" disabled={submitting} style={{ width: 'auto' }}>
              {submitting ? 'Saving Job...' : isEditing ? 'Save Job Changes' : 'Publish Job Listing 🚀'}
            </button>
            <Link to="/recruiter/jobs" className="tab-btn" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default CreateJob;
