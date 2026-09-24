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

describe('Recruiter Profile API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken, recruiterAEmail, recruiterAName;
  let recruiterBId, recruiterBToken, recruiterBEmail, recruiterBName;
  let candidateAId, candidateAToken, candidateAEmail, candidateAName;

  const testTimestamp = Date.now();
  const userEmails = [];

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A (Users row only, NO recruiter_profiles row)
    recruiterAName = 'Recruiter A';
    recruiterAEmail = `test_rec_prof_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [recruiterAName, recruiterAEmail, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(recruiterAEmail);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B (Users row only, NO recruiter_profiles row)
    recruiterBName = 'Recruiter B';
    recruiterBEmail = `test_rec_prof_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [recruiterBName, recruiterBEmail, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(recruiterBEmail);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate A
    candidateAName = 'Candidate A';
    candidateAEmail = `test_rec_cand_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [candidateAName, candidateAEmail, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(candidateAEmail);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });
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
  // GROUP A — GET /api/recruiter/profile
  // ==========================================
  describe('GROUP A — GET /api/recruiter/profile', () => {
    it('1. Initial Profile Retrieval', async () => {
      const response = await request(app)
        .get('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.profile);
      assert.strictEqual(response.body.profile.name, recruiterAName);
      assert.strictEqual(response.body.profile.email, recruiterAEmail);
      assert.strictEqual(response.body.profile.company_name, '');
      assert.strictEqual(response.body.profile.phone, '');
      assert.strictEqual(response.body.profile.location, '');
      assert.strictEqual(response.body.profile.company_description, '');
    });

    it('2. Candidate Role Forbidden', async () => {
      const response = await request(app)
        .get('/api/recruiter/profile')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Access restricted to recruiters only.');
    });

    it('3. Unauthenticated GET', async () => {
      const response = await request(app)
        .get('/api/recruiter/profile');

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Access denied. No token provided.');
    });
  });

  // ==========================================
  // GROUP B — PUT /api/recruiter/profile
  // ==========================================
  describe('GROUP B — PUT /api/recruiter/profile', () => {
    it('4. Initial Profile Creation / Upsert', async () => {
      const profileData = {
        company_name: 'TechNova Solutions',
        phone: '9876543210',
        location: 'Bangalore',
        company_description: 'Software development and technology services company'
      };

      const response = await request(app)
        .put('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send(profileData);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Recruiter profile updated successfully');
      assert.ok(response.body.profile);
      assert.strictEqual(response.body.profile.name, recruiterAName);
      assert.strictEqual(response.body.profile.email, recruiterAEmail);
      assert.strictEqual(response.body.profile.company_name, 'TechNova Solutions');
      assert.strictEqual(response.body.profile.phone, '9876543210');
      assert.strictEqual(response.body.profile.location, 'Bangalore');
      assert.strictEqual(response.body.profile.company_description, 'Software development and technology services company');

      // Verify Recruiter A now has exactly one row in recruiter_profiles
      const [rows] = await pool.execute('SELECT * FROM recruiter_profiles WHERE user_id = ?', [recruiterAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].company_name, 'TechNova Solutions');
      assert.strictEqual(rows[0].phone, '9876543210');
    });

    it('5. Database Persistence Verification', async () => {
      const response = await request(app)
        .get('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.name, recruiterAName);
      assert.strictEqual(response.body.profile.email, recruiterAEmail);
      assert.strictEqual(response.body.profile.company_name, 'TechNova Solutions');
      assert.strictEqual(response.body.profile.phone, '9876543210');
      assert.strictEqual(response.body.profile.location, 'Bangalore');
      assert.strictEqual(response.body.profile.company_description, 'Software development and technology services company');
    });

    it('6. Subsequent Profile Modification', async () => {
      const modifiedData = {
        company_name: 'TechNova Global',
        phone: '9876543210',
        location: 'Mumbai',
        company_description: 'Global software engineering company'
      };

      const response = await request(app)
        .put('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send(modifiedData);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.company_name, 'TechNova Global');
      assert.strictEqual(response.body.profile.location, 'Mumbai');
      assert.strictEqual(response.body.profile.company_description, 'Global software engineering company');

      // Direct SQL check: Recruiter A still has exactly ONE recruiter_profiles row
      const [rows] = await pool.execute('SELECT * FROM recruiter_profiles WHERE user_id = ?', [recruiterAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].company_name, 'TechNova Global');
      assert.strictEqual(rows[0].location, 'Mumbai');
      assert.strictEqual(rows[0].company_description, 'Global software engineering company');
    });

    it('7. Partial Field Update', async () => {
      const response = await request(app)
        .put('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .send({
          phone: '9999999999'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.phone, '9999999999');

      // Direct DB check
      const [rows] = await pool.execute('SELECT * FROM recruiter_profiles WHERE user_id = ?', [recruiterAId]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].phone, '9999999999');
    });

    it('8. Candidate Role Forbidden on Update', async () => {
      const response = await request(app)
        .put('/api/recruiter/profile')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .send({
          company_name: 'Hacked Corp'
        });

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Access restricted to recruiters only.');

      // Verify no recruiter_profiles row was created for Candidate A
      const [rows] = await pool.execute('SELECT * FROM recruiter_profiles WHERE user_id = ?', [candidateAId]);
      assert.strictEqual(rows.length, 0);
    });

    it('9. Unauthenticated PUT', async () => {
      const response = await request(app)
        .put('/api/recruiter/profile')
        .send({
          company_name: 'TechNova Solutions'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Access denied. No token provided.');
    });
  });

  // ==========================================
  // GROUP C — CROSS-RECRUITER ISOLATION
  // ==========================================
  describe('GROUP C — CROSS-RECRUITER ISOLATION', () => {
    it('10. Recruiter B Isolation', async () => {
      const response = await request(app)
        .get('/api/recruiter/profile')
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.profile.name, recruiterBName);
      assert.strictEqual(response.body.profile.email, recruiterBEmail);
      assert.strictEqual(response.body.profile.company_name, '');
      assert.strictEqual(response.body.profile.phone, '');
      assert.strictEqual(response.body.profile.location, '');
      assert.strictEqual(response.body.profile.company_description, '');

      // Explicitly verify Recruiter A's populated values are NOT returned
      assert.notStrictEqual(response.body.profile.company_name, 'TechNova Global');
      assert.notStrictEqual(response.body.profile.name, recruiterAName);
      assert.notStrictEqual(response.body.profile.email, recruiterAEmail);
    });
  });
});
