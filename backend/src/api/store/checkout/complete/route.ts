import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows";
import { getRedisClient } from "../../../../lib/redis";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { CompleteCheckoutSchema } from "../../../../validators/checkout.schemas";

const IDEM_TTL = 60 * 60 * 24;

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = CompleteCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { cart_id, email, customer_id, shipping_address, shipping_option_id } = parsed.data;

    // Idempotency
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const cached = await getRedisClient().get(`idem:${idempotencyKey}`);
      if (cached) return res.json(JSON.parse(cached));
    }

    const container = req.scope;
    const cartService = container.resolve(Modules.CART);

    await (cartService as any).updateCarts({
      id: cart_id,
      email,
      ...(customer_id ? { customer_id } : {}),
      shipping_address: {
        first_name:   shipping_address.firstName,
        last_name:    shipping_address.lastName,
        address_1:    shipping_address.address,
        address_2:    shipping_address.apartment,
        city:         shipping_address.city,
        country_code: shipping_address.countryCode ?? "in",
        province:     shipping_address.state,
        postal_code:  shipping_address.pinCode,
        phone:        shipping_address.phone,
      },
      billing_address: {
        first_name:   shipping_address.firstName,
        last_name:    shipping_address.lastName,
        address_1:    shipping_address.address,
        city:         shipping_address.city,
        country_code: shipping_address.countryCode ?? "in",
        province:     shipping_address.state,
        postal_code:  shipping_address.pinCode,
      },
    });

    await addShippingMethodToCartWorkflow(container).run({
      input: { cart_id, options: [{ id: shipping_option_id }] },
    });

    const { result: pc } = await createPaymentCollectionForCartWorkflow(container).run({
      input: { cart_id },
    });

    const paymentService = container.resolve(Modules.PAYMENT);
    const session = await (paymentService as any).createPaymentSession({
      payment_collection_id: (pc as any).id,
      provider_id:           "pp_system_default",
      data:                  {},
      amount:                (pc as any).amount,
      currency_code:         "inr",
    });

    // Authorize the session so completeCartWorkflow sees the payment as paid
    await paymentService.authorizePaymentSession((session as any).id, {});

    const { result: order } = await completeCartWorkflow(container).run({ input: { id: cart_id } });
    const payload = { success: true, order_id: (order as any)?.id ?? null };

    if (idempotencyKey) {
      await getRedisClient().setex(`idem:${idempotencyKey}`, IDEM_TTL, JSON.stringify(payload));
    }

    logger.info({ orderId: payload.order_id, cart_id }, "Order created");
    res.json(payload);
  } catch (err) {
    handleError(err, res, { action: "checkout-complete" });
  }
}
