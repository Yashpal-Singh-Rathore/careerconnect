// Configure test database environment before requiring app / db
process.env.DB_NAME = 'career_connect_test';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { app } = require('../server');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'career_connect_jwt_super_secret_key_2026';

describe('Resume API Integration Tests (career_connect_test)', () => {
  let recruiterAId, recruiterAToken;
  let recruiterBId, recruiterBToken;
  let candidateAId, candidateAToken;
  let candidateBId, candidateBToken;

  let job1RecruiterAId;
  let job2RecruiterBId;

  let resumeId;
  let firstPhysicalPath;
  let latestPhysicalPath;

  const testTimestamp = Date.now();
  const userEmails = [];
  const createdDiskFiles = new Set();

  before(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create Recruiter A
    const emailRecruiterA = `test_res_recruiter_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter A', emailRecruiterA, hashedPassword, 'recruiter']
    );
    recruiterAId = resRA.insertId;
    userEmails.push(emailRecruiterA);
    recruiterAToken = jwt.sign({ userId: recruiterAId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 2. Create Recruiter B
    const emailRecruiterB = `test_res_recruiter_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resRB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Recruiter B', emailRecruiterB, hashedPassword, 'recruiter']
    );
    recruiterBId = resRB.insertId;
    userEmails.push(emailRecruiterB);
    recruiterBToken = jwt.sign({ userId: recruiterBId, role: 'recruiter' }, JWT_SECRET, { expiresIn: '1d' });

    // 3. Create Candidate A
    const emailCandidateA = `test_res_candidate_a_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCA] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate A', emailCandidateA, hashedPassword, 'candidate']
    );
    candidateAId = resCA.insertId;
    userEmails.push(emailCandidateA);
    candidateAToken = jwt.sign({ userId: candidateAId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 4. Create Candidate B
    const emailCandidateB = `test_res_candidate_b_${testTimestamp}_${Math.random().toString(36).substring(2, 6)}@example.com`;
    const [resCB] = await pool.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Candidate B', emailCandidateB, hashedPassword, 'candidate']
    );
    candidateBId = resCB.insertId;
    userEmails.push(emailCandidateB);
    candidateBToken = jwt.sign({ userId: candidateBId, role: 'candidate' }, JWT_SECRET, { expiresIn: '1d' });

    // 5. Create Job 1 (Recruiter A)
    const [resJ1] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [recruiterAId, 'Platform Engineer', 'Kubernetes and Go', 'Austin, TX', '$150,000', '4 years', 'Full Time', 'Go, K8s']
    );
    job1RecruiterAId = resJ1.insertId;

    // 6. Create Job 2 (Recruiter B)
    const [resJ2] = await pool.execute(
      `INSERT INTO jobs (recruiter_id, title, description, location, salary, experience, job_type, skills, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [recruiterBId, 'Security Architect', 'AppSec and Cloud', 'Remote', '$170,000', '6 years', 'Remote', 'Security, Cloud']
    );
    job2RecruiterBId = resJ2.insertId;

    // 7. Candidate A applies to Job 1 (Recruiter A)
    await pool.execute(
      'INSERT INTO applications (job_id, candidate_id, status) VALUES (?, ?, "pending")',
      [job1RecruiterAId, candidateAId]
    );
  });

  after(async () => {
    // 1. Clean up tracked test files from disk
    for (const filePath of createdDiskFiles) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore
        }
      }
    }

    // 2. Clean up test users (cascades jobs, applications, and resumes)
    if (userEmails.length > 0) {
      for (const email of userEmails) {
        await pool.execute('DELETE FROM users WHERE email = ?', [email]);
      }
    }

    await pool.end();
  });

  // ==========================================
  // A. POST /api/candidate/resume
  // ==========================================
  describe('A. POST /api/candidate/resume', () => {
    it('1. Candidate A uploads a valid PDF (200)', async () => {
      const samplePdfBuffer = Buffer.from('%PDF-1.4 Sample Resume Candidate A');

      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('resume', samplePdfBuffer, 'candidate_a_resume_v1.pdf');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Resume uploaded successfully');
      assert.ok(response.body.resume);
      assert.strictEqual(typeof response.body.resume.id, 'number');
      assert.strictEqual(response.body.resume.file_name, 'candidate_a_resume_v1.pdf');
      assert.ok(response.body.resume.file_size > 0);

      resumeId = response.body.resume.id;

      // Track physical file path
      const [rows] = await pool.execute('SELECT file_path FROM resumes WHERE id = ?', [resumeId]);
      assert.strictEqual(rows.length, 1);
      firstPhysicalPath = path.join(__dirname, '..', rows[0].file_path);
      createdDiskFiles.add(firstPhysicalPath);
      assert.strictEqual(fs.existsSync(firstPhysicalPath), true);
    });

    it('2. Candidate A uploads without a resume file returns 400', async () => {
      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Please select a resume file to upload (.pdf, .doc, or .docx).');
    });

    it('3. Candidate A uploads an invalid file type returns 400', async () => {
      const txtBuffer = Buffer.from('Plain text notes');

      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('resume', txtBuffer, 'notes.txt');

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.');
    });

    it('4. Candidate A uploads a file larger than 5 MB returns 400', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB

      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('resume', largeBuffer, 'large_resume.pdf');

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'File size exceeds maximum limit of 5 MB.');
    });

    it('5. Candidate A uploads a second valid PDF to replace existing resume (200)', async () => {
      const secondPdfBuffer = Buffer.from('%PDF-1.4 Updated Resume Candidate A Content V2');

      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`)
        .attach('resume', secondPdfBuffer, 'candidate_a_resume_v2.pdf');

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Resume uploaded successfully');
      assert.strictEqual(response.body.resume.id, resumeId);
      assert.strictEqual(response.body.resume.file_name, 'candidate_a_resume_v2.pdf');

      // 1. Verify old physical file was removed
      assert.strictEqual(fs.existsSync(firstPhysicalPath), false);

      // 2. Verify new physical file exists
      const [rows] = await pool.execute('SELECT file_path FROM resumes WHERE id = ?', [resumeId]);
      assert.strictEqual(rows.length, 1);
      latestPhysicalPath = path.join(__dirname, '..', rows[0].file_path);
      createdDiskFiles.add(latestPhysicalPath);
      assert.strictEqual(fs.existsSync(latestPhysicalPath), true);

      // 3. Verify exactly 1 resume row exists for Candidate A
      const [allRows] = await pool.execute('SELECT id FROM resumes WHERE candidate_id = ?', [candidateAId]);
      assert.strictEqual(allRows.length, 1);
    });

    it('6. Recruiter A attempts to upload a resume returns 403', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Recruiter Try');

      const response = await request(app)
        .post('/api/candidate/resume')
        .set('Authorization', `Bearer ${recruiterAToken}`)
        .attach('resume', pdfBuffer, 'recruiter_resume.pdf');

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });

    it('7. Unauthenticated request attempts to upload a resume returns 401', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Unauth Try');

      const response = await request(app)
        .post('/api/candidate/resume')
        .attach('resume', pdfBuffer, 'unauth_resume.pdf');

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // B. GET /api/candidate/resume
  // ==========================================
  describe('B. GET /api/candidate/resume', () => {
    it('8. Candidate A retrieves their current resume (200)', async () => {
      const response = await request(app)
        .get('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.ok(response.body.resume);
      assert.strictEqual(response.body.resume.id, resumeId);
      assert.strictEqual(response.body.resume.file_name, 'candidate_a_resume_v2.pdf');
    });

    it('9. Candidate B, who has no resume, retrieves resume returns null (200)', async () => {
      const response = await request(app)
        .get('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.resume, null);
    });

    it('10. Recruiter A calls /api/candidate/resume returns 403', async () => {
      const response = await request(app)
        .get('/api/candidate/resume')
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
    });
  });

  // ==========================================
  // C. GET /api/resumes/:id
  // ==========================================
  describe('C. GET /api/resumes/:id', () => {
    it('11. Candidate A accesses their own resume (200)', async () => {
      const response = await request(app)
        .get(`/api/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.ok(response.headers['content-type'].includes('application/pdf') || response.headers['content-type'].includes('octet-stream'));
      assert.ok(response.body.length > 0);
    });

    it("12. Recruiter A accesses Candidate A's resume for their job application (200)", async () => {
      const response = await request(app)
        .get(`/api/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${recruiterAToken}`);

      assert.strictEqual(response.status, 200);
      assert.ok(response.body.length > 0);
    });

    it("13. Candidate B attempts to access Candidate A's resume returns 403", async () => {
      const response = await request(app)
        .get(`/api/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${candidateBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. You do not have permission to access this resume.');
    });

    it("14. Recruiter B attempts to access Candidate A's resume returns 403", async () => {
      const response = await request(app)
        .get(`/api/resumes/${resumeId}`)
        .set('Authorization', `Bearer ${recruiterBToken}`);

      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Forbidden. Candidate has not applied to any of your posted jobs.');
    });

    it('15. Request resume ID 999999 returns 404', async () => {
      const response = await request(app)
        .get('/api/resumes/999999')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 404);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Resume not found.');
    });
  });

  // ==========================================
  // D. DELETE /api/candidate/resume
  // ==========================================
  describe('D. DELETE /api/candidate/resume', () => {
    it('16. Candidate A deletes their resume (200)', async () => {
      const response = await request(app)
        .delete('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Resume deleted successfully');

      // 1. Verify physical file is deleted
      assert.strictEqual(fs.existsSync(latestPhysicalPath), false);

      // 2. Verify GET /api/candidate/resume returns null
      const getRes = await request(app)
        .get('/api/candidate/resume')
        .set('Authorization', `Bearer ${candidateAToken}`);
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.resume, null);

      // 3. Verify DB record is removed
      const [rows] = await pool.execute('SELECT * FROM resumes WHERE candidate_id = ?', [candidateAId]);
      assert.strictEqual(rows.length, 0);
    });
  });
});
