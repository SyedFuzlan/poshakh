const logger = require('./logger');

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;

async function sendSMS(phone, message) {
  if (!FAST2SMS_KEY) {
    logger.warn('Fast2SMS key not set. Skipping SMS.');
    return;
  }

  const params = new URLSearchParams({
    authorization: FAST2SMS_KEY,
    route: 'q',
    message,
    language: 'english',
    flash: '0',
    numbers: phone,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params}`, { signal: controller.signal });
    const data = await res.json();
    logger.info({ phone, response: data }, 'SMS sent');
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn({ phone }, 'SMS request timed out after 5s');
    } else {
      logger.error({ err, phone }, 'SMS sending failed');
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send Order Shipped notification
 */
async function notifyShipped(phone, name, orderId, courier, tracking) {
  const msg = `Hi ${name}, your ZOHRA order ${orderId} is shipped via ${courier}. Track: ${tracking}. Team Zohra`;
  return sendSMS(phone, msg);
}

/**
 * Send Order Delivered notification
 */
async function notifyDelivered(phone, name, orderId) {
  const msg = `Hi ${name}, your ZOHRA order ${orderId} has been delivered. We hope you love your new outfit! - Team Zohra`;
  return sendSMS(phone, msg);
}

async function notifyOrderConfirmed(phone, name, orderId, total) {
  const msg = `Hi ${name}, your order ${orderId} of ₹${total} is confirmed! Thank you for choosing MadeByZohra. Team Zohra`;
  return sendSMS(phone, msg);
}

module.exports = { sendSMS, notifyShipped, notifyDelivered, notifyOrderConfirmed };
