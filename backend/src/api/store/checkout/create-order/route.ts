import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import Razorpay from "razorpay";
import { getRedisClient } from "../../../../lib/redis";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { CreateOrderSchema } from "../../../../validators/checkout.schemas";

// Lazy — avoids startup crash when Razorpay keys are not configured
function getRazorpay(): Razorpay {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay keys are not configured");
  return new Razorpay({ key_id, key_secret });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { cart_id, amount_in_rupees } = parsed.data;

    const order = await getRazorpay().orders.create({
      amount:   Math.round(amount_in_rupees * 100),
      currency: "INR",
      receipt:  `poshakh_${Date.now()}`,
    });

    // Store cart_id ↔ razorpay_order_id for webhook reconciliation
    await getRedisClient().setex(`rp_order:${order.id}`, 60 * 60 * 24, cart_id);

    logger.info({ razorpayOrderId: order.id, cart_id, amount_in_rupees }, "Razorpay order created");

    res.json({
      razorpay_order_id: order.id,
      amount:            order.amount,
      currency:          order.currency,
      key_id:            process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not configured")) {
      return res.status(503).json({ error: "Payment gateway not configured. Use [DEV] Simulate Payment for testing." });
    }
    handleError(err, res, { action: "create-order" });
  }
}
