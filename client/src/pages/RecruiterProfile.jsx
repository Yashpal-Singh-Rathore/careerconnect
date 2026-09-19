import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';

function RecruiterProfile() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    company_name: '',
    phone: '',
    location: '',
    company_description: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || user.role !== 'recruiter') {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await api.get('/recruiter/profile');
        if (response.data.success && response.data.profile) {
          setProfile({
            name: response.data.profile.name || user.name || '',
            email: response.data.profile.email || user.email || '',
            company_name: response.data.profile.company_name || '',
            phone: response.data.profile.phone || '',
            location: response.data.profile.location || '',
            company_description: response.data.profile.company_description || ''
          });
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

    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });
    setSaving(true);

    try {
      const payload = {
        company_name: profile.company_name,
        phone: profile.phone,
        location: profile.location,
        company_description: profile.company_description
      };

      const response = await api.put('/recruiter/profile', payload);
      if (response.data.success) {
        setStatusMessage({
          type: 'success',
          text: response.data.message || 'Company profile saved successfully!'
        });
        if (response.data.profile) {
          setProfile((prev) => ({
            ...prev,
            ...response.data.profile
          }));
        }
      }
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to save profile'
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading recruiter profile...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in to view your recruiter profile.</p>
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
            You are currently logged in as a <strong>{user.role}</strong>. This profile page is only accessible to recruiters.
          </div>
          <Link to="/candidate/profile" className="submit-btn" style={{ width: 'auto' }}>
            Go to Candidate Profile
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recruiter Profile</h1>
          <p className="page-subtitle">
            Manage your company information, brand profile, contact details, and location displayed to job applicants.
          </p>
        </div>
        <Link to="/recruiter/dashboard" className="tab-btn" style={{ textDecoration: 'none' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {statusMessage.text && (
        <div className={`alert-message ${statusMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {statusMessage.text}
        </div>
      )}

      <div className="card" style={{ maxWidth: '800px', margin: '0' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Recruiter Full Name (Account)</label>
              <input
                type="text"
                value={profile.name || user.name}
                readOnly
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label>Email Address (Account)</label>
              <input
                type="email"
                value={profile.email || user.email}
                readOnly
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Company / Organization Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Innovations Corp."
                value={profile.company_name}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Contact Phone Number</label>
              <input
                type="text"
                placeholder="e.g. +91 9876543210"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Headquarters / Office Location</label>
            <input
              type="text"
              placeholder="e.g. Bangalore, India & Remote"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Company Overview & Culture</label>
            <textarea
              rows={5}
              placeholder="Describe your company's mission, industry domain, growth trajectory, work culture, and employee benefits..."
              value={profile.company_description}
              onChange={(e) => setProfile({ ...profile, company_description: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button type="submit" className="submit-btn" disabled={saving} style={{ width: 'auto' }}>
              {saving ? 'Saving Profile...' : 'Save Company Profile'}
            </button>
            <Link to="/recruiter/dashboard" className="tab-btn" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}

export default RecruiterProfile;
