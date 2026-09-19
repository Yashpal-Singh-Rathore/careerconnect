const pool = require('../config/db');

const VALID_JOB_TYPES = ['Full Time', 'Part Time', 'Internship', 'Remote'];

// GET /api/jobs (Active jobs with optional search)
const getAllJobs = async (req, res) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT 
        j.id, 
        j.title, 
        COALESCE(rp.company_name, u.name) AS company_name, 
        j.location, 
        j.salary, 
        j.experience, 
        j.job_type, 
        j.skills, 
        j.status, 
        j.created_at
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      WHERE j.status = 'active'
    `;
    const params = [];

    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      query += ` AND (j.title LIKE ? OR j.location LIKE ? OR j.skills LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY j.created_at DESC`;

    const [rows] = await pool.execute(query, params);

    return res.status(200).json({
      success: true,
      jobs: rows
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching jobs.'
    });
  }
};

// GET /api/jobs/my (Recruiter's own jobs)
const getMyJobs = async (req, res) => {
  try {
    const recruiterId = req.user.userId;

    const query = `
      SELECT 
        j.id, 
        j.title, 
        j.description,
        COALESCE(rp.company_name, u.name) AS company_name, 
        j.location, 
        j.salary, 
        j.experience, 
        j.job_type, 
        j.skills, 
        j.status, 
        j.created_at,
        j.updated_at
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      WHERE j.recruiter_id = ?
      ORDER BY j.created_at DESC
    `;

    const [rows] = await pool.execute(query, [recruiterId]);

    return res.status(200).json({
      success: true,
      jobs: rows
    });
  } catch (error) {
    console.error('Error fetching recruiter jobs:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching your jobs.'
    });
  }
};

// GET /api/jobs/:id (Single job details)
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        j.id, 
        j.recruiter_id,
        j.title, 
        j.description, 
        COALESCE(rp.company_name, u.name) AS company_name, 
        j.location, 
        j.salary, 
        j.experience, 
        j.job_type, 
        j.skills, 
        j.status, 
        j.created_at,
        j.updated_at
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      WHERE j.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    return res.status(200).json({
      success: true,
      job: rows[0]
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching job details.'
    });
  }
};

// POST /api/jobs (Create new job - Recruiter only)
const createJob = async (req, res) => {
  try {
    const recruiterId = req.user.userId;
    const { title, description, location, salary, experience, job_type, skills } = req.body;

    // Validation
    if (!title || !description || !location || !job_type) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, location, and job_type are required.'
      });
    }

    if (!VALID_JOB_TYPES.includes(job_type)) {
      return res.status(400).json({
        success: false,
        message: `Job type must be one of: ${VALID_JOB_TYPES.join(', ')}.`
      });
    }

    const safeSalary = salary !== undefined && salary !== null ? String(salary).trim() : null;
    const safeExperience = experience !== undefined && experience !== null ? String(experience).trim() : null;
    const safeSkills = skills !== undefined && skills !== null ? String(skills).trim() : null;

    const [result] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [recruiterId, title.trim(), description.trim(), location.trim(), safeSalary, safeExperience, job_type, safeSkills]
    );

    const newJobId = result.insertId;

    // Fetch the created job
    const [rows] = await pool.execute(
      `SELECT 
        j.id, 
        j.recruiter_id,
        j.title, 
        j.description, 
        COALESCE(rp.company_name, u.name) AS company_name, 
        j.location, 
        j.salary, 
        j.experience, 
        j.job_type, 
        j.skills, 
        j.status, 
        j.created_at
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      WHERE j.id = ?`,
      [newJobId]
    );

    return res.status(201).json({
      success: true,
      message: 'Job created successfully',
      job: rows[0]
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating job.'
    });
  }
};

// PUT /api/jobs/:id (Update job - Recruiter owner only)
const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = req.user.userId;
    const { title, description, location, salary, experience, job_type, skills, status } = req.body;

    // Check job existence and ownership
    const [existing] = await pool.execute('SELECT * FROM jobs WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    const currentJob = existing[0];

    if (currentJob.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to modify this job.'
      });
    }

    if (job_type && !VALID_JOB_TYPES.includes(job_type)) {
      return res.status(400).json({
        success: false,
        message: `Job type must be one of: ${VALID_JOB_TYPES.join(', ')}.`
      });
    }

    if (status && status !== 'active' && status !== 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "closed".'
      });
    }

    const updatedTitle = title !== undefined ? String(title).trim() : currentJob.title;
    const updatedDescription = description !== undefined ? String(description).trim() : currentJob.description;
    const updatedLocation = location !== undefined ? String(location).trim() : currentJob.location;
    const updatedSalary = salary !== undefined ? (salary ? String(salary).trim() : null) : currentJob.salary;
    const updatedExperience = experience !== undefined ? (experience ? String(experience).trim() : null) : currentJob.experience;
    const updatedJobType = job_type !== undefined ? job_type : currentJob.job_type;
    const updatedSkills = skills !== undefined ? (skills ? String(skills).trim() : null) : currentJob.skills;
    const updatedStatus = status !== undefined ? status : currentJob.status;

    await pool.execute(
      `UPDATE jobs 
       SET title = ?, description = ?, location = ?, salary = ?, experience = ?, job_type = ?, skills = ?, status = ?
       WHERE id = ? AND recruiter_id = ?`,
      [
        updatedTitle,
        updatedDescription,
        updatedLocation,
        updatedSalary,
        updatedExperience,
        updatedJobType,
        updatedSkills,
        updatedStatus,
        id,
        recruiterId
      ]
    );

    // Fetch updated job
    const [rows] = await pool.execute(
      `SELECT 
        j.id, 
        j.recruiter_id,
        j.title, 
        j.description, 
        COALESCE(rp.company_name, u.name) AS company_name, 
        j.location, 
        j.salary, 
        j.experience, 
        j.job_type, 
        j.skills, 
        j.status, 
        j.created_at,
        j.updated_at
      FROM jobs j
      LEFT JOIN recruiter_profiles rp ON j.recruiter_id = rp.user_id
      LEFT JOIN users u ON j.recruiter_id = u.id
      WHERE j.id = ?`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Job updated successfully',
      job: rows[0]
    });
  } catch (error) {
    console.error('Error updating job:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating job.'
    });
  }
};

// DELETE /api/jobs/:id (Soft-close job - Recruiter owner only)
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = req.user.userId;

    // Check job existence and ownership
    const [existing] = await pool.execute('SELECT * FROM jobs WHERE id = ?', [id]);

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    const currentJob = existing[0];

    if (currentJob.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to close this job.'
      });
    }

    // Soft close the job
    await pool.execute('UPDATE jobs SET status = "closed" WHERE id = ? AND recruiter_id = ?', [
      id,
      recruiterId
    ]);

    return res.status(200).json({
      success: true,
      message: 'Job closed successfully'
    });
  } catch (error) {
    console.error('Error closing job:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error closing job.'
    });
  }
};

module.exports = {
  getAllJobs,
  getMyJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
};
