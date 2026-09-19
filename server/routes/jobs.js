const express = require('express');
const router = express.Router();
const {
  getAllJobs,
  getMyJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob
} = require('../controllers/jobController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Public / Candidate active jobs listing (with search)
router.get('/', getAllJobs);

// Recruiter's own jobs listing (must precede /:id)
router.get('/my', verifyToken, requireRole('recruiter'), getMyJobs);

// Single job details
router.get('/:id', getJobById);

// Create job (Recruiter only)
router.post('/', verifyToken, requireRole('recruiter'), createJob);

// Update job (Recruiter owner only)
router.put('/:id', verifyToken, requireRole('recruiter'), updateJob);

// Soft close job (Recruiter owner only)
router.delete('/:id', verifyToken, requireRole('recruiter'), deleteJob);

module.exports = router;
