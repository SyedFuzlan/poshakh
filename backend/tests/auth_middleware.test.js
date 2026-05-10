const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const requireOwner = require('../middleware/requireOwner');

const app = express();
app.use(express.json());

app.get('/test-owner', requireOwner, (req, res) => {
  res.json({ ok: true });
});

describe('requireOwner Middleware', () => {
  const SECRET = 'test-secret';
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('should return 401 if no token is provided', async () => {
    const res = await request(app).get('/test-owner');
    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Not authenticated');
  });

  it('should return 401 if invalid token is provided', async () => {
    const res = await request(app)
      .get('/test-owner')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid or expired token');
  });

  it('should return 403 if token is valid but role is not owner', async () => {
    const token = jwt.sign({ email: 'user@test.com', role: 'customer' }, SECRET);
    const res = await request(app)
      .get('/test-owner')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toEqual('Forbidden');
  });

  it('should return 200 if valid owner token is provided', async () => {
    const token = jwt.sign({ email: 'admin@test.com', role: 'owner' }, SECRET);
    const res = await request(app)
      .get('/test-owner')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.ok).toEqual(true);
  });
});
