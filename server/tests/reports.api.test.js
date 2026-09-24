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

describe('Reports / Analytics API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken, recruiterAEmail;
  let recruiterBId, recruiterBToken, recruiterBEmail;
  let recruiterCId, recruiterCToken, recruiterCEmail;
  let candidateAId, candidateAToken, candidateAEmail;
  let candidateBId, candidateBToken, candidateBEmail;

  let jobA1Id, jobA2Id, jobA3Id, jobB1Id;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    recruiterAEmail = `test_rep_rec_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', recruiterAEmail, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(recruiterAEmail);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B
    recruiterBEmail = `test_rep_rec_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', recruiterBEmail, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(recruiterBEmail);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Recruiter C (0 jobs, 0 applications)
    recruiterCEmail = `test_rep_rec_c_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRC] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter C', recruiterCEmail, hashedPassword, 'recruiter']
    );
    recruiterCId = resRC.insertId;
    userEmails.push(recruiterCEmail);
    recruiterCToken = jwt.sign({ userId: recruiterCId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate A
    candidateAEmail = `test_rep_cand_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate A', candidateAEmail, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(candidateAEmail);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Candidate B
    candidateBEmail = `test_rep_cand_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate B', candidateBEmail, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(candidateBEmail);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // Create Jobs
    // Job A1: Recruiter A, active
    const [resJobA1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterAId, 'Backend Engineer', 'Develop Node.js services', 'Bangalore', '12 LPA', '2-4 yrs', 'Full Time', 'Node.js, MySQL', 'active']
    );
    jobA1Id = resJobA1.insertId;

    // Job A2: Recruiter A, active
    const [resJobA2] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterAId, 'Frontend Engineer', 'Build React UI components', 'Remote', '10 LPA', '1-3 yrs', 'Remote', 'React, CSS', 'active']
    );
    jobA2Id = resJobA2.insertId;

    // Job A3: Recruiter A, closed
    const [resJobA3] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterAId, 'DevOps Specialist', 'Manage cloud infrastructure', 'Mumbai', '15 LPA', '3-5 yrs', 'Full Time', 'Docker, AWS', 'closed']
    );
    jobA3Id = resJobA3.insertId;

    // Job B1: Recruiter B, active
    const [resJobB1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recruiterBId, 'Product Manager', 'Lead roadmap and feature delivery', 'Delhi', '18 LPA', '4-6 yrs', 'Full Time', 'Agile, Roadmap', 'active']
    );
    jobB1Id = resJobB1.insertId;

    // Create Applications
    // App 1: Candidate A -> Job A1, status = 'pending'
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA1Id, candidateAId, 'pending']
    );

    // App 2: Candidate B -> Job A1, status = 'shortlisted'
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA1Id, candidateBId, 'shortlisted']
    );

    // App 3: Candidate A -> Job A2, status = 'selected'
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA2Id, candidateAId, 'selected']
    );

    // App 4: Candidate B -> Job A3 (Closed Job), status = 'rejected'
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobA3Id, candidateBId, 'rejected']
    );

    // App 5: Candidate A -> Job B1 (Recruiter B Job), status = 'pending'
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, ?)',
      [jobB1Id, candidateAId, 'pending']
    );
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
  // GROUP A — METRIC AGGREGATION
  // ==========================================
  describe('GROUP A — METRIC AGGREGATION', () => {
    it('1. Recruiter A Metrics & Status Breakdown Accuracy', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.stats);
      assert.ok(Array.isArray(response.body.status_breakdown));

      // Metric checks
      assert.strictEqual(response.body.stats.active_jobs, 2);
      assert.strictEqual(response.body.stats.total_applications, 4);
      assert.strictEqual(response.body.stats.pending_applications, 1);
      assert.strictEqual(response.body.stats.shortlisted_applications, 1);
      assert.strictEqual(response.body.stats.selected_applications, 1);
      assert.strictEqual(response.body.stats.rejected_applications, 1);

      // Status breakdown verification
      assert.strictEqual(response.body.status_breakdown.length, 4);

      const breakdownMap = {};
      for (const item of response.body.status_breakdown) {
        breakdownMap[item.status] = item.count;
      }

      assert.strictEqual(breakdownMap.pending, 1);
      assert.strictEqual(breakdownMap.shortlisted, 1);
      assert.strictEqual(breakdownMap.selected, 1);
      assert.strictEqual(breakdownMap.rejected, 1);
    });

    it('2. Recruiter C Empty State', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports')
        .set('Authorization', `Bearer ${recruiterCToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.stats);
      assert.ok(Array.isArray(response.body.status_breakdown));

      // All metrics must be numeric zero
      assert.strictEqual(response.body.stats.active_jobs, 0);
      assert.strictEqual(response.body.stats.total_applications, 0);
      assert.strictEqual(response.body.stats.pending_applications, 0);
      assert.strictEqual(response.body.stats.shortlisted_applications, 0);
      assert.strictEqual(response.body.stats.selected_applications, 0);
      assert.strictEqual(response.body.stats.rejected_applications, 0);

      assert.strictEqual(response.body.status_breakdown.length, 4);
      for (const item of response.body.status_breakdown) {
        assert.strictEqual(item.count, 0);
      }
    });

    it('3. Closed Job Handling', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);

      // Job A3 is closed, so active_jobs is 2
      assert.strictEqual(response.body.stats.active_jobs, 2);

      // App 4 is on closed Job A3, so it is still counted in total and rejected applications
      assert.strictEqual(response.body.stats.total_applications, 4);
      assert.strictEqual(response.body.stats.rejected_applications, 1);
    });
  });

  // ==========================================
  // GROUP B — MULTI-TENANT ISOLATION
  // ==========================================
  describe('GROUP B — MULTI-TENANT ISOLATION', () => {
    it('4. Recruiter B Isolation', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports')
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);

      // Recruiter B owns only Job B1 and App 5
      assert.strictEqual(response.body.stats.active_jobs, 1);
      assert.strictEqual(response.body.stats.total_applications, 1);
      assert.strictEqual(response.body.stats.pending_applications, 1);
      assert.strictEqual(response.body.stats.shortlisted_applications, 0);
      assert.strictEqual(response.body.stats.selected_applications, 0);
      assert.strictEqual(response.body.stats.rejected_applications, 0);

      // Explicitly verify Recruiter A's metrics are NOT present
      assert.notStrictEqual(response.body.stats.total_applications, 4);
      assert.notStrictEqual(response.body.stats.active_jobs, 2);
      assert.notStrictEqual(response.body.stats.shortlisted_applications, 1);
      assert.notStrictEqual(response.body.stats.selected_applications, 1);
      assert.notStrictEqual(response.body.stats.rejected_applications, 1);
    });
  });

  // ==========================================
  // GROUP C — AUTHORIZATION
  // ==========================================
  describe('GROUP C — AUTHORIZATION', () => {
    it('5. Candidate Access Forbidden', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Access restricted to recruiters only.');
    });

    it('6. Unauthenticated Access', async () => {
      const response = await request(app)
        .get('/api/recruiter/reports');

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Access denied. No token provided.');
    });
  });
});
