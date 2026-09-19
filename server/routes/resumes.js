const express = require('express');
const router = express.Router();
const { getResumeFileById } = require('../controllers/resumeController');
const { verifyToken } = require('../middleware/auth');

// GET /api/resumes/:id (Authenticated access for candidate owner or authorized recruiter)
router.get('/:id', verifyToken, getResumeFileById);

module.exports = router;
