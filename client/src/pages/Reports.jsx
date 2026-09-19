import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../services/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';

const STATUS_BAR_COLORS = {
  Pending: '#eab308',
  Shortlisted: '#38bdf8',
  Selected: '#22c55e',
  Rejected: '#ef4444'
};

function Reports() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/recruiter/reports');
      if (response.data.success) {
        setStats(response.data.stats || {});
        
        // Format breakdown for chart
        const formatted = (response.data.status_breakdown || []).map((item) => ({
          status: item.status.charAt(0).toUpperCase() + item.status.slice(1),
          count: Number(item.count) || 0
        }));
        setChartData(formatted);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && user.role === 'recruiter') {
      fetchReports();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p className="status-value status-checking">Loading reports & analytics...</p>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 className="title">Access Denied</h2>
          <p className="subtitle">You must be logged in as a recruiter to view reports.</p>
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
            You are currently logged in as a <strong>{user.role}</strong>. Reports & analytics are restricted to recruiters.
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
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">
            Overview of job postings, total applicants, and recruitment pipeline distribution.
          </p>
        </div>
        <Link to="/recruiter/dashboard" className="tab-btn" style={{ textDecoration: 'none' }}>
          ← Back to Dashboard
        </Link>
      </div>

      {error && <div className="alert-message alert-error">{error}</div>}

      {/* 6 Statistics Cards */}
      <div className="grid-stats" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ borderColor: '#38bdf8' }}>
          <div className="stat-label">Active Jobs</div>
          <div className="stat-value" style={{ color: '#38bdf8' }}>{stats?.active_jobs ?? 0}</div>
        </div>

        <div className="stat-card" style={{ borderColor: '#818cf8' }}>
          <div className="stat-label">Total Applications</div>
          <div className="stat-value" style={{ color: '#818cf8' }}>{stats?.total_applications ?? 0}</div>
        </div>

        <div className="stat-card" style={{ borderColor: '#eab308' }}>
          <div className="stat-label">Pending Review</div>
          <div className="stat-value" style={{ color: '#facc15' }}>{stats?.pending_applications ?? 0}</div>
        </div>

        <div className="stat-card" style={{ borderColor: '#0284c7' }}>
          <div className="stat-label">Shortlisted</div>
          <div className="stat-value" style={{ color: '#38bdf8' }}>{stats?.shortlisted_applications ?? 0}</div>
        </div>

        <div className="stat-card" style={{ borderColor: '#22c55e' }}>
          <div className="stat-label">Selected</div>
          <div className="stat-value" style={{ color: '#4ade80' }}>{stats?.selected_applications ?? 0}</div>
        </div>

        <div className="stat-card" style={{ borderColor: '#ef4444' }}>
          <div className="stat-label">Rejected</div>
          <div className="stat-value" style={{ color: '#f87171' }}>{stats?.rejected_applications ?? 0}</div>
        </div>
      </div>

      {/* Application Status Chart */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          Application Status Breakdown
        </h3>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 30, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="status" stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
              <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: '#cbd5e1', fontSize: 13 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  borderColor: '#475569',
                  borderRadius: '6px',
                  color: '#f8fafc'
                }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Bar dataKey="count" name="Applications" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_BAR_COLORS[entry.status] || '#38bdf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}

export default Reports;
