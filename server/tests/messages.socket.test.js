// Configure test database environment before requiring app / db
process.env.DB_NAME = 'career_connect_test';

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { server } = require('../server');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'career_connect_jwt_super_secret_key_2026';

describe('Socket.IO Real-Time Messaging Integration Tests (career_connect_test)', () => {
  let serverPort;
  let serverUrl;

  let recruiterAId, recruiterAToken, recruiterAEmail;
  let recruiterBId, recruiterBToken, recruiterBEmail;
  let candidateAId, candidateAToken, candidateAEmail;

  let jobA1Id;

  const testTimestamp = Date.now();
  const userEmails = [];
  const activeSockets = [];

  // Helper to connect a socket client
  const createSocketClient = (token) => {
    const socket = ioClient(serverUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false
    });
    activeSockets.push(socket);
    return socket;
  };

  before(async () => {
    // 1. Start HTTP/Socket.IO server on dynamic port
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        serverUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });

    const hashedPassword = await bcrypt.hash('password123', 10);

    // 2. Create Recruiter A
    recruiterAEmail = `test_sock_rec_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', recruiterAEmail, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(recruiterAEmail);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Recruiter B
    recruiterBEmail = `test_sock_rec_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', recruiterBEmail, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(recruiterBEmail);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate A
    candidateAEmail = `test_sock_cand_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate A', candidateAEmail, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(candidateAEmail);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Job A1 for Recruiter A
    const [resJobA1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterAId, 'Full Stack Dev', 'Job description', 'Bangalore', '12 LPA', '2 yrs', 'Full Time', 'React, Node', 'active']
    );
    jobA1Id = resJobA1.insertId;

    // 6. Create application: Candidate A -> Job A1 (Recruiter A relationship)
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA1Id, candidateAId, 'pending']
    );
  });

  afterEach(() => {
    while (activeSockets.length > 0) {
      const socket = activeSockets.pop();
      if (socket && socket.connected) {
        socket.disconnect();
      }
    }
  });

  after(async () => {
    // Disconnect any remaining sockets
    while (activeSockets.length > 0) {
      const socket = activeSockets.pop();
      if (socket && socket.connected) {
        socket.disconnect();
      }
    }

    // Close HTTP/Socket.IO server
    await new Promise((resolve) => server.close(resolve));

    // Delete test users (cascades to jobs, applications, messages)
    if (userEmails.length > 0) {
      for (const email of userEmails) {
        await pool.execute('DELETE FROM users WHERE email = ?', [email]);
      }
    }
    await pool.end();
  });

  // ==========================================
  // 1. AUTHENTICATION
  // ==========================================
  describe('1. Socket.IO Authentication', () => {
    it('Connects successfully with valid JWT handshake token', async () => {
      const socket = createSocketClient(candidateAToken);

      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      assert.strictEqual(socket.connected, true);
    });

    it('Rejects connection with invalid JWT', async () => {
      const socket = createSocketClient('invalid_jwt_token');

      const err = await new Promise((resolve) => {
        socket.on('connect_error', resolve);
      });

      assert.ok(err instanceof Error);
      assert.strictEqual(err.message, 'Authentication error: Invalid or expired token');
      assert.strictEqual(socket.connected, false);
    });
  });

  // ==========================================
  // 2. AUTHORIZED MESSAGE
  // ==========================================
  describe('2. Authorized Message Delivery & Persistence', () => {
    it('Candidate A sends message to Recruiter A with live emission and DB persistence', async () => {
      const candidateSocket = createSocketClient(candidateAToken);
      const recruiterSocket = createSocketClient(recruiterAToken);

      // Wait for both sockets to connect
      await Promise.all([
        new Promise((resolve, reject) => {
          candidateSocket.on('connect', resolve);
          candidateSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          recruiterSocket.on('connect', resolve);
          recruiterSocket.on('connect_error', reject);
        })
      ]);

      const testMsgText = 'Hello Recruiter A - Test Socket Flow';

      // Set up listener on Recruiter A socket
      const receivePromise = new Promise((resolve) => {
        recruiterSocket.on('receive_message', (payload) => {
          resolve(payload);
        });
      });

      // Candidate A emits send_message
      const ack = await new Promise((resolve) => {
        candidateSocket.emit(
          'send_message',
          {
            receiverId: recruiterAId,
            message: testMsgText
          },
          (response) => resolve(response)
        );
      });

      // 1. Verify acknowledgement callback
      assert.strictEqual(ack.success, true);
      assert.ok(ack.message);
      assert.strictEqual(ack.message.sender_id, candidateAId);
      assert.strictEqual(ack.message.receiver_id, recruiterAId);
      assert.strictEqual(ack.message.message, testMsgText);

      // 2. Verify real-time emission to Recruiter A
      const receivedMsg = await receivePromise;
      assert.strictEqual(receivedMsg.id, ack.message.id);
      assert.strictEqual(receivedMsg.sender_id, candidateAId);
      assert.strictEqual(receivedMsg.receiver_id, recruiterAId);
      assert.strictEqual(receivedMsg.message, testMsgText);

      // 3. Verify MySQL database persistence
      const [rows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [ack.message.id]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].sender_id, candidateAId);
      assert.strictEqual(rows[0].receiver_id, recruiterAId);
      assert.strictEqual(rows[0].message, testMsgText);
    });
  });

  // ==========================================
  // 3. UNAUTHORIZED MESSAGE
  // ==========================================
  describe('3. Unauthorized Message Prevention', () => {
    it('Rejects message between Candidate A and Recruiter B without application relationship', async () => {
      const candidateSocket = createSocketClient(candidateAToken);
      const recruiterBSocket = createSocketClient(recruiterBToken);

      await Promise.all([
        new Promise((resolve, reject) => {
          candidateSocket.on('connect', resolve);
          candidateSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          recruiterBSocket.on('connect', resolve);
          recruiterBSocket.on('connect_error', reject);
        })
      ]);

      let recruiterBReceived = false;
      recruiterBSocket.on('receive_message', () => {
        recruiterBReceived = true;
      });

      const unapprovedText = 'Attempted unauthorized message to Recruiter B';

      // Candidate A emits send_message to Recruiter B
      const ack = await new Promise((resolve) => {
        candidateSocket.emit(
          'send_message',
          {
            receiverId: recruiterBId,
            message: unapprovedText
          },
          (response) => resolve(response)
        );
      });

      // 1. Verify acknowledgement rejected
      assert.strictEqual(ack.success, false);
      assert.strictEqual(ack.message, 'Forbidden. You do not have permission to communicate with this user.');

      // 2. Verify Recruiter B received no message
      assert.strictEqual(recruiterBReceived, false);

      // 3. Verify no row inserted into MySQL
      const [rows] = await pool.execute('SELECT * FROM messages WHERE message = ?', [unapprovedText]);
      assert.strictEqual(rows.length, 0);
    });
  });

  // ==========================================
  // 4. INVALID MESSAGE PAYLOAD VALIDATION
  // ==========================================
  describe('4. Invalid Payload Validation', () => {
    it('Missing receiverId returns success=false', async () => {
      const socket = createSocketClient(candidateAToken);
      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      const ack = await new Promise((resolve) => {
        socket.emit('send_message', { message: 'hello' }, resolve);
      });

      assert.strictEqual(ack.success, false);
      assert.strictEqual(ack.message, 'Receiver ID and message content are required.');
    });

    it('Missing message returns success=false', async () => {
      const socket = createSocketClient(candidateAToken);
      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      const ack = await new Promise((resolve) => {
        socket.emit('send_message', { receiverId: recruiterAId }, resolve);
      });

      assert.strictEqual(ack.success, false);
      assert.strictEqual(ack.message, 'Receiver ID and message content are required.');
    });

    it('Empty/whitespace message returns success=false', async () => {
      const socket = createSocketClient(candidateAToken);
      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      const ack = await new Promise((resolve) => {
        socket.emit('send_message', { receiverId: recruiterAId, message: '    ' }, resolve);
      });

      assert.strictEqual(ack.success, false);
      assert.strictEqual(ack.message, 'Message text cannot be empty.');
    });

    it('Message exceeding 1000 characters returns success=false', async () => {
      const socket = createSocketClient(candidateAToken);
      await new Promise((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      const longMessage = 'A'.repeat(1001);
      const ack = await new Promise((resolve) => {
        socket.emit('send_message', { receiverId: recruiterAId, message: longMessage }, resolve);
      });

      assert.strictEqual(ack.success, false);
      assert.strictEqual(ack.message, 'Message cannot exceed 1000 characters.');
    });
  });
});
