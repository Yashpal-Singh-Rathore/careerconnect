const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../server');

test('GET /api/health - returns server health status', async () => {
  const response = await request(app)
    .get('/api/health')
    .expect(200);

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(response.body, {
    success: true,
    message: 'CareerConnect API is running'
  });
});
