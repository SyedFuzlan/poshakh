"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
const redis_1 = require("../../../../lib/redis");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const checkout_schemas_1 = require("../../../../validators/checkout.schemas");
const IDEM_TTL = 60 * 60 * 24;
async function POST(req, res) {
    try {
        const parsed = checkout_schemas_1.CompleteCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { cart_id, email, customer_id, shipping_address, shipping_option_id } = parsed.data;
        // Idempotency
        const idempotencyKey = req.headers["idempotency-key"];
        if (idempotencyKey) {
            const cached = await (0, redis_1.getRedisClient)().get(`idem:${idempotencyKey}`);
            if (cached)
                return res.json(JSON.parse(cached));
        }
        const container = req.scope;
        const cartService = container.resolve(utils_1.Modules.CART);
        await cartService.updateCarts({
            id: cart_id,
            email,
            ...(customer_id ? { customer_id } : {}),
            shipping_address: {
                first_name: shipping_address.firstName,
                last_name: shipping_address.lastName,
                address_1: shipping_address.address,
                address_2: shipping_address.apartment,
                city: shipping_address.city,
                country_code: shipping_address.countryCode ?? "in",
                province: shipping_address.state,
                postal_code: shipping_address.pinCode,
                phone: shipping_address.phone,
            },
            billing_address: {
                first_name: shipping_address.firstName,
                last_name: shipping_address.lastName,
                address_1: shipping_address.address,
                city: shipping_address.city,
                country_code: shipping_address.countryCode ?? "in",
                province: shipping_address.state,
                postal_code: shipping_address.pinCode,
            },
        });
        await (0, core_flows_1.addShippingMethodToCartWorkflow)(container).run({
            input: { cart_id, options: [{ id: shipping_option_id }] },
        });
        const { result: pc } = await (0, core_flows_1.createPaymentCollectionForCartWorkflow)(container).run({
            input: { cart_id },
        });
        const paymentService = container.resolve(utils_1.Modules.PAYMENT);
        await paymentService.createPaymentSession({
            payment_collection_id: pc.id,
            provider_id: "pp_system_default",
            data: {},
            amount: pc.amount,
            currency_code: "inr",
        });
        const { result: order } = await (0, core_flows_1.completeCartWorkflow)(container).run({ input: { id: cart_id } });
        const payload = { success: true, order_id: order?.id ?? null };
        if (idempotencyKey) {
            await (0, redis_1.getRedisClient)().setex(`idem:${idempotencyKey}`, IDEM_TTL, JSON.stringify(payload));
        }
        logger_1.logger.info({ orderId: payload.order_id, cart_id }, "Order created");
        res.json(payload);
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "checkout-complete" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2NoZWNrb3V0L2NvbXBsZXRlL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBY0Esb0JBeUVDO0FBdEZELHFEQUFvRDtBQUNwRCw0REFJcUM7QUFDckMsaURBQXVEO0FBQ3ZELCtEQUEyRDtBQUMzRCxtREFBZ0Q7QUFDaEQsOEVBQWlGO0FBRWpGLE1BQU0sUUFBUSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBRXZCLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyx5Q0FBc0IsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxrQkFBa0IsRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFFMUYsY0FBYztRQUNkLE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQXVCLENBQUM7UUFDNUUsSUFBSSxjQUFjLEVBQUUsQ0FBQztZQUNuQixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsc0JBQWMsR0FBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLGNBQWMsRUFBRSxDQUFDLENBQUM7WUFDcEUsSUFBSSxNQUFNO2dCQUFFLE9B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