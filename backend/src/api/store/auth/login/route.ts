import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { verifyPassword, hasPassword } from "../../../../lib/auth-meta";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { LoginSchema } from "../../../../validators/auth.schemas";

const INVALID_CREDS = "Invalid credentials";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { identifier, password } = parsed.data;

    const customerService = req.scope.resolve(Modules.CUSTOMER);
    const isPhone = /^\+?\d{7,}$/.test(identifier);
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier } as any)
      : await customerService.listCustomers({ email: identifier });

    const customer = customers[0];

    // Constant-time path — no user enumeration
    if (!customer || !(await hasPassword(customer.id))) {
      return res.status(401).json({ error: INVALID_CREDS });
    }

    if (!(await verifyPassword(customer.id, password))) {
      return res.status(401).json({ error: INVALID_CREDS });
    }

    logger.info({ customerId: customer.id }, "Customer logged in");

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
    handleError(err, res, { action: "login" });
  }
}
