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

describe('Jobs API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken;
  let recruiterBId, recruiterBToken;
  let candidateId, candidateToken;
  let recruiterAJobId;
  let recruiterBJobId;
  let searchJobId;

  const testTimestamp = Date.now();
  const searchKeyword = `SearchUnique_${testTimestamp}`;
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    const emailA = `test_recruiter_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', emailA, hashedPassword, 'recruiter']
    );
    recruiterAId = resA.insertId;
    userEmails.push(emailA);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B
    const emailB = `test_recruiter_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', emailB, hashedPassword, 'recruiter']
    );
    recruiterBId = resB.insertId;
    userEmails.push(emailB);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate
    const emailCand = `test_candidate_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCand] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate User', emailCand, hashedPassword, 'candidate']
    );
    candidateId = resCand.insertId;
    userEmails.push(emailCand);
    candidateToken = jwt.sign({ userId: candidateId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });
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
  // A. POST /api/jobs
  // ==========================================
  describe('A. POST /api/jobs', () => {
    it('1. Recruiter A creates a valid job with all valid fields (201)', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          title: 'Full Stack Engineer',
          description: 'Building modern web applications',
          location: 'San Francisco, CA',
          salary: '$120,000 - $150,000',
          experience: '3+ years',
          job_type: 'Full Time',
          skills: 'Node.js, Express, React, MySQL'
        });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Job created successfully');
      assert.ok(response.body.job);
      assert.strictEqual(response.body.job.title, 'Full Stack Engineer');
      assert.strictEqual(response.body.job.status, 'active');
      assert.strictEqual(response.body.job.recruiter_id, recruiterAId);

      recruiterAJobId = response.body.job.id;
    });

    it('2. Missing required fields returns 400', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          salary: '$100,000'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Title, description, location, and job_type are required.');
    });

    it('3. Invalid job_type returns 400', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          title: 'Contract Developer',
          description: 'Short term project',
          location: 'Remote',
          job_type: 'Contract'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.ok(response.body.message.includes('Job type must be one of'));
    });

    it('4. Candidate attempts to create a job returns 403', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          title: 'Unauthorized Job Post',
          description: 'Should fail',
          location: 'Remote',
          job_type: 'Full Time'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('5. Unauthenticated request attempts to create a job returns 401', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send({
          title: 'Anonymous Job Post',
          description: 'Should fail',
          location: 'Remote',
          job_type: 'Full Time'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // B. GET /api/jobs, GET /api/jobs/:id, GET /api/jobs/my
  // ==========================================
  describe('B. GET /api/jobs, GET /api/jobs/:id, GET /api/jobs/my', () => {
    it('6. Public GET /api/jobs returns active jobs (200)', async () => {
      const response = await request(app).get('/api/jobs');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(Array.isArray(response.body.jobs));
      const found = response.body.jobs.some((j) => j.id === recruiterAJobId);
      assert.strictEqual(found, true);
    });

    it('7. Search filtering returns matching active job (200)', async () => {
      // Create a specific searchable job under Recruiter A
      const createRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          title: `DevOps Engineer ${searchKeyword}`,
          description: 'Kubernetes and CI/CD pipelines',
          location: 'Austin, TX',
          job_type: 'Remote',
          skills: `Docker, Terraform, ${searchKeyword}`
        });
      assert.strictEqual(createRes.status, 201);
      searchJobId = createRes.body.job.id;

      const searchRes = await request(app).get(`/api/jobs?search=${searchKeyword}`);
      assert.strictEqual(searchRes.status, 200);
      assert.strictEqual(searchRes.body.success, true);
      assert.ok(searchRes.body.jobs.length >= 1);
      const matched = searchRes.body.jobs.find((j) => j.id === searchJobId);
      assert.ok(matched);
      assert.ok(matched.title.includes(searchKeyword));
    });

    it('8. GET /api/jobs/:id returns the created job (200)', async () => {
      const response = await request(app).get(`/api/jobs/${recruiterAJobId}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.job);
      assert.strictEqual(response.body.job.id, recruiterAJobId);
      assert.strictEqual(response.body.job.title, 'Full Stack Engineer');
    });

    it('9. GET /api/jobs/999999 returns 404', async () => {
      const response = await request(app).get('/api/jobs/999999');

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Job not found.');
    });

    it("10. Recruiter A GET /api/jobs/my returns only Recruiter A's jobs (200)", async () => {
      // Create a job for Recruiter B
      const createBRes = await request(app)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .send({
          title: 'Recruiter B Exclusive Job',
          description: 'Only for B',
          location: 'New York, NY',
          job_type: 'Part Time'
        });
      assert.strictEqual(createBRes.status, 201);
      recruiterBJobId = createBRes.body.job.id;

      // Query Recruiter A's jobs
      const responseA = await request(app)
        .get('/api/jobs/my')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(responseA.status, 200);
      assert.strictEqual(responseA.body.success, true);
      assert.ok(Array.isArray(responseA.body.jobs));
      
      const containsAJob = responseA.body.jobs.some((j) => j.id === recruiterAJobId);
      const containsBJob = responseA.body.jobs.some((j) => j.id === recruiterBJobId);

      assert.strictEqual(containsAJob, true);
      assert.strictEqual(containsBJob, false);
    });

    it('11. Candidate GET /api/jobs/my returns 403', async () => {
      const response = await request(app)
        .get('/api/jobs/my')
        .set('Authorization', `Bearer ${candidateToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // C. PUT /api/jobs/:id
  // ==========================================
  describe('C. PUT /api/jobs/:id', () => {
    it('12. Recruiter A updates their own job (200)', async () => {
      const response = await request(app)
        .put(`/api/jobs/${recruiterAJobId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          title: 'Senior Full Stack Engineer',
          salary: '$160,000 - $180,000'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Job updated successfully');
      assert.strictEqual(response.body.job.title, 'Senior Full Stack Engineer');
      assert.strictEqual(response.body.job.salary, '$160,000 - $180,000');
    });

    it("13. Recruiter B attempts to update Recruiter A's job returns 403", async () => {
      const response = await request(app)
        .put(`/api/jobs/${recruiterAJobId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`)
        .send({
          title: 'Hacked Title By Recruiter B'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to modify this job.');
    });

    it('14. Recruiter A attempts to update job ID 999999 returns 404', async () => {
      const response = await request(app)
        .put('/api/jobs/999999')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          title: 'Non-existent Job'
        });

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Job not found.');
    });

    it('15. Recruiter A supplies an invalid status returns 400', async () => {
      const response = await request(app)
        .put(`/api/jobs/${recruiterAJobId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          status: 'invalid_status'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Status must be either "active" or "closed".');
    });
  });

  // ==========================================
  // D. DELETE /api/jobs/:id
  // ==========================================
  describe('D. DELETE /api/jobs/:id', () => {
    it("16. Recruiter B attempts to close Recruiter A's job returns 403", async () => {
      const response = await request(app)
        .delete(`/api/jobs/${recruiterAJobId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to close this job.');
    });

    it('17. Recruiter A closes their own job (200) and it vanishes from active feed', async () => {
      // Soft close
      const closeResponse = await request(app)
        .delete(`/api/jobs/${recruiterAJobId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(closeResponse.status, 200);
      assert.strictEqual(closeResponse.body.success, true);
      assert.strictEqual(closeResponse.body.message, 'Job closed successfully');

      // Verify status in single job query
      const singleRes = await request(app).get(`/api/jobs/${recruiterAJobId}`);
      assert.strictEqual(singleRes.status, 200);
      assert.strictEqual(singleRes.body.job.status, 'closed');

      // Verify it no longer appears in public active jobs feed
      const feedRes = await request(app).get('/api/jobs');
      assert.strictEqual(feedRes.status, 200);
      const isPresentInFeed = feedRes.body.jobs.some((j) => j.id === recruiterAJobId);
      assert.strictEqual(isPresentInFeed, false);
    });

    it('18. Recruiter A attempts to close job ID 999999 returns 404', async () => {
      const response = await request(app)
        .delete('/api/jobs/999999')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Job not found.');
    });
  });
});
