const request = require('supertest');
const express = require('express');
const { db } = require('../db');

// Mock requireOwner
jest.mock('../middleware/requireOwner', () => (req, res, next) => {
  req.owner = { email: 'admin@test.com' };
  next();
});

// Mock payments
jest.mock('../routes/payments', () => ({
  generateOrderId: jest.fn(),
  validateOrderData: jest.fn(),
  saveOrder: jest.fn(),
  getRazorpay: jest.fn()
}));

const router = require('../routes/orders');
const app = express();
app.use(express.json());
app.use('/api/orders', router);

describe('PATCH /api/orders/:id - State Machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for invalid status transition (delivered -> pending)', async () => {
    db.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValueOnce({ id: 'ORD123', status: 'delivered' })
    });

    const res = await request(app)
      .patch('/api/orders/ORD123')
      .send({ status: 'pending' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toContain("Invalid status transition from 'delivered' to 'pending'");
  });

  it('should allow valid transition (processing -> shipped)', async () => {
    db.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValueOnce({ id: 'ORD123', status: 'processing' })
    });
    
    // Mock formatOrder query (called after update)
    db.prepare.mockReturnValueOnce({
      get: jest.fn().mockResolvedValueOnce({ 
        id: 'ORD123', 
        status: 'shipped', 
        items_json: '[]',
        customer_phone: '1234567890',
        customer_name: 'Test'
      })
    });

    const res = await request(app)
      .patch('/api/orders/ORD123')
      .send({ status: 'shipped', courier_name: 'BlueDart', tracking_number: '123' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.order.status).toEqual('shipped');
  });
});
