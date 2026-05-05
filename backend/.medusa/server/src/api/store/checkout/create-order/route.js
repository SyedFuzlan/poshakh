"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const razorpay_1 = __importDefault(require("razorpay"));
const redis_1 = require("../../../../lib/redis");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const checkout_schemas_1 = require("../../../../validators/checkout.schemas");
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
async function POST(req, res) {
    try {
        const parsed = checkout_schemas_1.CreateOrderSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { cart_id, amount_in_rupees } = parsed.data;
        const order = await razorpay.orders.create({
            amount: Math.round(amount_in_rupees * 100),
            currency: "INR",
            receipt: `poshakh_${Date.now()}`,
        });
        // Store cart_id ↔ razorpay_order_id for webhook reconciliation
        await (0, redis_1.getRedisClient)().setex(`rp_order:${order.id}`, 60 * 60 * 24, cart_id);
        logger_1.logger.info({ razorpayOrderId: order.id, cart_id, amount_in_rupees }, "Razorpay order created");
        res.json({
            razorpay_order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
        });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "create-order" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NoZWNrb3V0L2NyZWF0ZS1vcmRlci9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQVlBLG9CQTRCQztBQXZDRCx3REFBZ0M7QUFDaEMsaURBQXVEO0FBQ3ZELCtEQUEyRDtBQUMzRCxtREFBZ0Q7QUFDaEQsOEVBQTRFO0FBRTVFLE1BQU0sUUFBUSxHQUFHLElBQUksa0JBQVEsQ0FBQztJQUM1QixNQUFNLEVBQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFnQjtJQUN4QyxVQUFVLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBb0I7Q0FDN0MsQ0FBQyxDQUFDO0FBRUksS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLG9DQUFpQixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvRixDQUFDO1FBQ0QsTUFBTSxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFbEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztZQUN6QyxNQUFNLEVBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7WUFDNUMsUUFBUSxFQUFFLEtBQUs7WUFDZixPQUFPLEVBQUcsV0FBVyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUU7U0FDbEMsQ0FBQyxDQUFDO1FBRUgsK0RBQStEO1FBQy9ELE1BQU0sSUFBQSxzQkFBYyxHQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksS0FBSyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRTVFLGVBQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxlQUFlLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBRWhHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDUCxpQkFBaUIsRUFBRSxLQUFLLENBQUMsRUFBRTtZQUMzQixNQUFNLEVBQWEsS0FBSyxDQUFDLE1BQU07WUFDL0IsUUFBUSxFQUFXLEtBQUssQ0FBQyxRQUFRO1lBQ2pDLE1BQU0sRUFBYSxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWU7U0FDL0MsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixJQUFBLDBCQUFXLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7QUFDSCxDQUFDIn0=