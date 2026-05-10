const axios = require('axios');
const logger = require('./logger');

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;

/**
 * Send SMS using Fast2SMS
 * @param {string} phone - 10 digit phone number
 * @param {string} message - Message text
 */
async function sendSMS(phone, message) {
  if (!FAST2SMS_KEY) {
    logger.warn('Fast2SMS key not set. Skipping SMS.');
    return;
  }

  try {
    const res = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: FAST2SMS_KEY,
        route: 'q', // quick route
        message: message,
        language: 'english',
        flash: 0,
        numbers: phone
      }
    });
    logger.info({ phone, response: res.data }, `SMS sent`);
    return res.data;
  } catch (err) {
    logger.error({ err, phone }, 'SMS sending failed');
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
