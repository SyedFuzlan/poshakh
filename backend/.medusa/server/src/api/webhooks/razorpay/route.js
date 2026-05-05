"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../../../lib/redis");
const handle_error_1 = require("../../../lib/handle-error");
const logger_1 = require("../../../lib/logger");
const PROCESSED_TTL = 60 * 60 * 24 * 7;
function verifySignature(body, sig, secret) {
    const expected = crypto_1.default.createHmac("sha256", secret).update(body).digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
    }
    catch {
        return false;
    }
}
async function POST(req, res) {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            logger_1.logger.error("RAZORPAY_WEBHOOK_SECRET not set");
            return res.status(500).json({ error: "Webhook not configured" });
        }
        const sig = req.headers["x-razorpay-signature"];
        if (!sig || !verifySignature(JSON.stringify(req.body), sig, secret)) {
            logger_1.logger.warn("Webhook: invalid signature");
            return res.status(400).json({ error: "Invalid signature" });
        }
        const event = req.body;
        const paymentId = event.payload?.payment?.entity?.id;
        const orderId = event.payload?.payment?.entity?.order_id;
        if (paymentId) {
            const redis = (0, redis_1.getRedisClient)();
            const dedupKey = `webhook_processed:${paymentId}`;
            if (await redis.get(dedupKey)) {
                return res.json({ received: true, status: "already_processed" });
            }
            await redis.setex(dedupKey, PROCESSED_TTL, "1");
        }
        if (event.event === "payment.captured") {
            logger_1.logger.info({ paymentId, orderId }, "Webhook: payment.captured");
            // Full webhook-driven order creation requires cart_id lookup from rp_order:{orderId}
            // Implemented in reconciliation job — cart_id stored at create-order time
            const cartId = orderId ? await (0, redis_1.getRedisClient)().get(`rp_order:${orderId}`) : null;
            if (cartId) {
                logger_1.logger.info({ cartId, orderId }, "Webhook: cart_id found — reconciliation available");
            }
        }
        if (event.event === "payment.failed") {
            logger_1.logger.warn({ paymentId, orderId }, "Webhook: payment.failed");
        }
        res.json({ received: true });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "razorpay-webhook" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3dlYmhvb2tzL3Jhem9ycGF5L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBaUJBLG9CQTZDQztBQTdERCxvREFBNEI7QUFDNUIsOENBQW9EO0FBQ3BELDREQUF3RDtBQUN4RCxnREFBNkM7QUFFN0MsTUFBTSxhQUFhLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRXZDLFNBQVMsZUFBZSxDQUFDLElBQVksRUFBRSxHQUFXLEVBQUUsTUFBYztJQUNoRSxNQUFNLFFBQVEsR0FBRyxnQkFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoRixJQUFJLENBQUM7UUFDSCxPQUFPLGdCQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDdkYsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztBQUNILENBQUM7QUFFTSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1QkFBdUIsQ0FBQztRQUNuRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDWixlQUFNLENBQUMsS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDaEQsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSx3QkFBd0Is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