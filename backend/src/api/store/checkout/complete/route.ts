import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  addShippingMethodToCartWorkflow,
  completeCartWorkflow,
  createPaymentCollectionForCartWorkflow,
} from "@medusajs/medusa/core-flows";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const container = req.scope;
  const {
    cart_id,
    email,
    customer_id,
    shipping_address,
    shipping_option_id,
  } = req.body as any;

  if (!cart_id || !email || !shipping_address || !shipping_option_id) {
    return res.status(400).json({ error: "cart_id, email, shipping_address, and shipping_option_id are required" });
  }

  try {
    // 1. Attach address + contact to cart
    const cartService = container.resolve(Modules.CART);
    await cartService.updateCarts({
      id: cart_id,
      email,
      ...(customer_id ? { customer_id } : {}),
      shipping_address: {
        first_name: shipping_address.firstName,
        last_name: shipping_address.lastName,
        address_1: shipping_address.address,
        address_2: shipping_address.apartment || undefined,
        city: shipping_address.city,
        country_code: "in",
        province: shipping_address.state,
        postal_code: shipping_address.pinCode,
        phone: shipping_address.phone,
      },
      billing_address: {
        first_name: shipping_address.firstName,
        last_name: shipping_address.lastName,
        address_1: shipping_address.address,
        city: shipping_address.city,
        country_code: "in",
        province: shipping_address.state,
        postal_code: shipping_address.pinCode,
      },
    });

    // 2. Add shipping method to cart
    await addShippingMethodToCartWorkflow(container).run({
      input: { cart_id, options: [{ id: shipping_option_id }] },
    });

    // 3. Create payment collection for cart
    const { result: pc } = await createPaymentCollectionForCartWorkflow(container).run({
      input: { cart_id },
    });

    // 4. Initialize payment session with system default provider
    const paymentService = container.resolve(Modules.PAYMENT);
    await paymentService.createPaymentSession({
      payment_collection_id: (pc as any).id,
      provider_id: "pp_system_default",
      data: {},
      amount: (pc as any).amount,
      currency_code: "inr",
    });

    // 5. Complete cart → creates order in Medusa
    const { result: order } = await completeCartWorkflow(container).run({
      input: { id: cart_id },
    });

    res.json({ success: true, order_id: (order as any)?.id ?? null });
  } catch (err: any) {
    console.error("Medusa cart complete error:", err?.message ?? err);
    res.status(500).json({ error: err?.message ?? "Failed to complete order" });
  }
}
