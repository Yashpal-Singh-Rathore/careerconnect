// Configure test database environment before requiring app / db
process.env.DB_NAME = 'career_connect_test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { app } = require('../server');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'career_connect_jwt_super_secret_key_2026';

describe('Messaging API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken, recruiterAEmail, recruiterAName;
  let recruiterBId, recruiterBToken, recruiterBEmail, recruiterBName;
  let candidateAId, candidateAToken, candidateAEmail, candidateAName;
  let candidateBId, candidateBToken, candidateBEmail, candidateBName;
  let candidateCId, candidateCToken, candidateCEmail, candidateCName;

  let jobA1Id, jobB1Id;
  let msg1Id, msg2Id;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    recruiterAName = 'Recruiter A';
    recruiterAEmail = `test_msg_rec_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [recruiterAName, recruiterAEmail, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(recruiterAEmail);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // Create Recruiter Profile for Recruiter A
    await pool.execute(
      'INSERT INTO recruiter_profiles (user_id, company_name, phone, location, company_description) VALUES (?, ?, ?, ?, ?)',
      [recruiterAId, 'TechCorp Labs', '9876543210', 'Bangalore', 'Leading software technology company']
    );

    // 2. Create Recruiter B
    recruiterBName = 'Recruiter B';
    recruiterBEmail = `test_msg_rec_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [recruiterBName, recruiterBEmail, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(recruiterBEmail);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate A
    candidateAName = 'Candidate A';
    candidateAEmail = `test_msg_cand_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateAName, candidateAEmail, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(candidateAEmail);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate B
    candidateBName = 'Candidate B';
    candidateBEmail = `test_msg_cand_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateBName, candidateBEmail, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(candidateBEmail);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Candidate C (No applications)
    candidateCName = 'Candidate C';
    candidateCEmail = `test_msg_cand_c_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCC] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateCName, candidateCEmail, hashedPassword, 'candidate']
    );
    candidateCId = resCC.insertId;
    userEmails.push(candidateCEmail);
    candidateCToken = jwt.sign({ userId: candidateCId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // Create Jobs
    // Job A1: Recruiter A, active
    const [resJobA1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterAId, 'Full Stack Engineer', 'Node and React development', 'Bangalore', '12 LPA', '2-4 yrs', 'Full Time', 'Node.js, React', 'active']
    );
    jobA1Id = resJobA1.insertId;

    // Job B1: Recruiter B, active
    const [resJobB1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterBId, 'DevOps Engineer', 'Infrastructure management', 'Remote', '16 LPA', '3-5 yrs', 'Remote', 'Docker, Kubernetes', 'active']
    );
    jobB1Id = resJobB1.insertId;

    // Create Applications
    // Candidate A -> Job A1
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA1Id, candidateAId, 'pending']
    );

    // Candidate B -> Job B1
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobB1Id, candidateBId, 'pending']
    );

    // Seed Messages between Candidate A and Recruiter A
    // Message 1: Candidate A -> Recruiter A (earlier)
    const [resM1] = await pool.execute(
      'INSERT INTO messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL 10 MINUTE))',
      [candidateAId, recruiterAId, 'Hello Recruiter A, I applied for the Full Stack role.']
    );
    msg1Id = resM1.insertId;

    // Message 2: Recruiter A -> Candidate A (later)
    const [resM2] = await pool.execute(
      'INSERT INTO messages (sender_id, receiver_id, message, created_at) VALUES (?, ?, ?, NOW())',
      [recruiterAId, candidateAId, 'Hello Candidate A, thanks for applying! Let us discuss your experience.']
    );
    msg2Id = resM2.insertId;
  });

  after(async () => {
    if (userEmails.length > 0) {
      for (const email of userEmails) {
        await pool.execute('DELETE FROM users WHERE email = ?', [email]);
      }
    }
    await pool.end();
  });

  // ==========================================
  // GROUP A — GET /api/messages/conversations
  // ==========================================
  describe('GROUP A — GET /api/messages/conversations', () => {
    it('1. Candidate A Authorized Conversation', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.conversations));
      assert.strictEqual(response.body.conversations.length, 1);

      const contact = response.body.conversations[0];
      assert.strictEqual(contact.id, recruiterAId);
      assert.strictEqual(contact.name, recruiterAName);
      assert.strictEqual(contact.email, recruiterAEmail);
      assert.strictEqual(contact.role, 'recruiter');
      assert.strictEqual(contact.company_name, 'TechCorp Labs');

      // Verify Recruiter B is NOT present
      const recruiterBContact = response.body.conversations.find((c) => c.id === recruiterBId);
      assert.strictEqual(recruiterBContact, undefined);
    });

    it('2. Recruiter A Authorized Conversation', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.conversations));
      assert.strictEqual(response.body.conversations.length, 1);

      const contact = response.body.conversations[0];
      assert.strictEqual(contact.id, candidateAId);
      assert.strictEqual(contact.name, candidateAName);
      assert.strictEqual(contact.email, candidateAEmail);
      assert.strictEqual(contact.role, 'candidate');

      // Verify Candidate B is NOT present
      const candidateBContact = response.body.conversations.find((c) => c.id === candidateBId);
      assert.strictEqual(candidateBContact, undefined);
    });

    it('3. Candidate C Empty Conversations', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${candidateCToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.conversations));
      assert.strictEqual(response.body.conversations.length, 0);
      assert.deepStrictEqual(response.body.conversations, []);
    });
  });

  // ==========================================
  // GROUP B — GET /api/messages/:userId
  // ==========================================
  describe('GROUP B — GET /api/messages/:userId', () => {
    it('4. Authorized Message History', async () => {
      const response = await request(app)
        .get(`/api/messages/${recruiterAId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.messages));
      assert.strictEqual(response.body.messages.length, 2);

      // Verify first message
      const msg1 = response.body.messages[0];
      assert.strictEqual(msg1.id, msg1Id);
      assert.strictEqual(msg1.sender_id, candidateAId);
      assert.strictEqual(msg1.receiver_id, recruiterAId);
      assert.strictEqual(msg1.message, 'Hello Recruiter A, I applied for the Full Stack role.');

      // Verify second message
      const msg2 = response.body.messages[1];
      assert.strictEqual(msg2.id, msg2Id);
      assert.strictEqual(msg2.sender_id, recruiterAId);
      assert.strictEqual(msg2.receiver_id, candidateAId);
      assert.strictEqual(msg2.message, 'Hello Candidate A, thanks for applying! Let us discuss your experience.');
    });

    it('5. Candidate A Cannot Access Recruiter B', async () => {
      const response = await request(app)
        .get(`/api/messages/${recruiterBId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view messages with this user.');
    });

    it('6. Recruiter A Cannot Access Candidate B', async () => {
      const response = await request(app)
        .get(`/api/messages/${candidateBId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view messages with this user.');
    });

    it('7. Candidate-to-Candidate Access Denied', async () => {
      const response = await request(app)
        .get(`/api/messages/${candidateBId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view messages with this user.');
    });

    it('8. Self Message History Denied', async () => {
      const response = await request(app)
        .get(`/api/messages/${candidateAId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view messages with this user.');
    });

    it('9. Invalid Target User ID', async () => {
      const responseInvalid = await request(app)
        .get('/api/messages/invalid-id')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(responseInvalid.status, 400);
      assert.strictEqual(responseInvalid.body.success, false);
      assert.strictEqual(responseInvalid.body.message, 'Valid user ID is required.');

      const responseZero = await request(app)
        .get('/api/messages/0')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(responseZero.status, 400);
      assert.strictEqual(responseZero.body.success, false);
      assert.strictEqual(responseZero.body.message, 'Valid user ID is required.');
    });

    it('10. Unauthenticated Messaging Requests', async () => {
      // 1. Unauthenticated conversations request
      const resConv = await request(app)
        .get('/api/messages/conversations');

      assert.strictEqual(resConv.status, 401);
      assert.strictEqual(resConv.body.success, false);
      assert.strictEqual(resConv.body.message, 'Access denied. No token provided.');

      // 2. Unauthenticated messages history request
      const resMsg = await request(app)
        .get(`/api/messages/${recruiterAId}`);

      assert.strictEqual(resMsg.status, 401);
      assert.strictEqual(resMsg.body.success, false);
      assert.strictEqual(resMsg.body.message, 'Access denied. No token provided.');
    });
  });

  // ==========================================
  // GROUP C — DATABASE / HISTORY BEHAVIOR
  // ==========================================
  describe('GROUP C — DATABASE / HISTORY BEHAVIOR', () => {
    it('11. Latest Message Appears in Conversation List', async () => {
      const response = await request(app)
        .get('/api/messages/conversations')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);

      const contact = response.body.conversations.find((c) => c.id === recruiterAId);
      assert.ok(contact);

      // Verify latest_message / last_message contains the newest message (msg2)
      assert.strictEqual(contact.latest_message, 'Hello Candidate A, thanks for applying! Let us discuss your experience.');
      assert.strictEqual(contact.last_message, 'Hello Candidate A, thanks for applying! Let us discuss your experience.');
      assert.ok(contact.latest_message_time);
      assert.ok(contact.last_message_at);
    });

    it('12. Chronological Message History', async () => {
      const response = await request(app)
        .get(`/api/messages/${recruiterAId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.messages.length, 2);

      const [firstMsg, secondMsg] = response.body.messages;

      // Verify ID and chronological ordering
      assert.strictEqual(firstMsg.id, msg1Id);
      assert.strictEqual(secondMsg.id, msg2Id);

      const time1 = new Date(firstMsg.created_at).getTime();
      const time2 = new Date(secondMsg.created_at).getTime();
      assert.ok(time1 <= time2, `Expected firstMsg time (${time1}) <= secondMsg time (${time2})`);
    });
  });
});
