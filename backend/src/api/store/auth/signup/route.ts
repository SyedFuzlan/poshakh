import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { v4 as uuidv4 } from "uuid";
import { setOtp, isRateLimited } from "../../../../lib/otp-store";
import { setPasswordHash } from "../../../../lib/auth-meta";
import { sendSmsOtp } from "../../../../lib/sms";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { SignupSchema } from "../../../../validators/auth.schemas";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = SignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { firstName, lastName, phone, email, password } = parsed.data;

    if (await isRateLimited(phone)) {
      return res.status(429).json({ error: "Please wait before requesting another OTP." });
    }

    const customerService = req.scope.resolve(Modules.CUSTOMER);

    // Look up existing customer by phone
    const existing = await customerService.listCustomers({ phone } as any);
    let customer = existing[0];

    if (!customer) {
      // Generate a placeholder email if not provided
      const resolvedEmail = email ?? `cust_${uuidv4()}@noreply.poshakh.in`;
      customer = await customerService.createCustomers({
        email:      resolvedEmail,
        phone,
        first_name: firstName,
        last_name:  lastName,
      });
      logger.info({ customerId: customer.id }, "New customer registered via password signup");
    }

    await setPasswordHash(customer.id, password);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    // Store OTP by phone so verify-otp can find it by the same identifier
    await setOtp(phone, { otp, firstName, lastName });
    await sendSmsOtp(phone, otp);

    res.status(201).json({
      success:    true,
      customerId: customer.id,
      message:    "OTP sent to your phone.",
    });
  } catch (err) {
    handleError(err, res, { action: "signup" });
  }
}
