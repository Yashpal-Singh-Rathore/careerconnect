const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { verifyToken, requireRole } = require('../middleware/auth');

const TEST_SECRET = process.env.JWT_SECRET || 'career_connect_jwt_super_secret_key_2026';

const createMockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});

test('verifyToken: missing Authorization header returns 401', () => {
  const req = { headers: {} };
  const res = createMockRes();
  let nextCalled = false;

  verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(nextCalled, false);
});

test('verifyToken: malformed/invalid Bearer token returns 401', () => {
  const req = { headers: { authorization: 'Bearer invalid.token.payload' } };
  const res = createMockRes();
  let nextCalled = false;

  verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(nextCalled, false);
});

test('verifyToken: valid JWT calls next() and attaches decoded user to req.user', () => {
  const payload = { userId: 42, role: 'candidate' };
  const token = jwt.sign(payload, TEST_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createMockRes();
  let nextCalled = false;

  verifyToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.deepStrictEqual(req.user, payload);
  assert.strictEqual(res.statusCode, null);
});

test('requireRole: user with required role calls next()', () => {
  const req = { user: { userId: 42, role: 'recruiter' } };
  const res = createMockRes();
  let nextCalled = false;

  const middleware = requireRole('recruiter');
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
});

test('requireRole: user with wrong role receives 403', () => {
  const req = { user: { userId: 42, role: 'candidate' } };
  const res = createMockRes();
  let nextCalled = false;

  const middleware = requireRole('recruiter');
  middleware(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(nextCalled, false);
});
