const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/candidateController');
const { uploadResume, getCurrentResume, deleteResume } = require('../controllers/resumeController');
const { verifyToken, requireRole } = require('../middleware/auth');
const { uploadResumeMiddleware } = require('../middleware/upload');

// Candidate profile routes
router.get('/profile', verifyToken, requireRole('candidate'), getProfile);
router.put('/profile', verifyToken, requireRole('candidate'), updateProfile);

// Candidate resume routes
router.post('/resume', verifyToken, requireRole('candidate'), uploadResumeMiddleware, uploadResume);
router.get('/resume', verifyToken, requireRole('candidate'), getCurrentResume);
router.delete('/resume', verifyToken, requireRole('candidate'), deleteResume);

module.exports = router;
