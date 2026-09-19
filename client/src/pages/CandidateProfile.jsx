import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function CandidateProfile() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    skills: '',
    education: '',
    experience: '',
    bio: ''
  });

  const [resume, setResume] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [replaceFile, setReplaceFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [deletingResume, setDeletingResume] = useState(false);
  const [viewingResume, setViewingResume] = useState(false);

  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [resumeMessage, setResumeMessage] = useState({ type: '', text: '' });

  const fetchProfileAndResume = async () => {
    if (!user || user.role !== 'candidate') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Fetch Profile
      const profileRes = await api.get('/candidate/profile');
      if (profileRes.data.success && profileRes.data.profile) {
        setProfile({
          name: profileRes.data.profile.name || user.name || '',
          email: profileRes.data.profile.email || user.email || '',
          phone: profileRes.data.profile.phone || '',
          location: profileRes.data.profile.location || '',
          skills: profileRes.data.profile.skills || '',
          education: profileRes.data.profile.education || '',
          experience: profileRes.data.profile.experience || '',
          bio: profileRes.data.profile.bio || ''
        });
      }

      // 2. Fetch Resume
      const resumeRes = await api.get('/candidate/resume');
      if (resumeRes.data.success) {
        setResume(resumeRes.data.resume);
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load profile details'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchProfileAndResume();
    }
  }, [user, authLoading]);

  // Handle Profile Save
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    try {
      const response = await api.put('/candidate/profile', profile);
      if (response.data.success) {
        setStatusMessage({ type: 'success', text: 'Candidate profile updated successfully!' });
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to update profile'
      });
    } finally {
      setSaving(false);
    }
  };

  // Upload New Resume
  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      setResumeMessage({ type: 'error', text: 'Please select a resume file to upload.' });
      return;
    }

    setUploadingResume(true);
    setResumeMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('resume', resumeFile);

    try {
      const response = await api.post('/candidate/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setResume(response.data.resume);
        setResumeFile(null);
        setResumeMessage({ type: 'success', text: 'Resume uploaded successfully!' });
      }
    } catch (error) {
      setResumeMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to upload resume'
      });
    } finally {
      setUploadingResume(false);
    }
  };

  // Replace Existing Resume
  const handleResumeReplace = async (e) => {
    e.preventDefault();
    if (!replaceFile) {
      setResumeMessage({ type: 'error', text: 'Please select a file to replace your resume.' });
      return;
    }

    setUploadingResume(true);
    setResumeMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('resume', replaceFile);

    try {
      const response = await api.post('/candidate/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setResume(response.data.resume);
        setReplaceFile(null);
        setResumeMessage({ type: 'success', text: 'Resume replaced successfully!' });
      }
    } catch (error) {
      setResumeMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to replace resume'
      });
    } finally {
      setUploadingResume(false);
    }
  };

  // Delete Resume
  const handleDeleteResume = async () => {
    if (!window.confirm('Are you sure you want to delete your resume?')) return;

    setDeletingResume(true);
    setResumeMessage({ type: '', text: '' });

    try {
      const response = await api.delete('/candidate/resume');
      if (response.data.success) {
        setResume(null);
        setResumeMessage({ type: 'success', text: 'Resume deleted successfully.' });
      }
    } catch (error) {
      setResumeMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to delete resume'
      });
    } finally {
      setDeletingResume(false);
    }
  };

  // View / Download Resume
  const handleViewResume = async () => {
    if (!resume) return;

    try {
      setViewingResume(true);
      const response = await api.get(`/resumes/${resume.id}`, {
        responseType: 'blob'
      });

      const contentType = response.headers['content-type'] || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);

      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = resume.file_name || 'resume.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      alert('Failed to view resume: ' + (err.response?.data?.message || err.message));
    } finally {
      setViewingResume(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading candidate profile...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">Please log in to manage your candidate profile.</p>
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
            You are logged in as a <strong>{user.role}</strong>. This profile page is only accessible to candidates.
          </div>
          <Link to="/recruiter/profile" className="submit-btn" style={{ width: 'auto' }}>
            Go to Recruiter Profile →
          </Link>
        </div>
      </Layout>
    );
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Candidate Profile</h1>
          <p className="page-subtitle">
            Manage your personal profile, technical skills, experience background, and uploaded resume.
          </p>
        </div>
        <Link to="/candidate/dashboard" className="tab-btn" style={{ textDecoration: 'none' }}>
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left Column: Personal Info & Resume */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Resume Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', margin: 0 }}>
                Resume Management
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PDF, DOC, DOCX (Max 5MB)</span>
            </div>

            {resumeMessage.text && (
              <div className={`alert-message ${resumeMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
                {resumeMessage.text}
              </div>
            )}

            {resume ? (
              <div>
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '1rem', wordBreak: 'break-all' }}>
                    📄 {resume.file_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                    Size: {formatFileSize(resume.file_size)} &bull; Uploaded:{' '}
                    {new Date(resume.uploaded_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={handleViewResume}
                    disabled={viewingResume}
                    style={{ width: 'auto', margin: 0, padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  >
                    {viewingResume ? 'Loading Resume...' : '👁️ View Resume'}
                  </button>

                  <button
                    type="button"
                    className="logout-btn"
                    onClick={handleDeleteResume}
                    disabled={deletingResume}
                    style={{ margin: 0, padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  >
                    {deletingResume ? 'Deleting...' : '🗑️ Delete Resume'}
                  </button>
                </div>

                {/* Replace Resume */}
                <div style={{ borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem' }}>
                    Replace Current Resume:
                  </label>
                  <form onSubmit={handleResumeReplace} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setReplaceFile(e.target.files[0])}
                      style={{ flex: 1, minWidth: '180px' }}
                    />
                    <button
                      type="submit"
                      className="tab-btn"
                      disabled={uploadingResume || !replaceFile}
                      style={{ background: '#0284c7', color: '#ffffff' }}
                    >
                      {uploadingResume ? 'Uploading...' : 'Replace'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  You have not uploaded a resume yet. Uploading a resume allows recruiters to review your qualifications when you apply to jobs.
                </p>
                <form onSubmit={handleResumeUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setResumeFile(e.target.files[0])}
                  />
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={uploadingResume || !resumeFile}
                    style={{ width: 'auto', alignSelf: 'flex-start' }}
                  >
                    {uploadingResume ? 'Uploading...' : 'Upload Resume 📄'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Profile Edit Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', marginBottom: '1.25rem' }}>
            Edit Profile Information
          </h2>

          {statusMessage.text && (
            <div className={`alert-message ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
              {statusMessage.text}
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Location (City, Country)</label>
                <input
                  type="text"
                  placeholder="e.g. Bangalore, India"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Skills (Comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. React, Node.js, Python, SQL, Git"
                value={profile.skills}
                onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Education</label>
              <textarea
                rows="2"
                placeholder="e.g. B.Tech in Computer Science, ABC University (2022-2026)"
                value={profile.education}
                onChange={(e) => setProfile({ ...profile, education: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Experience</label>
              <textarea
                rows="2"
                placeholder="e.g. 1 year internship as Frontend Developer at XYZ Corp"
                value={profile.experience}
                onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Short Bio / Professional Summary</label>
              <textarea
                rows="3"
                placeholder="Brief introduction highlighting your career interests and background..."
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1rem' }}>
              <button type="submit" className="submit-btn" disabled={saving} style={{ width: 'auto' }}>
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default CandidateProfile;
