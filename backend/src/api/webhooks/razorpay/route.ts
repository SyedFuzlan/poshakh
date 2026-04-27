import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import crypto from "crypto";
import { getRedisClient } from "../../../lib/redis";
import { handleError } from "../../../lib/handle-error";
import { logger } from "../../../lib/logger";

const PROCESSED_TTL = 60 * 60 * 24 * 7;

function verifySignature(body: string, sig: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error("RAZORPAY_WEBHOOK_SECRET not set");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    const sig = req.headers["x-razorpay-signature"] as string;
    if (!sig || !verifySignature(JSON.stringify(req.body), sig, secret)) {
      logger.warn("Webhook: invalid signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body as { event: string; payload: Record<string, any> };
    const paymentId = event.payload?.payment?.entity?.id as string | undefined;
    const orderId   = event.payload?.payment?.entity?.order_id as string | undefined;

    if (paymentId) {
      const redis    = getRedisClient();
      const dedupKey = `webhook_processed:${paymentId}`;
      if (await redis.get(dedupKey)) {
        return res.json({ received: true, status: "already_processed" });
      }
      await redis.setex(dedupKey, PROCESSED_TTL, "1");
    }

    if (event.event === "payment.captured") {
      logger.info({ paymentId, orderId }, "Webhook: payment.captured");
      // Full webhook-driven order creation requires cart_id lookup from rp_order:{orderId}
      // Implemented in reconciliation job — cart_id stored at create-order time
      const cartId = orderId ? await getRedisClient().get(`rp_order:${orderId}`) : null;
      if (cartId) {
        logger.info({ cartId, orderId }, "Webhook: cart_id found — reconciliation available");
      }
    }

    if (event.event === "payment.failed") {
      logger.warn({ paymentId, orderId }, "Webhook: payment.failed");
    }

    res.json({ received: true });
  } catch (err) {
    handleError(err, res, { action: "razorpay-webhook" });
  }
}
