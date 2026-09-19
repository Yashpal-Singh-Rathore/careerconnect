import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../services/api';

function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  const fetchJobs = async (search = '') => {
    try {
      setLoading(true);
      setError(null);
      const url = search ? `/jobs?search=${encodeURIComponent(search)}` : '/jobs';
      const response = await api.get(url);
      if (response.data.success) {
        setJobs(response.data.jobs || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setIsSearched(Boolean(searchQuery.trim()));
    fetchJobs(searchQuery.trim());
  };

  const handleClear = () => {
    setSearchQuery('');
    setIsSearched(false);
    fetchJobs('');
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Find Jobs</h1>
          <p className="page-subtitle">
            Explore active career positions and internship opportunities across verified companies.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.75rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            style={{ flex: '1 1 300px' }}
            placeholder="Search by job title, location, or required skill (e.g. React, Java, Remote)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="submit-btn" style={{ width: 'auto', marginTop: 0 }}>
            Search Jobs
          </button>
          {isSearched && (
            <button
              type="button"
              className="tab-btn"
              onClick={handleClear}
              style={{ background: '#334155', color: '#f8fafc' }}
            >
              Clear Search
            </button>
          )}
        </form>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading active job listings...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            {isSearched ? 'No jobs found matching your search criteria.' : 'No active jobs available at this moment.'}
          </p>
          {isSearched && (
            <button type="button" className="submit-btn" onClick={handleClear} style={{ width: 'auto' }}>
              View All Active Jobs
            </button>
          )}
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
                justifyContent: 'space-between',
                flexDirection: 'column',
                gap: '1rem',
                borderLeft: '4px solid #38bdf8'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ color: '#38bdf8', fontSize: '1.3rem', marginBottom: '0.25rem' }}>
                    {job.title}
                  </h3>
                  <p style={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.05rem' }}>
                    {job.company_name || 'Hiring Company'}
                  </p>
                </div>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 700
                  }}
                >
                  {job.job_type}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  flexWrap: 'wrap',
                  fontSize: '0.9rem',
                  color: '#94a3b8'
                }}
              >
                <div>📍 <strong style={{ color: '#cbd5e1' }}>{job.location}</strong></div>
                {job.experience && <div>💼 Experience: <strong style={{ color: '#cbd5e1' }}>{job.experience}</strong></div>}
                {job.salary && <div>💰 Compensation: <strong style={{ color: '#cbd5e1' }}>{job.salary}</strong></div>}
              </div>

              {job.skills && (
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  <span style={{ color: '#64748b' }}>Skills: </span>
                  {job.skills}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="submit-btn"
                  style={{
                    width: 'auto',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.9rem'
                  }}
                >
                  View Job Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default Jobs;
