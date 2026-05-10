const request = require('supertest');
const express = require('express');
const { db } = require('../db');

// Create a minimal app for testing basic routes
const app = express();

// Mock DB for health check
jest.mock('../db', () => ({
  db: {
    query: jest.fn()
  }
}));

app.get("/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", service: "poshakh-api", version: "1.0.0", database: "connected" });
  } catch (err) {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

describe('GET /health', () => {
  it('should return 200 and connected status when DB is healthy', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    
    const res = await request(app).get('/health');
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('database', 'connected');
  });

  it('should return 503 when DB is down', async () => {
    db.query.mockRejectedValueOnce(new Error('DB Down'));
    
    const res = await request(app).get('/health');
    
    expect(res.statusCode).toEqual(503);
    expect(res.body).toHaveProperty('database', 'disconnected');
  });
});
