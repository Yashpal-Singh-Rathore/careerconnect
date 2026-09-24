// Configure test database environment before requiring app / db
process.env.DB_NAME = 'career_connect_test';

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../server');
const pool = require('../config/db');

describe('Authentication API Integration Tests (career_connect_test)', () => {
  const createdEmails = [];
  const validEmail = `test_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
  const validPassword = 'password123';

  after(async () => {
    if (createdEmails.length > 0) {
      for (const email of createdEmails) {
        await pool.execute('DELETE FROM users WHERE email = ?', [email]);
      }
    }
    await pool.end();
  });

  describe('POST /api/auth/register', () => {
    it('returns 201 for valid candidate registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test Candidate',
          email: validEmail,
          password: validPassword,
          role: 'candidate'
        });

      assert.strictEqual(response.status, 201);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'User registered successfully');
      assert.strictEqual(typeof response.body.user.id, 'number');
      assert.strictEqual(response.body.user.email, validEmail);
      assert.strictEqual(response.body.user.name, 'Test Candidate');
      assert.strictEqual(response.body.user.role, 'candidate');

      createdEmails.push(validEmail);
    });

    it('returns 400 when role is invalid', async () => {
      const email = `test_auth_role_${Date.now()}@example.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Role User',
          email,
          password: 'password123',
          role: 'admin'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Role must be either "candidate" or "recruiter".');
    });

    it('returns 400 when password is shorter than 6 characters', async () => {
      const email = `test_auth_short_${Date.now()}@example.com`;
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass User',
          email,
          password: '123',
          role: 'candidate'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Password must be at least 6 characters long.');
    });

    it('returns 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: validEmail,
          password: 'password123'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Name, email, password, and role are required.');
    });

    it('returns 400 when email is already registered (duplicate)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Candidate',
          email: validEmail,
          password: 'password123',
          role: 'recruiter'
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Email is already registered.');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with JWT token and user info for valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: validPassword
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.message, 'Login successful');
      assert.strictEqual(typeof response.body.token, 'string');
      assert.ok(response.body.token.length > 20);
      assert.strictEqual(response.body.user.email, validEmail);
      assert.strictEqual(response.body.user.role, 'candidate');
    });

    it('returns 401 when password is wrong', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail,
          password: 'incorrectPassword123'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Invalid email or password.');
    });

    it('returns 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: `nonexistent_${Date.now()}@example.com`,
          password: 'password123'
        });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Invalid email or password.');
    });

    it('returns 400 when email or password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validEmail
        });

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.message, 'Email and password are required.');
    });
  });
});
