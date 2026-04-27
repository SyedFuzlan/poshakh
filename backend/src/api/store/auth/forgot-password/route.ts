import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { setOtp, isRateLimited } from "../../../../lib/otp-store";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { sendSmsOtp } from "../../../../lib/sms";
import { handleError } from "../../../../lib/handle-error";
import { ForgotPasswordSchema } from "../../../../validators/auth.schemas";

const OK = { success: true, message: "If that account exists, a reset code was sent." };

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { identifier } = parsed.data;

    if (await isRateLimited(identifier)) {
      return res.status(429).json({ error: "Please wait before requesting another code." });
    }

    const customerService = req.scope.resolve(Modules.CUSTOMER);
    const isPhone = /^\+?\d{7,}$/.test(identifier);
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier } as any)
      : await customerService.listCustomers({ email: identifier });

    // Always 200 — prevents user enumeration
    if (!customers[0]) return res.json(OK);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await setOtp(identifier, { otp });

    if (isPhone) {
      await sendSmsOtp(identifier, otp);
    } else {
      await sendPasswordResetEmail(identifier, otp);
    }

    res.json(OK);
  } catch (err) {
    handleError(err, res, { action: "forgot-password" });
  }
}
