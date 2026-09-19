const express = require('express');
const router = express.Router();
const { getRecruiterReports } = require('../controllers/reportController');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/recruiter/reports (Recruiter only)
router.get('/', verifyToken, requireRole('recruiter'), getRecruiterReports);

module.exports = router;
