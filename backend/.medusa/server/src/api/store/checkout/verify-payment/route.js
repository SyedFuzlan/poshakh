"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("../../../../lib/redis");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const checkout_schemas_1 = require("../../../../validators/checkout.schemas");
const PAYMENT_DEDUP_TTL = 60 * 60 * 24 * 30; // 30 days
async function POST(req, res) {
    try {
        const parsed = checkout_schemas_1.VerifyPaymentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;
        const redis = (0, redis_1.getRedisClient)();
        const dedupKey = `verified_payment:${razorpay_payment_id}`;
        if (await redis.get(dedupKey)) {
            logger_1.logger.warn({ razorpay_payment_id }, "Replay: payment already verified");
            return res.status(409).json({ error: "Payment already verified" });
        }
        const expected = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        if (!crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature))) {
            logger_1.logger.warn({ razorpay_order_id }, "Invalid payment signature");
            return res.status(401).json({ error: "Payment verification failed" });
        }
        await redis.setex(dedupKey, PAYMENT_DEDUP_TTL, "1");
        logger_1.logger.info({ razorpay_payment_id, razorpay_order_id }, "Payment verified");
        res.json({ success: true, payment_id: razorpay_payment_id, order_id: razorpay_order_id });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "verify-payment" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NoZWNrb3V0L3ZlcmlmeS1wYXltZW50L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBU0Esb0JBaUNDO0FBekNELG9EQUE0QjtBQUM1QixpREFBdUQ7QUFDdkQsK0RBQTJEO0FBQzNELG1EQUFnRDtBQUNoRCw4RUFBOEU7QUFFOUUsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxVQUFVO0FBRWhELEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxzQ0FBbUIsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFbkYsTUFBTSxLQUFLLEdBQUcsSUFBQSxzQkFBYyxHQUFFLENBQUM7UUFDL0IsTUFBTSxRQUFRLEdBQUcsb0JBQW9CLG1CQUFtQixFQUFFLENBQUM7UUFFM0QsSUFBSSxNQUFNLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUM5QixlQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO1lBQ3pFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsMEJBQTBCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxnQkFBTTthQUNwQixVQUFVLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW9CLENBQUM7YUFDdEQsTUFBTSxDQUFDLEdBQUcsaUJBQWlCLElBQUksbUJBQW1CLEVBQUUsQ0FBQzthQUNyRCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFakIsSUFBSSxDQUFDLGdCQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNwRixlQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO1lBQ2hFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsNkJBQTZCLEVBQUUsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFFRCxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BELGVBQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxtQkFBbUIsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFFNUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7SUFDNUYsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixJQUFBLDBCQUFXLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7SUFDdEQsQ0FBQztBQUNILENBQUMifQ==