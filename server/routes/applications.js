const express = require('express');
const router = express.Router();
const {
  applyToJob,
  getMyApplications,
  getApplicationById,
  updateApplicationStatus
} = require('../controllers/applicationController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Candidate applies to a job
router.post('/', verifyToken, requireRole('candidate'), applyToJob);

// Candidate views their applications (must precede /:id)
router.get('/my', verifyToken, requireRole('candidate'), getMyApplications);

// View single application details (Candidate owner or Recruiter job owner)
router.get('/:id', verifyToken, getApplicationById);

// Recruiter updates application status
router.put('/:id/status', verifyToken, requireRole('recruiter'), updateApplicationStatus);

module.exports = router;
