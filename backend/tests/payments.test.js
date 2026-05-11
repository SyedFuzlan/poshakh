const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

const TEST_KEY_ID = 'rzp_test_key';
const TEST_KEY_SECRET = 'rzp_test_secret';
const RZP_ORDER_ID = 'order_test123';
const RZP_PAY_ID = 'pay_test456';
const VALID_SIG = crypto
  .createHmac('sha256', TEST_KEY_SECRET)
  .update(`${RZP_ORDER_ID}|${RZP_PAY_ID}`)
  .digest('hex');

jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 50000,
        currency: 'INR',
      }),
    },
  }))
);

const { router } = require('../routes/payments');
const app = express();
app.use(express.json());
app.use('/api/payments', router);

describe('Payments API — Razorpay happy path', () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long-x';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payments/create-order', () => {
    it('returns razorpay_order_id for valid amount', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .send({ amount: 50000 });
      expect(res.statusCode).toBe(200);
      expect(res.body.razorpay_order_id).toBe('order_test123');
      expect(res.body.key_id).toBe(TEST_KEY_ID);
    });

    it('returns 400 for amount below minimum', async () => {
      const res = await request(app)
        .post('/api/payments/create-order')
        .send({ amount: 50 });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/payments/verify', () => {
    const VALID_ORDER_DATA = {
      id: 'checkout_123',
      customer_name: 'Test User',
      customer_phone: '9876543210',
      address: { line1: '123 Test St', city: 'Hyderabad', state: 'Telangana', pin_code: '500001' },
      items: [{ product_id: 'prod_1', size: 'M', name: 'Saree', quantity: 1 }],
      total: 500,
    };

    it('rejects invalid HMAC signature with 400', async () => {
      const res = await request(app)
        .post('/api/payments/verify')
        .send({
          razorpay_order_id: RZP_ORDER_ID,
          razorpay_payment_id: RZP_PAY_ID,
          razorpay_signature: 'badhmacsignature',
          order_data: VALID_ORDER_DATA,
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toMatch(/verification failed/i);
    });

    it('accepts valid HMAC, creates order, returns order_id', async () => {
      const { db } = require('../db');

      db.prepare.mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) });

      db.transaction.mockImplementationOnce(async (cb) => {
        const client = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ price: 500, price_paise: 50000 }] })
            .mockResolvedValueOnce({ rows: [{ id: 'var1', stock: 10, reserved_stock: 0 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ price_paise: 50000, price: 500 }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ id: 'var1' }] })
            .mockResolvedValueOnce({ rows: [] }),
        };
        return await cb(client);
      });

      const res = await request(app)
        .post('/api/payments/verify')
        .send({
          razorpay_order_id: RZP_ORDER_ID,
          razorpay_payment_id: RZP_PAY_ID,
          razorpay_signature: VALID_SIG,
          order_data: VALID_ORDER_DATA,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order_id).toMatch(/^PSK-/);
    });
  });
});
