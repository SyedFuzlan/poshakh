import { Resend } from "resend";
import { logger } from "./logger";

const FROM = "Poshakh <noreply@poshakh.in>";

// Lazy — only constructed when actually sending; avoids startup crash with empty key
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(key);
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.info({ to, otp }, "[DEV] Email OTP — no RESEND_API_KEY configured");
    return;
  }
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Your Poshakh verification code",
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p style="color:#555;margin:0 0 24px">Your one-time verification code:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111">${otp}</div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">Expires in 10 minutes. Do not share this code.</p>
      </div>`,
  });
  if (error) {
    logger.error({ error, to }, "Resend OTP delivery failed");
    throw new Error("Failed to send verification email. Please try again.");
  }
}

export async function sendPasswordResetEmail(to: string, otp: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.info({ to, otp }, "[DEV] Password reset OTP — no RESEND_API_KEY configured");
    return;
  }
  const { error } = await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your Poshakh password",
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin:0 0 8px">Reset your password</h2>
        <p style="color:#555;margin:0 0 24px">Enter this code to reset your password:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111">${otp}</div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
  });
  if (error) {
    logger.error({ error, to }, "Resend password reset delivery failed");
    throw new Error("Failed to send password reset email. Please try again.");
  }
}
