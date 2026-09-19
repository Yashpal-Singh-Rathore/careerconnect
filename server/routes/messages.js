const express = require('express');
const router = express.Router();
const { getConversations, getMessagesWithUser } = require('../controllers/messageController');
const { verifyToken } = require('../middleware/auth');

// Get allowed conversations list (candidates see recruiters, recruiters see candidates)
router.get('/conversations', verifyToken, getConversations);

// Get message history with a specific user (requires valid relationship)
router.get('/:userId', verifyToken, getMessagesWithUser);

module.exports = router;
