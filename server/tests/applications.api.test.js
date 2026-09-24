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

describe('Applications API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken;
  let recruiterBId, recruiterBToken;
  let candidateAId, candidateAToken;
  let candidateBId, candidateBToken;

  let job1ActiveAId;
  let job2ClosedAId;
  let job3ActiveBId;

  let candidateAAppId;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    const emailRecruiterA = `test_app_recruiter_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', emailRecruiterA, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(emailRecruiterA);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B
    const emailRecruiterB = `test_app_recruiter_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', emailRecruiterB, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(emailRecruiterB);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate A
    const emailCandidateA = `test_app_candidate_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate A', emailCandidateA, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(emailCandidateA);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate B
    const emailCandidateB = `test_app_candidate_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate B', emailCandidateB, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(emailCandidateB);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Job 1: Active owned by Recruiter A
    const [resJ1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        recruiterAId,
        'Senior Backend Developer',
        'Build scalable microservices with Node.js',
        'San Francisco, CA',
        '$140,000 - $160,000',
        '4+ years',
        'Full Time',
        'Node.js, Express, MySQL'
      ]
    );
    job1ActiveAId = resJ1.insertId;

    // 6. Create Job 2: Closed owned by Recruiter A
    const [resJ2] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed')`,
      [
        recruiterAId,
        'Closed Frontend Role',
        'Legacy project',
        'Remote',
        '$100,000',
        '2 years',
        'Full Time',
        'React',
      ]
    );
    job2ClosedAId = resJ2.insertId;

    // 7. Create Job 3: Active owned by Recruiter B
    const [resJ3] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        recruiterBId,
        'Recruiter B Lead Architect',
        'System architecture design',
        'New York, NY',
        '$180,000',
        '8+ years',
        'Full Time',
        'Cloud, Microservices'
      ]
    );
    job3ActiveBId = resJ3.insertId;
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
  // A. POST /api/applications
  // ==========================================
  describe('A. POST /api/applications', () => {
    it("1. Candidate A applies to Recruiter A's active Job 1 (201)", async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          job_id: job1ActiveAId
        });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Application submitted successfully');
      assert.ok(response.body.application);
      assert.strictEqual(response.body.application.job_id, job1ActiveAId);
      assert.strictEqual(response.body.application.candidate_id, candidateAId);
      assert.strictEqual(response.body.application.status, 'pending');

      candidateAAppId = response.body.application.id;
    });

    it('2. Candidate A submits without job_id returns 400', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({});

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Job ID is required.');
    });

    it('3. Candidate A applies to closed Job 2 returns 400', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          job_id: job2ClosedAId
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Cannot apply to a closed job.');
    });

    it('4. Candidate A applies to job ID 999999 returns 404', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          job_id: 999999
        });

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Job not found.');
    });

    it('5. Candidate A applies to Job 1 a second time returns 409', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          job_id: job1ActiveAId
        });

      assert.strictEqual(response.status, 409);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'You have already applied to this job');
    });

    it('6. Recruiter A attempts to apply to Job 1 returns 403', async () => {
      const response = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          job_id: job1ActiveAId
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('7. Unauthenticated request attempts to apply returns 401', async () => {
      const response = await request(app)
        .post('/api/applications')
        .send({
          job_id: job1ActiveAId
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // B. GET /api/applications/my
  // ==========================================
  describe('B. GET /api/applications/my', () => {
    it('8. Candidate A retrieves their applications (200)', async () => {
      const response = await request(app)
        .get('/api/applications/my')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.applications));
      assert.ok(response.body.applications.length >= 1);

      const appItem = response.body.applications.find((a) => a.id === candidateAAppId);
      assert.ok(appItem);
      assert.strictEqual(appItem.job_id, job1ActiveAId);
      assert.strictEqual(appItem.job_title, 'Senior Backend Developer');
      assert.strictEqual(appItem.status, 'pending');
    });

    it("9. Candidate B retrieves their applications and Candidate A's application is NOT visible (200)", async () => {
      const response = await request(app)
        .get('/api/applications/my')
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.applications));

      const foundApp = response.body.applications.some((a) => a.id === candidateAAppId);
      assert.strictEqual(foundApp, false);
    });

    it('10. Recruiter A calls /api/applications/my returns 403', async () => {
      const response = await request(app)
        .get('/api/applications/my')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // C. GET /api/applications/:id
  // ==========================================
  describe('C. GET /api/applications/:id', () => {
    it('11. Candidate A views their own application (200)', async () => {
      const response = await request(app)
        .get(`/api/applications/${candidateAAppId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.application);
      assert.strictEqual(response.body.application.id, candidateAAppId);
      assert.strictEqual(response.body.application.job_title, 'Senior Backend Developer');
      assert.strictEqual(response.body.application.candidate_name, 'Candidate A');
    });

    it('12. Recruiter A views the application for their Job 1 (200)', async () => {
      const response = await request(app)
        .get(`/api/applications/${candidateAAppId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.application);
      assert.strictEqual(response.body.application.id, candidateAAppId);
      assert.strictEqual(response.body.application.job_id, job1ActiveAId);
    });

    it("13. Candidate B attempts to view Candidate A's application returns 403", async () => {
      const response = await request(app)
        .get(`/api/applications/${candidateAAppId}`)
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view this application.');
    });

    it("14. Recruiter B attempts to view Candidate A's application for Recruiter A's Job 1 returns 403", async () => {
      const response = await request(app)
        .get(`/api/applications/${candidateAAppId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to view this application.');
    });

    it('15. Request application ID 999999 returns 404', async () => {
      const response = await request(app)
        .get('/api/applications/999999')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Application not found.');
    });
  });

  // ==========================================
  // D. GET /api/recruiter/applications
  // ==========================================
  describe('D. GET /api/recruiter/applications', () => {
    it("16. Recruiter A retrieves recruiter applications and Candidate A's Job 1 application is present (200)", async () => {
      const response = await request(app)
        .get('/api/recruiter/applications')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.applications));

      const found = response.body.applications.find((a) => a.id === candidateAAppId);
      assert.ok(found);
      assert.strictEqual(found.job_id, job1ActiveAId);
      assert.strictEqual(found.candidate_id, candidateAId);
    });

    it("17. Recruiter B retrieves recruiter applications and Recruiter A's application is NOT present (200)", async () => {
      const response = await request(app)
        .get('/api/recruiter/applications')
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.applications));

      const found = response.body.applications.some((a) => a.id === candidateAAppId);
      assert.strictEqual(found, false);
    });

    it('18. Candidate A calls /api/recruiter/applications returns 403', async () => {
      const response = await request(app)
        .get('/api/recruiter/applications')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // E. PUT /api/applications/:id/status
  // ==========================================
  describe('E. PUT /api/applications/:id/status', () => {
    it("19. Recruiter A updates Candidate A's application from pending to shortlisted (200)", async () => {
      const response = await request(app)
        .put(`/api/applications/${candidateAAppId}/status`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          status: 'shortlisted'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Application status updated');
      assert.strictEqual(response.body.application.status, 'shortlisted');

      // Verify status persisted
      const verifyRes = await request(app)
        .get(`/api/applications/${candidateAAppId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);
      assert.strictEqual(verifyRes.body.application.status, 'shortlisted');
    });

    it('20. Recruiter A attempts to set status to "invalid_status" returns 400', async () => {
      const response = await request(app)
        .put(`/api/applications/${candidateAAppId}/status`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          status: 'invalid_status'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Status must be one of'));
    });

    it("21. Recruiter B attempts to update Candidate A's application returns 403", async () => {
      const response = await request(app)
        .put(`/api/applications/${candidateAAppId}/status`)
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .send({
          status: 'selected'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to update this application.');
    });

    it('22. Candidate A attempts to update their own application status returns 403', async () => {
      const response = await request(app)
        .put(`/api/applications/${candidateAAppId}/status`)
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          status: 'selected'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('23. Recruiter A attempts to update application ID 999999 returns 404', async () => {
      const response = await request(app)
        .put('/api/applications/999999/status')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          status: 'selected'
        });

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Application not found.');
    });
  });
});
