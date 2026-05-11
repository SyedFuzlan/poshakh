// ──────────────────────────────────────────────
//  utils/email.js
//  sendVerificationEmail — customer email verification
//  sendPasswordResetEmail — password reset flow
//
//  In dev (NODE_ENV != 'production'): logs link to console, skips Resend API.
//  In production: calls Resend API. Requires RESEND_API_KEY env var.
// ──────────────────────────────────────────────
const { Resend } = require('resend');
const logger = require('./logger');

// Lazily-initialized Resend client so require() does not throw in dev/test
// environments where RESEND_API_KEY is not set (constructor throws on empty key).
let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'Poshakh <noreply@poshakh.in>';

/**
 * Send email verification link to a new customer.
 * @param {string} to - Customer email address
 * @param {string} rawToken - The raw (unhashed) 64-char hex token to embed in the link
 */
async function sendVerificationEmail(to, rawToken) {
  // Verification hits the BACKEND API endpoint directly, so use BACKEND_URL (not
  // APP_URL which is the frontend origin). Fallback to port 9000 for local dev.
  const link = `${process.env.BACKEND_URL || 'http://localhost:9000'}/api/customers/verify-email?token=${rawToken}`;

  if (process.env.NODE_ENV !== 'production') {
    logger.info({ to, link }, `[DEV] Email verification link`);
    return;
  }

  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Verify your Poshakh email',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#1a1a1a">Verify your email</h2>
      <p>Click the button below to verify your Poshakh account email.</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px">Verify Email</a>
      <p style="color:#666;font-size:13px;margin-top:16px">This link expires in 24 hours. If you did not create a Poshakh account, you can ignore this email.</p>
    </div>`,
  });

  if (error) {
    logger.error({ error, to }, 'Resend delivery failed');
    throw new Error('Email delivery failed: ' + error.message);
  }
}

/**
 * Send password reset link.
 * @param {string} to - Customer email address
 * @param {string} rawToken - The raw (unhashed) 64-char hex token to embed in the link
 */
async function sendPasswordResetEmail(to, rawToken) {
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${rawToken}`;

  if (process.env.NODE_ENV !== 'production') {
    logger.info({ to, link }, `[DEV] Password reset link`);
    return;
  }

  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your Poshakh password',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
      <h2 style="color:#1a1a1a">Reset your password</h2>
      <p>Click the button below to reset your Poshakh account password.</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px">Reset Password</a>
      <p style="color:#666;font-size:13px;margin-top:16px">This link expires in 30 minutes. If you did not request a password reset, you can safely ignore this email.</p>
    </div>`,
  });

  if (error) {
    logger.error({ error, to }, 'Resend delivery failed');
    throw new Error('Email delivery failed: ' + error.message);
  }
}

/**
 * Send order confirmation email after successful payment.
 * Fire-and-forget safe — never throws, logs errors instead.
 * @param {string|null} to - Customer email (skipped if null/empty)
 * @param {{ orderId: string, items: Array, total: number, customerName: string }} opts
 */
function escHtml(val) {
  return String(val == null ? '' : val)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendOrderConfirmationEmail(to, { orderId, items, total, customerName }) {
  if (!to) return;

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (process.env.NODE_ENV !== 'production') {
    logger.info({ to, orderId, total }, '[DEV] Order confirmation email');
    return;
  }

  const itemRows = (Array.isArray(items) ? items : [])
    .map(item => `<tr><td style="padding:4px 8px">${escHtml(item.name)} (${escHtml(item.size)})</td><td style="padding:4px 8px;text-align:center">×${escHtml(item.quantity || 1)}</td></tr>`)
    .join('');

  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: `Order Confirmed — ${escHtml(orderId)}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
      <h2 style="color:#3D0D16">Your order is confirmed!</h2>
      <p>Hi ${escHtml(customerName)}, your order <strong>${escHtml(orderId)}</strong> has been placed successfully.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #eee">
        <thead><tr style="background:#f9f9f9"><th style="padding:8px;text-align:left">Item</th><th style="padding:8px">Qty</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p><strong>Total: ₹${Number(total).toLocaleString('en-IN')}</strong></p>
      <p style="color:#666;font-size:13px;margin-top:16px">Estimated delivery: 5–7 business days.<br>Track your order at <a href="${appUrl}/account">${appUrl}/account</a>.</p>
      <p style="color:#999;font-size:12px;margin-top:24px">Questions? Reply to this email or contact us at support@madebyzohra.in</p>
    </div>`,
  });

  if (error) {
    logger.error({ error, to, orderId }, 'Order confirmation email delivery failed');
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendOrderConfirmationEmail };
