import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { v4 as uuidv4 } from "uuid";
import { getOtp, deleteOtp, incrementAttempts, clearAttempts, MAX_ATTEMPTS } from "../../../../lib/otp-store";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { VerifyOtpSchema } from "../../../../validators/auth.schemas";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = VerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { identifier, otp, firstName, lastName } = parsed.data;

    // Enforce attempt limit before checking OTP value
    const attempts = await incrementAttempts(identifier);
    if (attempts > MAX_ATTEMPTS) {
      await deleteOtp(identifier);
      return res.status(429).json({ error: "Too many attempts. Request a new OTP." });
    }

    const entry = await getOtp(identifier);
    if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
      return res.status(401).json({ error: "Invalid or expired OTP" });
    }

    await deleteOtp(identifier);
    await clearAttempts(identifier);

    const customerService = req.scope.resolve(Modules.CUSTOMER);
    const isPhone = /^\+?\d+$/.test(identifier);

    const existing = isPhone
      ? await customerService.listCustomers({ phone: identifier } as any)
      : await customerService.listCustomers({ email: identifier });

    let customer = existing[0];

    if (!customer) {
      const resolvedEmail = isPhone ? `cust_${uuidv4()}@noreply.poshakh.in` : identifier;
      customer = await customerService.createCustomers({
        email: resolvedEmail,
        phone: isPhone ? identifier : undefined,
        first_name: firstName ?? entry.firstName ?? "",
        last_name:  lastName  ?? entry.lastName  ?? "",
      });
      logger.info({ customerId: customer.id }, "Customer created via OTP");
    }

    res.json({
      customer: {
        id:        customer.id,
        email:     customer.email,
        phone:     customer.phone,
        firstName: customer.first_name,
        lastName:  customer.last_name,
      },
    });
  } catch (err) {
    handleError(err, res, { action: "verify-otp" });
  }
}
