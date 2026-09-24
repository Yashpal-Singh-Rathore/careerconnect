const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const pool = require('./config/db');
const { canUsersCommunicate } = require('./controllers/messageController');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: clientUrl,
  credentials: true
}));

// Body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO JWT Authentication Middleware
io.use((socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!rawToken) {
      return next(new Error('Authentication error: No token provided'));
    }

    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7).trim() : rawToken.trim();
    const secret = process.env.JWT_SECRET || 'career_connect_jwt_super_secret_key_2026';
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.userId) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    socket.user = decoded;
    next();
  } catch (err) {
    console.error('Socket authentication failed:', err.message);
    return next(new Error('Authentication error: Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.userId;
  const userRoom = `user:${userId}`;
  socket.join(userRoom);
  console.log(`Socket connected: ${socket.id} (User: ${userId}, Room: ${userRoom})`);

  // Handle incoming message sending event
  socket.on('send_message', async (data, callback) => {
    try {
      const senderId = socket.user.userId;
      const receiverId = parseInt(data?.receiverId, 10);
      const rawMessage = data?.message;

      if (!receiverId || !rawMessage || typeof rawMessage !== 'string') {
        const errResponse = { success: false, message: 'Receiver ID and message content are required.' };
        if (typeof callback === 'function') callback(errResponse);
        return;
      }

      const messageText = rawMessage.trim();
      if (messageText.length === 0) {
        const errResponse = { success: false, message: 'Message text cannot be empty.' };
        if (typeof callback === 'function') callback(errResponse);
        return;
      }

      if (messageText.length > 1000) {
        const errResponse = { success: false, message: 'Message cannot exceed 1000 characters.' };
        if (typeof callback === 'function') callback(errResponse);
        return;
      }

      // Security: verify application relationship between sender and receiver
      const isAllowed = await canUsersCommunicate(senderId, receiverId);
      if (!isAllowed) {
        const errResponse = { success: false, message: 'Forbidden. You do not have permission to communicate with this user.' };
        if (typeof callback === 'function') callback(errResponse);
        return;
      }

      // Save message to MySQL
      const [result] = await pool.execute(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [senderId, receiverId, messageText]
      );

      const [msgRows] = await pool.execute(
        'SELECT id, sender_id, receiver_id, message, created_at FROM messages WHERE id = ?',
        [result.insertId]
      );

      const savedMessage = msgRows[0];

      // Emit to receiver's user room
      io.to(`user:${receiverId}`).emit('receive_message', savedMessage);

      // Emit to sender's user room (ensures sync across multiple tabs/sessions)
      io.to(`user:${senderId}`).emit('receive_message', savedMessage);

      if (typeof callback === 'function') {
        callback({ success: true, message: savedMessage });
      }
    } catch (error) {
      console.error('Error saving/delivering socket message:', error);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Internal server error processing message.' });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id} (User: ${userId})`);
  });
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Candidate routes
const candidateRoutes = require('./routes/candidate');
app.use('/api/candidate', candidateRoutes);

// Recruiter routes
const recruiterRoutes = require('./routes/recruiter');
app.use('/api/recruiter', recruiterRoutes);

// Job routes
const jobRoutes = require('./routes/jobs');
app.use('/api/jobs', jobRoutes);

// Application routes
const applicationRoutes = require('./routes/applications');
app.use('/api/applications', applicationRoutes);

// Resume routes (Protected authenticated download)
const resumeRoutes = require('./routes/resumes');
app.use('/api/resumes', resumeRoutes);

// Interview routes
const interviewRoutes = require('./routes/interviews');
app.use('/api/interviews', interviewRoutes);

// Report routes
const reportRoutes = require('./routes/reports');
app.use('/api/recruiter/reports', reportRoutes);

// Message routes
const messageRoutes = require('./routes/messages');
app.use('/api/messages', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CareerConnect API is running'
  });
});

// Start server only when run directly
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`CareerConnect Server is running on port ${PORT}`);
  });
}

module.exports = { app, server, io };
