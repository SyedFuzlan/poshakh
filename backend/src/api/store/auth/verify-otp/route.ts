import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { getOtp, deleteOtp } from "../../../../lib/otp-store";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { identifier, otp, firstName, lastName } = req.body as {
    identifier?: string;
    otp?: string;
    firstName?: string;
    lastName?: string;
  };

  if (!identifier || !otp) {
    return res.status(400).json({ error: "identifier and otp required" });
  }

  const entry = await getOtp(identifier);
  if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }
  await deleteOtp(identifier);

  const customerService = req.scope.resolve(Modules.CUSTOMER);
  const isPhone = /^\+?\d+$/.test(identifier);
  const email = isPhone ? null : identifier;
  const phone = isPhone ? identifier : null;

  const existing = email
    ? await customerService.listCustomers({ email })
    : await customerService.listCustomers({ phone });

  let customer = existing[0];

  if (!customer) {
    const resolvedFirst = firstName ?? entry.firstName ?? "";
    const resolvedLast = lastName ?? entry.lastName ?? "";
    const resolvedEmail = email ?? `${identifier.replace(/\D/g, "")}@poshakh.in`;

    customer = await customerService.createCustomers({
      email: resolvedEmail,
      phone: phone ?? undefined,
      first_name: resolvedFirst,
      last_name: resolvedLast,
    });
  }

  res.json({
    customer: {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
    },
  });
}
