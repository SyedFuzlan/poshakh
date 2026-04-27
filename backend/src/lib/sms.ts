import { logger } from "./logger";
import { AppError } from "../errors";

async function sendViaFast2SMS(mobile: string, otp: string): Promise<void> {
  const apiKey = process.env.FAST2SMS_API_KEY!;
  const digits10 = String(mobile).replace(/^\+?91/, "").replace(/^\+/, "");
  const message = encodeURIComponent(`Your Poshakh OTP is ${otp}. Valid for 10 minutes. Do not share.`);
  const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&message=${message}&language=english&route=q&numbers=${digits10}`;
  const res = await fetch(url, { method: "GET", headers: { "cache-control": "no-cache" } });
  const body = await res.json().catch(() => ({})) as { return?: boolean; request_id?: string; message?: string[] | string; status_code?: number };
  logger.info({ fast2smsBody: body, mobile: digits10.slice(0, 4) + "****" }, "Fast2SMS raw response");
  if (!body.return) {
    logger.error({ fast2smsError: body.message }, "Fast2SMS rejected OTP request");
    const isDnd = body.status_code === 427 || (typeof body.message === "string" && body.message.toLowerCase().includes("dnd"));
    if (isDnd) {
      throw new AppError(503, "This number is on the DND list. Please use your email address instead.", "SMS_DND_BLOCKED");
    }
    throw new AppError(503, "Unable to send OTP via SMS. Please try again or use email.", "SMS_DELIVERY_FAILED");
  }
  logger.info({ requestId: body.request_id }, "Fast2SMS OTP accepted");
}

async function sendViaMSG91(mobile: string, otp: string): Promise<void> {
  const authKey    = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) {
    logger.warn({ otp, mobile: mobile.slice(0, 4) + "****" }, "[DEV] MSG91 not configured — OTP logged for testing");
    return;
  }

  const normalized = String(mobile).replace(/^\+/, "");
  const withCountry = normalized.startsWith("91") ? normalized : `91${normalized}`;

  const senderId = process.env.MSG91_SENDER_ID ?? "";
  const senderParam = senderId ? `&sender=${senderId}` : "";
  const url = `https://api.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${withCountry}&authkey=${authKey}&otp=${otp}&realTimeResponse=1${senderParam}`;
  const res = await fetch(url, { method: "POST" });

  const body = await res.json().catch(() => ({})) as { type?: string; message?: string; request_id?: string };
  logger.info({ msg91Body: body, mobile: withCountry.slice(0, 5) + "****" }, "MSG91 raw response");

  if (!res.ok || body.type === "error") {
    logger.error({ msg91Error: body.message, status: res.status }, "MSG91 rejected OTP request");
    throw new Error(`SMS delivery failed: ${body.message ?? "Unknown error from MSG91"}`);
  }
  logger.info({ requestId: body.request_id }, "MSG91 OTP accepted");
}

export async function sendSmsOtp(mobile: string, otp: string): Promise<void> {
  if (process.env.FAST2SMS_API_KEY) {
    return sendViaFast2SMS(mobile, otp);
  }
  return sendViaMSG91(mobile, otp);
}
