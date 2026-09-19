const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/recruiterController');
const { getRecruiterApplications } = require('../controllers/applicationController');
const { verifyToken, requireRole } = require('../middleware/auth');

// All recruiter routes require token and 'recruiter' role
router.get('/profile', verifyToken, requireRole('recruiter'), getProfile);
router.put('/profile', verifyToken, requireRole('recruiter'), updateProfile);

// Recruiter applications list
router.get('/applications', verifyToken, requireRole('recruiter'), getRecruiterApplications);

module.exports = router;
