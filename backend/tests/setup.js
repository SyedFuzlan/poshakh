// Global mocks
jest.mock('../db', () => ({
  db: {
    prepare: jest.fn(() => ({
      all: jest.fn().mockResolvedValue([]),
      get: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({ lastInsertRowid: 0 })
    })),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn(async (cb) => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
      return await cb(client);
    }),
    logAudit: jest.fn(),
    close: jest.fn()
  }
}));

jest.mock('../utils/sms', () => ({
  notifyShipped: jest.fn(),
  notifyDelivered: jest.fn(),
  notifyOrderConfirmed: jest.fn()
}));

jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

// Global setup for tests
beforeAll(async () => {
  const logger = require('../utils/logger');
  // Silent logger during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    logger.level = 'silent';
  }
});
