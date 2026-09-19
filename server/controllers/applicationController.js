const pool = require('../config/db');

const VALID_STATUSES = ['pending', 'shortlisted', 'rejected', 'selected'];

// POST /api/applications (Candidate only)
const applyToJob = async (req, res) => {
  try {
    const candidateId = req.user.userId;
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required.'
      });
    }

    // 1. Verify job exists
    const [jobs] = await pool.execute('SELECT id, status FROM jobs WHERE id = ?', [job_id]);

    if (jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    const job = jobs[0];

    // 2. Verify job is currently active
    if (job.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply to a closed job.'
      });
    }

    // 3. Verify candidate has not already applied
    const [existing] = await pool.execute(
      'SELECT id FROM applications WHERE job_id = ? AND candidate_id = ?',
      [job_id, candidateId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job'
      });
    }

    // 4. Create application with status 'pending'
    const [result] = await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, "pending")',
      [job_id, candidateId]
    );

    const [rows] = await pool.execute(
      'SELECT id, job_id, candidate_id, status, applied_at FROM applications WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      application: rows[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job'
      });
    }
    console.error('Error applying to job:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error submitting application.'
    });
  }
};

// GET /api/applications/my (Candidate only)
const getMyApplications = async (req, res) => {
  try {
    const candidateId = req.user.userId;

    const query = `
      SELECT 
        a.id, 
        a.job_id, 
        j.title AS job_title, 
        COALESCE(rp.company_name, ru.name) AS company_name, 
        j.location, 
        j.job_type, 
        a.status, 
        a.applied_at,
        i.status AS interview_status
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users ru ON j.recruiter_id = ru.id
      LEFT JOIN interviews i ON a.id = i.application_id
      WHERE a.candidate_id = ?
      ORDER BY a.applied_at DESC
    `;

    const [rows] = await pool.execute(query, [candidateId]);

    return res.status(200).json({
      success: true,
      applications: rows
    });
  } catch (error) {
    console.error('Error fetching candidate applications:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching your applications.'
    });
  }
};

// GET /api/applications/:id (Candidate or Recruiter owner)
const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const query = `
      SELECT 
        a.id, 
        a.job_id, 
        a.candidate_id, 
        a.status, 
        a.applied_at,
        j.recruiter_id,
        j.title AS job_title, 
        COALESCE(rp.company_name, ru.name) AS company_name, 
        j.location, 
        j.salary,
        j.experience,
        j.job_type, 
        j.skills AS job_skills,
        j.description AS job_description,
        cu.name AS candidate_name,
        cu.email AS candidate_email,
        cp.phone AS candidate_phone,
        cp.location AS candidate_location,
        cp.skills AS candidate_skills,
        cp.education AS candidate_education,
        cp.experience AS candidate_experience,
        cp.bio AS candidate_bio,
        r.id AS resume_id,
        r.file_name AS resume_file_name
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN users cu ON a.candidate_id = cu.id
      LEFT JOIN candidate_profiles cp ON a.candidate_id = cp.user_id
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users ru ON j.recruiter_id = ru.id
      LEFT JOIN resumes r ON a.candidate_id = r.candidate_id
      WHERE a.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const app = rows[0];

    // Authorization check
    if (userRole === 'candidate' && app.candidate_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this application.'
      });
    }

    if (userRole === 'recruiter' && app.recruiter_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this application.'
      });
    }

    return res.status(200).json({
      success: true,
      application: {
        id: app.id,
        job_id: app.job_id,
        status: app.status,
        applied_at: app.applied_at,
        job_title: app.job_title,
        company_name: app.company_name,
        location: app.location,
        salary: app.salary,
        experience: app.experience,
        job_type: app.job_type,
        job_skills: app.job_skills,
        job_description: app.job_description,
        candidate_name: app.candidate_name,
        candidate_email: app.candidate_email,
        candidate_phone: app.candidate_phone || '',
        candidate_location: app.candidate_location || '',
        candidate_skills: app.candidate_skills || '',
        candidate_education: app.candidate_education || '',
        candidate_experience: app.candidate_experience || '',
        candidate_bio: app.candidate_bio || '',
        resume: app.resume_id ? { id: app.resume_id, file_name: app.resume_file_name } : null
      }
    });
  } catch (error) {
    console.error('Error fetching application details:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching application details.'
    });
  }
};

// GET /api/recruiter/applications (Recruiter only)
const getRecruiterApplications = async (req, res) => {
  try {
    const recruiterId = req.user.userId;

    const query = `
      SELECT 
        a.id, 
        a.job_id, 
        j.title AS job_title, 
        a.candidate_id, 
        cu.name AS candidate_name, 
        cu.email AS candidate_email, 
        COALESCE(cp.phone, '') AS candidate_phone, 
        COALESCE(cp.location, '') AS candidate_location, 
        COALESCE(cp.skills, '') AS candidate_skills, 
        COALESCE(cp.education, '') AS candidate_education, 
        COALESCE(cp.experience, '') AS candidate_experience, 
        COALESCE(cp.bio, '') AS candidate_bio, 
        a.status, 
        a.applied_at, 
        r.id AS resume_id, 
        r.file_name AS resume_file_name,
        i.status AS interview_status
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN users cu ON a.candidate_id = cu.id
      LEFT JOIN candidate_profiles cp ON a.candidate_id = cp.user_id
      LEFT JOIN resumes r ON a.candidate_id = r.candidate_id
      LEFT JOIN interviews i ON a.id = i.application_id
      WHERE j.recruiter_id = ?
      ORDER BY a.applied_at DESC
    `;

    const [rows] = await pool.execute(query, [recruiterId]);

    const formattedApplications = rows.map((app) => ({
      id: app.id,
      job_id: app.job_id,
      job_title: app.job_title,
      candidate_id: app.candidate_id,
      candidate_name: app.candidate_name,
      candidate_email: app.candidate_email,
      candidate_phone: app.candidate_phone,
      candidate_location: app.candidate_location,
      candidate_skills: app.candidate_skills,
      candidate_education: app.candidate_education,
      candidate_experience: app.candidate_experience,
      candidate_bio: app.candidate_bio,
      status: app.status,
      applied_at: app.applied_at,
      interview_status: app.interview_status || null,
      resume: app.resume_id ? { id: app.resume_id, file_name: app.resume_file_name } : null
    }));

    return res.status(200).json({
      success: true,
      applications: formattedApplications
    });
  } catch (error) {
    console.error('Error fetching recruiter applications:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching candidate applications.'
    });
  }
};

// PUT /api/applications/:id/status (Recruiter owner only)
const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = req.user.userId;
    const { status } = req.body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`
      });
    }

    // Verify application existence & recruiter ownership of the associated job
    const [rows] = await pool.execute(
      `SELECT a.id, j.recruiter_id
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const app = rows[0];

    if (app.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to update this application.'
      });
    }

    await pool.execute('UPDATE applications SET status = ? WHERE id = ?', [status, id]);

    return res.status(200).json({
      success: true,
      message: 'Application status updated',
      application: {
        id: parseInt(id, 10),
        status
      }
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating application status.'
    });
  }
};

module.exports = {
  applyToJob,
  getMyApplications,
  getApplicationById,
  getRecruiterApplications,
  updateApplicationStatus
};
