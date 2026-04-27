import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { getOtp, deleteOtp, incrementAttempts, clearAttempts, MAX_ATTEMPTS } from "../../../../lib/otp-store";
import { setPasswordHash } from "../../../../lib/auth-meta";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { ResetPasswordSchema } from "../../../../validators/auth.schemas";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { identifier, otp, newPassword } = parsed.data;

    const attempts = await incrementAttempts(identifier);
    if (attempts > MAX_ATTEMPTS) {
      await deleteOtp(identifier);
      return res.status(429).json({ error: "Too many attempts. Request a new reset code." });
    }

    const entry = await getOtp(identifier);
    if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    await deleteOtp(identifier);
    await clearAttempts(identifier);

    const customerService = req.scope.resolve(Modules.CUSTOMER);
    const isPhone = /^\+?\d{7,}$/.test(identifier);
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier } as any)
      : await customerService.listCustomers({ email: identifier });

    if (!customers[0]) return res.status(404).json({ error: "Account not found" });

    await setPasswordHash(customers[0].id, newPassword);
    logger.info({ customerId: customers[0].id }, "Password reset");

    res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    handleError(err, res, { action: "reset-password" });
  }
}
