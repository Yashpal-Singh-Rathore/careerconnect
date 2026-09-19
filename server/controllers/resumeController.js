const path = require('path');
const fs = require('fs');
const pool = require('../config/db');

// POST /api/candidate/resume (Candidate only)
const uploadResume = async (req, res) => {
  try {
    const candidateId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a resume file to upload (.pdf, .doc, or .docx).'
      });
    }

    const fileName = req.file.originalname;
    const relativePath = path.join('uploads/resumes', req.file.filename);
    const fileType = req.file.mimetype || 'application/pdf';
    const fileSize = req.file.size;

    // Check if candidate already has a resume
    const [existing] = await pool.execute(
      'SELECT id, file_path FROM resumes WHERE candidate_id = ?',
      [candidateId]
    );

    let resumeId;

    if (existing.length > 0) {
      const oldResume = existing[0];
      resumeId = oldResume.id;

      // Remove old physical file safely
      const oldFullPath = path.join(__dirname, '..', oldResume.file_path);
      if (fs.existsSync(oldFullPath)) {
        try {
          fs.unlinkSync(oldFullPath);
        } catch (e) {
          console.warn('Could not delete old resume file:', e.message);
        }
      }

      // Update existing record
      await pool.execute(
        `UPDATE resumes 
         SET file_name = ?, file_path = ?, file_type = ?, file_size = ?, uploaded_at = CURRENT_TIMESTAMP 
         WHERE candidate_id = ?`,
        [fileName, relativePath, fileType, fileSize, candidateId]
      );
    } else {
      // Insert new resume record
      const [result] = await pool.execute(
        `INSERT INTO resumes (candidate_id, file_name, file_path, file_type, file_size)
         VALUES (?, ?, ?, ?, ?)`,
        [candidateId, fileName, relativePath, fileType, fileSize]
      );
      resumeId = result.insertId;
    }

    const [rows] = await pool.execute(
      'SELECT id, file_name, file_type, file_size, uploaded_at FROM resumes WHERE id = ?',
      [resumeId]
    );

    return res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully',
      resume: rows[0]
    });
  } catch (error) {
    console.error('Error uploading resume:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during resume upload.'
    });
  }
};

// GET /api/candidate/resume (Candidate only)
const getCurrentResume = async (req, res) => {
  try {
    const candidateId = req.user.userId;

    const [rows] = await pool.execute(
      'SELECT id, file_name, file_type, file_size, uploaded_at FROM resumes WHERE candidate_id = ?',
      [candidateId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        resume: null
      });
    }

    return res.status(200).json({
      success: true,
      resume: rows[0]
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching resume.'
    });
  }
};

// DELETE /api/candidate/resume (Candidate only)
const deleteResume = async (req, res) => {
  try {
    const candidateId = req.user.userId;

    const [rows] = await pool.execute(
      'SELECT id, file_path FROM resumes WHERE candidate_id = ?',
      [candidateId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No resume found to delete.'
      });
    }

    const resume = rows[0];

    // Remove physical file safely
    const fullPath = path.join(__dirname, '..', resume.file_path);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.warn('Could not delete physical resume file:', e.message);
      }
    }

    // Delete DB record
    await pool.execute('DELETE FROM resumes WHERE candidate_id = ?', [candidateId]);

    return res.status(200).json({
      success: true,
      message: 'Resume deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting resume.'
    });
  }
};

// GET /api/resumes/:id (Authenticated Candidate Owner OR Authorized Job Recruiter)
const getResumeFileById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const [rows] = await pool.execute('SELECT * FROM resumes WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found.'
      });
    }

    const resume = rows[0];

    // Authorization checks
    if (userRole === 'candidate') {
      if (resume.candidate_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. You do not have permission to access this resume.'
        });
      }
    } else if (userRole === 'recruiter') {
      // Recruiter must have an application from this candidate for a job they own
      const [applications] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN jobs j ON a.job_id = j.id 
         WHERE a.candidate_id = ? AND j.recruiter_id = ?`,
        [resume.candidate_id, userId]
      );

      if (applications.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden. Candidate has not applied to any of your posted jobs.'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Access restricted.'
      });
    }

    const fullFilePath = path.join(__dirname, '..', resume.file_path);

    if (!fs.existsSync(fullFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Resume file not found on server.'
      });
    }

    res.setHeader('Content-Type', resume.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resume.file_name)}"`);
    return res.sendFile(fullFilePath);
  } catch (error) {
    console.error('Error serving resume file:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error accessing resume file.'
    });
  }
};

module.exports = {
  uploadResume,
  getCurrentResume,
  deleteResume,
  getResumeFileById
};
