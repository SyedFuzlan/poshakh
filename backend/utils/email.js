// ──────────────────────────────────────────────
//  utils/email.js
//  sendVerificationEmail — customer email verification
//  sendPasswordResetEmail — password reset flow
//
//  In dev (NODE_ENV != 'production'): logs link to console, skips Resend API.
//  In production: calls Resend API. Requires RESEND_API_KEY env var.
// ──────────────────────────────────────────────
const { Resend } = require('resend');

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
    console.log(`[DEV] Email verification link for ${to}: ${link}`);
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
    console.error('[email] Resend delivery failed:', error);
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
    console.log(`[DEV] Password reset link for ${to}: ${link}`);
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
    console.error('[email] Resend delivery failed:', error);
    throw new Error('Email delivery failed: ' + error.message);
  }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
