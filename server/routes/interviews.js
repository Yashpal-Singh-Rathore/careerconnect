const express = require('express');
const router = express.Router();
const {
  createInterview,
  getInterviewByApplication,
  updateInterview,
  cancelInterview
} = require('../controllers/interviewController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Recruiter creates an interview for an application
router.post('/', verifyToken, requireRole('recruiter'), createInterview);

// Get interview by application ID (Candidate or Recruiter)
router.get('/application/:applicationId', verifyToken, getInterviewByApplication);

// Recruiter updates an interview
router.put('/:id', verifyToken, requireRole('recruiter'), updateInterview);

// Recruiter cancels an interview (soft delete -> status = 'cancelled')
router.delete('/:id', verifyToken, requireRole('recruiter'), cancelInterview);

module.exports = router;
