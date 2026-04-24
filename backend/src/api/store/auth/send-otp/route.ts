import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { setOtp, isRateLimited } from "../../../../lib/otp-store";

async function sendViaMSG91(mobile: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    throw new Error("MSG91 credentials not configured");
  }

  // Normalize to international format without leading +
  const normalized = String(mobile).replace(/^\+/, "");

  const res = await fetch(
    `https://api.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalized}&authkey=${authKey}&otp=${otp}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MSG91 error ${res.status}: ${body}`);
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { identifier, firstName, lastName } = req.body as {
    identifier?: string;
    firstName?: string;
    lastName?: string;
  };

  if (!identifier) {
    return res.status(400).json({ error: "identifier required" });
  }

  const rateLimited = await isRateLimited(identifier);
  if (rateLimited) {
    return res.status(429).json({ error: "Please wait 60 seconds before requesting another OTP." });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));

  await setOtp(identifier, { otp, firstName, lastName });

  const isPhone = /^\+?\d{7,}$/.test(identifier);

  if (isPhone) {
    await sendViaMSG91(identifier, otp);
  } else {
    // Email OTP delivery can be added here (Resend SDK)
    // For now: log to terminal in non-production environments only
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[DEV] OTP for ${identifier}: ${otp}\n`);
    }
  }

  res.json({ success: true });
}
