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

describe('Candidate Profile API Integration Tests (career_connect_test)', () => {
  let candidateAId, candidateAToken, candidateAEmail, candidateAName;
  let candidateBId, candidateBToken, candidateBEmail, candidateBName;
  let recruiterAId, recruiterAToken, recruiterAEmail;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Candidate A (Users row only, NO candidate_profiles row)
    candidateAName = 'Candidate A';
    candidateAEmail = `test_prof_cand_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateAName, candidateAEmail, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(candidateAEmail);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Candidate B (Users row only, NO candidate_profiles row)
    candidateBName = 'Candidate B';
    candidateBEmail = `test_prof_cand_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateBName, candidateBEmail, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(candidateBEmail);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Recruiter A
    recruiterAEmail = `test_prof_rec_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', recruiterAEmail, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(recruiterAEmail);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });
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
  // GROUP A — GET /api/candidate/profile
  // ==========================================
  describe('GROUP A — GET /api/candidate/profile', () => {
    it('1. Initial Profile Retrieval (Default empty state before any PUT)', async () => {
      const response = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.profile);
      assert.strictEqual(response.body.profile.name, candidateAName);
      assert.strictEqual(response.body.profile.email, candidateAEmail);
      assert.strictEqual(response.body.profile.phone, '');
      assert.strictEqual(response.body.profile.location, '');
      assert.strictEqual(response.body.profile.skills, '');
      assert.strictEqual(response.body.profile.education, '');
      assert.strictEqual(response.body.profile.experience, '');
      assert.strictEqual(response.body.profile.bio, '');
    });

    it('2. Recruiter Role Forbidden on GET profile', async () => {
      const response = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Access restricted to candidates only.');
    });

    it('3. Unauthenticated GET profile', async () => {
      const response = await request(app)
        .get('/api/candidate/profile');

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Access denied. No token provided.');
    });
  });

  // ==========================================
  // GROUP B — PUT /api/candidate/profile
  // ==========================================
  describe('GROUP B — PUT /api/candidate/profile', () => {
    it('4. Initial Profile Creation / Upsert', async () => {
      const profileData = {
        phone: '9876543210',
        location: 'Bangalore',
        skills: 'Java, React, Node.js',
        education: 'BCA',
        experience: 'Fresher',
        bio: 'Full stack developer'
      };

      const response = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send(profileData);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Candidate profile updated successfully');
      assert.ok(response.body.profile);
      assert.strictEqual(response.body.profile.name, candidateAName);
      assert.strictEqual(response.body.profile.email, candidateAEmail);
      assert.strictEqual(response.body.profile.phone, '9876543210');
      assert.strictEqual(response.body.profile.location, 'Bangalore');
      assert.strictEqual(response.body.profile.skills, 'Java, React, Node.js');
      assert.strictEqual(response.body.profile.education, 'BCA');
      assert.strictEqual(response.body.profile.experience, 'Fresher');
      assert.strictEqual(response.body.profile.bio, 'Full stack developer');

      // Verify candidate_profiles row exists in database
      const [rows] = await pool.execute('SELECT * FROM candidate_profiles WHERE user_id = ?', [candidateAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].phone, '9876543210');
    });

    it('5. Database Persistence Verification via GET', async () => {
      const response = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.name, candidateAName);
      assert.strictEqual(response.body.profile.email, candidateAEmail);
      assert.strictEqual(response.body.profile.phone, '9876543210');
      assert.strictEqual(response.body.profile.location, 'Bangalore');
      assert.strictEqual(response.body.profile.skills, 'Java, React, Node.js');
      assert.strictEqual(response.body.profile.education, 'BCA');
      assert.strictEqual(response.body.profile.experience, 'Fresher');
      assert.strictEqual(response.body.profile.bio, 'Full stack developer');
    });

    it('6. Subsequent Profile Modification', async () => {
      const modifiedData = {
        phone: '9876543210',
        location: 'Mumbai',
        skills: 'Java, Spring Boot',
        education: 'BCA',
        experience: 'Fresher',
        bio: 'Backend-focused developer'
      };

      const response = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send(modifiedData);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.location, 'Mumbai');
      assert.strictEqual(response.body.profile.skills, 'Java, Spring Boot');
      assert.strictEqual(response.body.profile.bio, 'Backend-focused developer');

      // Direct SQL check: exactly 1 row updated in-place
      const [rows] = await pool.execute('SELECT * FROM candidate_profiles WHERE user_id = ?', [candidateAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].location, 'Mumbai');
      assert.strictEqual(rows[0].skills, 'Java, Spring Boot');
      assert.strictEqual(rows[0].bio, 'Backend-focused developer');
    });

    it('7. Partial Field Update', async () => {
      const response = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          phone: '9999999999'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.phone, '9999999999');

      // Direct DB check
      const [rows] = await pool.execute('SELECT * FROM candidate_profiles WHERE user_id = ?', [candidateAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].phone, '9999999999');
    });

    it('8. Recruiter Role Forbidden on Update', async () => {
      const response = await request(app)
        .put('/api/candidate/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          location: 'Delhi'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Access restricted to candidates only.');

      // Verify no candidate_profiles row was created for Recruiter A
      const [rows] = await pool.execute('SELECT * FROM candidate_profiles WHERE user_id = ?', [recruiterAId]);
      assert.strictEqual(rows.length, 0);
    });

    it('9. Unauthenticated PUT', async () => {
      const response = await request(app)
        .put('/api/candidate/profile')
        .send({
          location: 'Hyderabad'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Access denied. No token provided.');
    });
  });

  // ==========================================
  // GROUP C — CROSS-CANDIDATE ISOLATION
  // ==========================================
  describe('GROUP C — CROSS-CANDIDATE ISOLATION', () => {
    it('10. Candidate B Isolation (Cannot observe Candidate A populated data)', async () => {
      const response = await request(app)
        .get('/api/candidate/profile')
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.name, candidateBName);
      assert.strictEqual(response.body.profile.email, candidateBEmail);
      assert.strictEqual(response.body.profile.phone, '');
      assert.strictEqual(response.body.profile.location, '');
      assert.strictEqual(response.body.profile.skills, '');
      assert.strictEqual(response.body.profile.education, '');
      assert.strictEqual(response.body.profile.experience, '');
      assert.strictEqual(response.body.profile.bio, '');

      // Explicitly verify Candidate A's values are not present
      assert.notStrictEqual(response.body.profile.phone, '9999999999');
      assert.notStrictEqual(response.body.profile.name, candidateAName);
    });
  });
});
