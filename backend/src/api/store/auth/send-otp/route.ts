import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { setOtp, isRateLimited } from "../../../../lib/otp-store";
import { sendOtpEmail } from "../../../../lib/email";
import { sendSmsOtp } from "../../../../lib/sms";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { SendOtpSchema } from "../../../../validators/auth.schemas";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = SendOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { identifier, firstName, lastName } = parsed.data;

    if (await isRateLimited(identifier)) {
      return res.status(429).json({ error: "Please wait 60 seconds before requesting another OTP." });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(identifier, { otp, firstName, lastName });

    const isPhone = /^\+?\d{7,}$/.test(identifier);
    if (isPhone) {
      await sendSmsOtp(identifier, otp);
    } else {
      await sendOtpEmail(identifier, otp);
    }

    logger.info({ identifier: isPhone ? "[phone]" : identifier }, "OTP sent");
    res.json({ success: true });
  } catch (err) {
    handleError(err, res, { action: "send-otp" });
  }
}
