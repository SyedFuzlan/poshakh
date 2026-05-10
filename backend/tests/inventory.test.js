const { saveOrder } = require('../routes/payments');
const { db } = require('../db');

jest.mock('../utils/sms', () => ({
  notifyOrderConfirmed: jest.fn()
}));

describe('saveOrder Inventory Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if stock is insufficient', async () => {
    const orderData = {
      id: 'chk_123',
      customer_name: 'Test',
      customer_phone: '1234567890',
      address: { line1: 'Add', city: 'City', state: 'ST', pin_code: '123' },
      items: [{ product_id: 'prod_1', size: 'M', quantity: 5, name: 'Item' }],
      total: 100
    };

    // Mock DB to return stock = 1
    db.transaction.mockImplementationOnce(async (cb) => {
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ price_paise: 10000 }] }) // Product price
          .mockResolvedValueOnce({ rows: [{ id: 'var_1', stock: 1, reserved_stock: 0 }] }) // Variant stock
          .mockResolvedValueOnce({ rows: [] }) // Reservation check
      };
      return await cb(client);
    });

    await expect(saveOrder({
      orderId: 'ORD_1',
      checkoutId: 'chk_123',
      paymentMethod: 'COD',
      orderData
    })).rejects.toThrow('Insufficient stock');
  });

  it('should successfully reserve and decrement stock', async () => {
    const orderData = {
      id: 'chk_123',
      customer_name: 'Test',
      customer_phone: '1234567890',
      address: { line1: 'Add', city: 'City', state: 'ST', pin_code: '123' },
      items: [{ product_id: 'prod_1', size: 'M', quantity: 1, name: 'Item' }],
      total: 100
    };

    db.transaction.mockImplementationOnce(async (cb) => {
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ price_paise: 10000 }] }) // Product price Recalc
          .mockResolvedValueOnce({ rows: [{ id: 'var_1', stock: 10, reserved_stock: 0 }] }) // Variant stock
          .mockResolvedValueOnce({ rows: [] }) // Reservation check
          .mockResolvedValueOnce({ rows: [] }) // Insert order
          .mockResolvedValueOnce({ rows: [] }) // Status history
          .mockResolvedValueOnce({ rows: [{ price_paise: 10000 }] }) // Product price Items
          .mockResolvedValueOnce({ rows: [] }) // Insert item
          .mockResolvedValueOnce({ rows: [] }) // Delete reservation
          .mockResolvedValueOnce({ rows: [] }) // Update stock
          .mockResolvedValueOnce({ rows: [{ id: 'var_1' }] }) // Variant ID for logs
          .mockResolvedValueOnce({ rows: [] }) // Inventory logs
      };
      return await cb(client);
    });

    const orderId = await saveOrder({
      orderId: 'ORD_1',
      checkoutId: 'chk_123',
      paymentMethod: 'COD',
      orderData
    });

    expect(orderId).toEqual('ORD_1');
  });
});
