/**
 * utils/invoice.js
 * Generates a professional HTML invoice for orders.
 */

function generateInvoiceHTML(order) {
  const itemsHtml = order.items.map(it => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${it.name}</strong><br/>
        <span style="font-size: 12px; color: #666;">Size: ${it.size || 'N/A'}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${it.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${(it.price_paise / 100).toLocaleString('en-IN')}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">₹${((it.price_paise * it.quantity) / 100).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${order.id}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; border: 1px solid #eee; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #800000; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #800000; text-transform: uppercase; letter-spacing: 2px; }
        .invoice-title { font-size: 24px; font-weight: 300; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        h4 { margin-bottom: 10px; color: #800000; text-transform: uppercase; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f9f9f9; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #666; }
        .totals { margin-left: auto; width: 250px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .grand-total { border-top: 2px solid #800000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 18px; color: #800000; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
        @media print { body { border: none; padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #800000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Print Invoice</button>
      </div>
      
      <div class="header">
        <div class="logo">Made By Zohra</div>
        <div class="invoice-title">Tax Invoice</div>
      </div>

      <div class="info-grid">
        <div>
          <h4>Sold By</h4>
          <p><strong>Made By Zohra</strong><br/>
          Surat, Gujarat, India<br/>
          Contact: +91 9876543210<br/>
          Email: support@madebyzohra.com</p>
        </div>
        <div style="text-align: right;">
          <h4>Order Details</h4>
          <p>Order ID: <strong>${order.id}</strong><br/>
          Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}<br/>
          Payment: ${order.payment_method.toUpperCase()}<br/>
          Status: ${order.status.toUpperCase()}</p>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <h4>Bill To</h4>
          <p><strong>${order.customer_name}</strong><br/>
          ${order.address.full}<br/>
          Phone: ${order.customer_phone}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item Details</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>₹${(order.subtotal_paise / 100).toLocaleString('en-IN')}</span>
        </div>
        <div class="total-row">
          <span>Shipping:</span>
          <span>${order.shipping_cost_paise === 0 ? 'FREE' : '₹' + (order.shipping_cost_paise / 100).toLocaleString('en-IN')}</span>
        </div>
        <div class="total-row grand-total">
          <span>Total:</span>
          <span>₹${(order.total_paise / 100).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for shopping with Made By Zohra!<br/>
        This is a computer-generated invoice and does not require a physical signature.</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = { generateInvoiceHTML };
