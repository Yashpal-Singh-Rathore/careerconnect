const pool = require('../config/db');

const VALID_MODES = ['Online', 'Offline'];
const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];

// Helper to format date as YYYY-MM-DD
const formatDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  if (dateVal instanceof Date) {
    const year = dateVal.getFullYear();
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const day = String(dateVal.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateVal;
};

// Helper to format time as HH:MM or HH:MM:SS string
const formatTime = (timeVal) => {
  if (!timeVal) return null;
  return timeVal.toString();
};

// POST /api/interviews (Recruiter only)
const createInterview = async (req, res) => {
  try {
    const recruiterId = req.user.userId;
    const { application_id, interview_date, interview_time, mode, notes } = req.body;

    // Validate required fields
    if (!application_id || !interview_date || !interview_time || !mode) {
      return res.status(400).json({
        success: false,
        message: 'Application ID, interview date, interview time, and mode are required.'
      });
    }

    if (!VALID_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode must be one of: ${VALID_MODES.join(', ')}.`
      });
    }

    // Verify application existence & fetch status and job owner
    const [appRows] = await pool.execute(
      `SELECT a.id, a.status, j.recruiter_id
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`,
      [application_id]
    );

    if (appRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const application = appRows[0];

    // Check recruiter ownership of the job
    if (application.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to schedule an interview for this application.'
      });
    }

    // Check application status - only shortlisted allowed
    if (application.status !== 'shortlisted') {
      return res.status(400).json({
        success: false,
        message: 'Interview can only be scheduled for shortlisted applications.'
      });
    }

    // Check if an interview already exists
    const [existingInterviews] = await pool.execute(
      'SELECT id FROM interviews WHERE application_id = ?',
      [application_id]
    );

    if (existingInterviews.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An interview has already been scheduled for this application.'
      });
    }

    // Insert interview record
    const [result] = await pool.execute(
      `INSERT INTO interviews (application_id, scheduled_by, interview_date, interview_time, mode, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [application_id, recruiterId, interview_date, interview_time, mode, notes || null]
    );

    const [createdRows] = await pool.execute(
      'SELECT id, application_id, interview_date, interview_time, mode, notes, status FROM interviews WHERE id = ?',
      [result.insertId]
    );

    const created = createdRows[0];

    return res.status(201).json({
      success: true,
      message: 'Interview scheduled successfully',
      interview: {
        id: created.id,
        application_id: created.application_id,
        interview_date: formatDate(created.interview_date),
        interview_time: formatTime(created.interview_time),
        mode: created.mode,
        notes: created.notes,
        status: created.status
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'An interview has already been scheduled for this application.'
      });
    }
    console.error('Error creating interview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error creating interview.'
    });
  }
};

// GET /api/interviews/application/:applicationId (Candidate or Recruiter)
const getInterviewByApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Verify application existence and check authorization
    const [appRows] = await pool.execute(
      `SELECT a.id, a.candidate_id, j.recruiter_id
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`,
      [applicationId]
    );

    if (appRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const app = appRows[0];

    if (userRole === 'candidate' && app.candidate_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this interview.'
      });
    }

    if (userRole === 'recruiter' && app.recruiter_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view this interview.'
      });
    }

    const [rows] = await pool.execute(
      'SELECT id, application_id, interview_date, interview_time, mode, notes, status FROM interviews WHERE application_id = ?',
      [applicationId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        interview: null
      });
    }

    const interview = rows[0];

    return res.status(200).json({
      success: true,
      interview: {
        id: interview.id,
        application_id: interview.application_id,
        interview_date: formatDate(interview.interview_date),
        interview_time: formatTime(interview.interview_time),
        mode: interview.mode,
        notes: interview.notes,
        status: interview.status
      }
    });
  } catch (error) {
    console.error('Error fetching interview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching interview.'
    });
  }
};

// PUT /api/interviews/:id (Recruiter only)
const updateInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = req.user.userId;
    const { interview_date, interview_time, mode, notes, status } = req.body;

    // Verify interview existence & check recruiter ownership through application -> job
    const [rows] = await pool.execute(
      `SELECT i.id, i.application_id, i.interview_date, i.interview_time, i.mode, i.notes, i.status, j.recruiter_id
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE i.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found.'
      });
    }

    const interview = rows[0];

    if (interview.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to update this interview.'
      });
    }

    if (mode && !VALID_MODES.includes(mode)) {
      return res.status(400).json({
        success: false,
        message: `Mode must be one of: ${VALID_MODES.join(', ')}.`
      });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`
      });
    }

    const updatedDate = interview_date !== undefined ? interview_date : formatDate(interview.interview_date);
    const updatedTime = interview_time !== undefined ? interview_time : interview.interview_time;
    const updatedMode = mode !== undefined ? mode : interview.mode;
    const updatedNotes = notes !== undefined ? notes : interview.notes;
    const updatedStatus = status !== undefined ? status : interview.status;

    await pool.execute(
      `UPDATE interviews 
       SET interview_date = ?, interview_time = ?, mode = ?, notes = ?, status = ?
       WHERE id = ?`,
      [updatedDate, updatedTime, updatedMode, updatedNotes, updatedStatus, id]
    );

    const [updatedRows] = await pool.execute(
      'SELECT id, application_id, interview_date, interview_time, mode, notes, status FROM interviews WHERE id = ?',
      [id]
    );

    const updated = updatedRows[0];

    return res.status(200).json({
      success: true,
      message: 'Interview updated successfully',
      interview: {
        id: updated.id,
        application_id: updated.application_id,
        interview_date: formatDate(updated.interview_date),
        interview_time: formatTime(updated.interview_time),
        mode: updated.mode,
        notes: updated.notes,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('Error updating interview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating interview.'
    });
  }
};

// DELETE /api/interviews/:id (Recruiter only - soft cancel)
const cancelInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const recruiterId = req.user.userId;

    // Verify interview existence & check recruiter ownership through application -> job
    const [rows] = await pool.execute(
      `SELECT i.id, j.recruiter_id
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN jobs j ON a.job_id = j.id
       WHERE i.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found.'
      });
    }

    const interview = rows[0];

    if (interview.recruiter_id !== recruiterId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to cancel this interview.'
      });
    }

    // Set status = 'cancelled' (do NOT physically delete the row)
    await pool.execute("UPDATE interviews SET status = 'cancelled' WHERE id = ?", [id]);

    return res.status(200).json({
      success: true,
      message: 'Interview cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling interview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error cancelling interview.'
    });
  }
};

module.exports = {
  createInterview,
  getInterviewByApplication,
  updateInterview,
  cancelInterview
};
