import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import crypto from "crypto";
import { getRedisClient } from "../../../../lib/redis";
import { handleError } from "../../../../lib/handle-error";
import { logger } from "../../../../lib/logger";
import { VerifyPaymentSchema } from "../../../../validators/checkout.schemas";

const PAYMENT_DEDUP_TTL = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = VerifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    const redis = getRedisClient();
    const dedupKey = `verified_payment:${razorpay_payment_id}`;

    if (await redis.get(dedupKey)) {
      logger.warn({ razorpay_payment_id }, "Replay: payment already verified");
      return res.status(409).json({ error: "Payment already verified" });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
      logger.warn({ razorpay_order_id }, "Invalid payment signature");
      return res.status(401).json({ error: "Payment verification failed" });
    }

    await redis.setex(dedupKey, PAYMENT_DEDUP_TTL, "1");
    logger.info({ razorpay_payment_id, razorpay_order_id }, "Payment verified");

    res.json({ success: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id });
  } catch (err) {
    handleError(err, res, { action: "verify-payment" });
  }
}
