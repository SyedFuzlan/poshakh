const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockedhash'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('POST /api/customers — signup + login happy path', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long-x';
    const router = require('../routes/customers');
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/customers', router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/customers/signup', () => {
    it('returns 201 with accessToken for valid phone+password signup', async () => {
      const { db } = require('../db');
      db.prepare.mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) });
      db.prepare.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({
          id: 'cust_abc123', first_name: 'Test', last_name: 'User',
          phone: '9876543210', email: null, password_hash: '$2b$12$mockedhash',
        }),
      });
      db.prepare.mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });

      const res = await request(app)
        .post('/api/customers/signup')
        .send({ firstName: 'Test', lastName: 'User', phone: '9876543210', password: 'password123' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.customer.phone).toBe('9876543210');
    });

    it('returns 400 when password too short', async () => {
      const res = await request(app)
        .post('/api/customers/signup')
        .send({ phone: '9876543210', password: 'short' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when no phone or email', async () => {
      const res = await request(app)
        .post('/api/customers/signup')
        .send({ password: 'password123' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/customers/login', () => {
    it('returns 200 with accessToken for valid credentials', async () => {
      const { db } = require('../db');
      db.prepare.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({
          id: 'cust_abc123', first_name: 'Test', last_name: 'User',
          phone: '9876543210', email: null,
          password_hash: '$2b$12$mockedhash', deleted_at: null,
        }),
      });
      db.prepare.mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });
      db.prepare.mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });

      const res = await request(app)
        .post('/api/customers/login')
        .send({ identifier: '9876543210', password: 'password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('returns 401 for wrong password', async () => {
      const { db } = require('../db');
      const bcrypt = require('bcryptjs');
      db.prepare.mockReturnValueOnce({
        get: jest.fn().mockResolvedValue({
          id: 'cust_abc123', password_hash: '$2b$12$hash', deleted_at: null,
        }),
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/customers/login')
        .send({ identifier: 'wrong@email.com', password: 'wrongpass' });

      expect(res.statusCode).toBe(401);
    });
  });
});
