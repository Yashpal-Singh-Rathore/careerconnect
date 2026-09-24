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

describe('Interview API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken;
  let recruiterBId, recruiterBToken;
  let candidateAId, candidateAToken;
  let candidateBId, candidateBToken;
  let candidateCId, candidateCToken;

  let job1RecruiterAId;
  let job2RecruiterBId;

  let appAId; // Shortlisted, for scheduling main interview
  let appBId; // Pending, for non-shortlisted check
  let appCId; // Exists, but NO interview

  let interviewId;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    const emailRecruiterA = `test_int_recruiter_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', emailRecruiterA, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(emailRecruiterA);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B
    const emailRecruiterB = `test_int_recruiter_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', emailRecruiterB, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(emailRecruiterB);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate A
    const emailCandidateA = `test_int_candidate_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate A', emailCandidateA, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(emailCandidateA);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate B
    const emailCandidateB = `test_int_candidate_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate B', emailCandidateB, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(emailCandidateB);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Candidate C
    const emailCandidateC = `test_int_candidate_c_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCC] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate C', emailCandidateC, hashedPassword, 'candidate']
    );
    candidateCId = resCC.insertId;
    userEmails.push(emailCandidateC);
    candidateCToken = jwt.sign({ userId: candidateCId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 6. Create Job 1 (Recruiter A)
    const [resJ1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [recruiterAId, 'Senior Systems Engineer', 'Distributed systems and MySQL', 'Austin, TX', '$160,000', '5 years', 'Full Time', 'Node.js, MySQL']
    );
    job1RecruiterAId = resJ1.insertId;

    // 7. Create Job 2 (Recruiter B)
    const [resJ2] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [recruiterBId, 'DevOps Manager', 'Kubernetes and Cloud', 'Remote', '$180,000', '7 years', 'Remote', 'AWS, K8s']
    );
    job2RecruiterBId = resJ2.insertId;

    // 8. Create Application A (Candidate A -> Job 1, status = shortlisted)
    const [resAppA] = await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, "shortlisted")',
      [job1RecruiterAId, candidateAId]
    );
    appAId = resAppA.insertId;

    // 9. Create Application B (Candidate B -> Job 1, status = pending)
    const [resAppB] = await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, "pending")',
      [job1RecruiterAId, candidateBId]
    );
    appBId = resAppB.insertId;

    // 10. Create Application C (Candidate C -> Job 1, status = pending, NO interview)
    const [resAppC] = await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, "pending")',
      [job1RecruiterAId, candidateCId]
    );
    appCId = resAppC.insertId;
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
  // A. POST /api/interviews
  // ==========================================
  describe('A. POST /api/interviews', () => {
    it("1. Recruiter A schedules an interview for Candidate A's shortlisted Application A (201)", async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: appAId,
          interview_date: '2026-10-15',
          interview_time: '14:30:00',
          mode: 'Online',
          notes: 'Initial technical screen'
        });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Interview scheduled successfully');
      assert.ok(response.body.interview);
      assert.strictEqual(typeof response.body.interview.id, 'number');
      assert.strictEqual(response.body.interview.application_id, appAId);
      assert.strictEqual(response.body.interview.status, 'scheduled');
      assert.strictEqual(response.body.interview.mode, 'Online');
      assert.strictEqual(response.body.interview.interview_date, '2026-10-15');
      assert.ok(response.body.interview.interview_time.includes('14:30'));
      assert.strictEqual(response.body.interview.notes, 'Initial technical screen');

      interviewId = response.body.interview.id;
    });

    it('2. Recruiter A attempts to schedule for Application B with pending status returns 400', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: appBId,
          interview_date: '2026-10-16',
          interview_time: '10:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Interview can only be scheduled for shortlisted applications.');
    });

    it('3. Recruiter A submits request missing required field returns 400', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: appAId,
          interview_time: '11:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Application ID, interview date, interview time, and mode are required.');
    });

    it('4. Recruiter A uses invalid mode "In-Person" returns 400', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: appAId,
          interview_date: '2026-10-17',
          interview_time: '15:00:00',
          mode: 'In-Person'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Mode must be one of: Online, Offline.');
    });

    it("5. Recruiter B attempts to schedule an interview for Recruiter A's Application A returns 403", async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .send({
          application_id: appAId,
          interview_date: '2026-10-18',
          interview_time: '16:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to schedule an interview for this application.');
    });

    it('6. Recruiter A attempts to schedule a second interview for Application A returns 409', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: appAId,
          interview_date: '2026-10-19',
          interview_time: '09:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 409);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'An interview has already been scheduled for this application.');
    });

    it('7. Recruiter A attempts to schedule using application_id 999999 returns 404', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          application_id: 999999,
          interview_date: '2026-10-20',
          interview_time: '10:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Application not found.');
    });

    it('8. Candidate A attempts to schedule an interview returns 403', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          application_id: appAId,
          interview_date: '2026-10-21',
          interview_time: '10:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('9. Unauthenticated request attempts to schedule an interview returns 401', async () => {
      const response = await request(app)
        .post('/api/interviews')
        .send({
          application_id: appAId,
          interview_date: '2026-10-22',
          interview_time: '10:00:00',
          mode: 'Online'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // B. GET /api/interviews/application/:applicationId
  // ==========================================
  describe('B. GET /api/interviews/application/:applicationId', () => {
    it('10. Candidate A retrieves their own interview for Application A (200)', async () => {
      const response = await request(app)
        .get(`/api/interviews/application/${appAId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.interview);
      assert.strictEqual(response.body.interview.id, interviewId);
      assert.strictEqual(response.body.interview.application_id, appAId);
      assert.strictEqual(response.body.interview.mode, 'Online');
      assert.strictEqual(response.body.interview.status, 'scheduled');
    });

    it('11. Recruiter A retrieves the interview for their Job 1 (200)', async () => {
      const response = await request(app)
        .get(`/api/interviews/application/${appAId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.interview);
      assert.strictEqual(response.body.interview.id, interviewId);
    });

    it('12. Retrieve Application C without interview returns interview: null (200)', async () => {
      const response = await request(app)
        .get(`/api/interviews/application/${appCId}`)
        .set('Authorization', `Bearer ${candidateCToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.interview, null);
    });

    it("13. Candidate B attempts to view Candidate A's interview returns 403", async () => {
      const response = await request(app)
        .get(`/api/interviews/application/${appAId}`)
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view this interview.');
    });

    it("14. Recruiter B attempts to view the interview for Recruiter A's Job 1 returns 403", async () => {
      const response = await request(app)
        .get(`/api/interviews/application/${appAId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view this interview.');
    });

    it('15. Request application ID 999999 returns 404', async () => {
      const response = await request(app)
        .get('/api/interviews/application/999999')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Application not found.');
    });
  });

  // ==========================================
  // C. PUT /api/interviews/:id
  // ==========================================
  describe('C. PUT /api/interviews/:id', () => {
    it('16. Recruiter A updates the existing interview (200)', async () => {
      const response = await request(app)
        .put(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          notes: 'Updated screen notes - candidate passed',
          mode: 'Offline',
          status: 'completed'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Interview updated successfully');
      assert.strictEqual(response.body.interview.notes, 'Updated screen notes - candidate passed');
      assert.strictEqual(response.body.interview.mode, 'Offline');
      assert.strictEqual(response.body.interview.status, 'completed');

      // Verify persistence via DB query
      const [rows] = await pool.execute('SELECT notes, mode, status FROM interviews WHERE id = ?', [interviewId]);
      assert.strictEqual(rows[0].notes, 'Updated screen notes - candidate passed');
      assert.strictEqual(rows[0].mode, 'Offline');
      assert.strictEqual(rows[0].status, 'completed');
    });

    it('17. Recruiter A attempts to update mode to "Hybrid" returns 400', async () => {
      const response = await request(app)
        .put(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          mode: 'Hybrid'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Mode must be one of: Online, Offline.');
    });

    it('18. Recruiter A attempts to update status to "postponed" returns 400', async () => {
      const response = await request(app)
        .put(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          status: 'postponed'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Status must be one of: scheduled, completed, cancelled.');
    });

    it("19. Recruiter B attempts to update Recruiter A's interview returns 403", async () => {
      const response = await request(app)
        .put(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .send({
          notes: 'Hacked by Recruiter B'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to update this interview.');
    });

    it('20. Candidate A attempts to update the interview returns 403', async () => {
      const response = await request(app)
        .put(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          notes: 'Candidate self-update'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('21. Recruiter A attempts to update interview ID 999999 returns 404', async () => {
      const response = await request(app)
        .put('/api/interviews/999999')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          notes: 'Nonexistent update'
        });

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Interview not found.');
    });
  });

  // ==========================================
  // D. DELETE /api/interviews/:id
  // ==========================================
  describe('D. DELETE /api/interviews/:id', () => {
    it("22. Recruiter B attempts to cancel Recruiter A's interview returns 403", async () => {
      const response = await request(app)
        .delete(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to cancel this interview.');
    });

    it('23. Recruiter A cancels the interview as a soft cancel (200)', async () => {
      const response = await request(app)
        .delete(`/api/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Interview cancelled successfully');

      // Verify soft cancel in database (row still exists, status = 'cancelled')
      const [rows] = await pool.execute('SELECT * FROM interviews WHERE id = ?', [interviewId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].status, 'cancelled');
    });

    it('24. Recruiter A attempts to cancel interview ID 999999 returns 404', async () => {
      const response = await request(app)
        .delete('/api/interviews/999999')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Interview not found.');
    });
  });
});
