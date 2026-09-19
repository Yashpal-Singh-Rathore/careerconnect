const pool = require('../config/db');

// Helper to check if two users have an established Candidate <-> Recruiter application relationship
const canUsersCommunicate = async (user1Id, user2Id) => {
  const u1 = parseInt(user1Id, 10);
  const u2 = parseInt(user2Id, 10);
  if (!u1 || !u2 || u1 === u2) return false;

  const [rows] = await pool.execute(
    `SELECT 1 FROM applications a
     JOIN jobs j ON a.job_id = j.id
     WHERE (a.candidate_id = ? AND j.recruiter_id = ?)
        OR (a.candidate_id = ? AND j.recruiter_id = ?)
     LIMIT 1`,
    [u1, u2, u2, u1]
  );
  return rows.length > 0;
};

// GET /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let contactsQuery = '';
    if (userRole === 'candidate') {
      // Find recruiters of jobs the candidate applied to
      contactsQuery = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.role,
          COALESCE(rp.company_name, '') AS company_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON j.recruiter_id = u.id
        LEFT JOIN recruiter_profiles rp ON u.id = rp.user_id
        WHERE a.candidate_id = ?
      `;
    } else {
      // Find candidates who applied to the recruiter's jobs
      contactsQuery = `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.role,
          '' AS company_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON a.candidate_id = u.id
        WHERE j.recruiter_id = ?
      `;
    }

    const [contacts] = await pool.execute(contactsQuery, [userId]);

    // For each contact, fetch the latest message if any
    const conversations = await Promise.all(
      contacts.map(async (contact) => {
        const [latestMsgRows] = await pool.execute(
          `SELECT message, created_at
           FROM messages
           WHERE (sender_id = ? AND receiver_id = ?)
              OR (sender_id = ? AND receiver_id = ?)
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [userId, contact.id, contact.id, userId]
        );

        const latestMsg = latestMsgRows[0] || null;

        return {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          role: contact.role,
          company_name: contact.company_name,
          latest_message: latestMsg ? latestMsg.message : null,
          latest_message_time: latestMsg ? latestMsg.created_at : null,
          last_message: latestMsg ? latestMsg.message : null,
          last_message_at: latestMsg ? latestMsg.created_at : null
        };
      })
    );

    // Sort by latest message time (most recent first), then alphabetically by name
    conversations.sort((a, b) => {
      const timeA = a.latest_message_time ? new Date(a.latest_message_time).getTime() : 0;
      const timeB = b.latest_message_time ? new Date(b.latest_message_time).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching conversations.'
    });
  }
};

// GET /api/messages/:userId
const getMessagesWithUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = parseInt(req.params.userId, 10);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Valid user ID is required.'
      });
    }

    // Verify application relationship authorization
    const isAllowed = await canUsersCommunicate(currentUserId, targetUserId);
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view messages with this user.'
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, sender_id, receiver_id, message, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC, id ASC`,
      [currentUserId, targetUserId, targetUserId, currentUserId]
    );

    return res.status(200).json({
      success: true,
      messages: rows
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching message history.'
    });
  }
};

module.exports = {
  canUsersCommunicate,
  getConversations,
  getMessagesWithUser
};
