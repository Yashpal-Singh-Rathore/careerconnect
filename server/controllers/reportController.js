const pool = require('../config/db');

// GET /api/recruiter/reports (Recruiter only)
const getRecruiterReports = async (req, res) => {
  try {
    const recruiterId = req.user.userId;

    // 1. Count active jobs belonging to the logged-in recruiter
    const [jobRows] = await pool.execute(
      'SELECT COUNT(*) AS active_jobs FROM jobs WHERE recruiter_id = ? AND status = "active"',
      [recruiterId]
    );
    const activeJobs = Number(jobRows[0]?.active_jobs) || 0;

    // 2. Count application statistics belonging to the logged-in recruiter's jobs
    const [appRows] = await pool.execute(
      `SELECT 
        COUNT(a.id) AS total_applications,
        SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS pending_applications,
        SUM(CASE WHEN a.status = 'shortlisted' THEN 1 ELSE 0 END) AS shortlisted_applications,
        SUM(CASE WHEN a.status = 'selected' THEN 1 ELSE 0 END) AS selected_applications,
        SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_applications
      FROM jobs j
      JOIN applications a ON j.id = a.job_id
      WHERE j.recruiter_id = ?`,
      [recruiterId]
    );

    const appStats = appRows[0] || {};
    const totalApplications = Number(appStats.total_applications) || 0;
    const pendingApplications = Number(appStats.pending_applications) || 0;
    const shortlistedApplications = Number(appStats.shortlisted_applications) || 0;
    const selectedApplications = Number(appStats.selected_applications) || 0;
    const rejectedApplications = Number(appStats.rejected_applications) || 0;

    // 3. Status breakdown (all 4 statuses always present)
    const statusBreakdown = [
      { status: 'pending', count: pendingApplications },
      { status: 'shortlisted', count: shortlistedApplications },
      { status: 'selected', count: selectedApplications },
      { status: 'rejected', count: rejectedApplications }
    ];

    return res.status(200).json({
      success: true,
      stats: {
        active_jobs: activeJobs,
        total_applications: totalApplications,
        pending_applications: pendingApplications,
        shortlisted_applications: shortlistedApplications,
        selected_applications: selectedApplications,
        rejected_applications: rejectedApplications
      },
      status_breakdown: statusBreakdown
    });
  } catch (error) {
    console.error('Error fetching recruiter reports:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching reports.'
    });
  }
};

module.exports = {
  getRecruiterReports
};
