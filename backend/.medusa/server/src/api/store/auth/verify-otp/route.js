"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const uuid_1 = require("uuid");
const otp_store_1 = require("../../../../lib/otp-store");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.VerifyOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { identifier, otp, firstName, lastName } = parsed.data;
        // Enforce attempt limit before checking OTP value
        const attempts = await (0, otp_store_1.incrementAttempts)(identifier);
        if (attempts > otp_store_1.MAX_ATTEMPTS) {
            await (0, otp_store_1.deleteOtp)(identifier);
            return res.status(429).json({ error: "Too many attempts. Request a new OTP." });
        }
        const entry = await (0, otp_store_1.getOtp)(identifier);
        if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
            return res.status(401).json({ error: "Invalid or expired OTP" });
        }
        await (0, otp_store_1.deleteOtp)(identifier);
        await (0, otp_store_1.clearAttempts)(identifier);
        const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
        const isPhone = /^\+?\d+$/.test(identifier);
        const existing = isPhone
            ? await customerService.listCustomers({ phone: identifier })
            : await customerService.listCustomers({ email: identifier });
        let customer = existing[0];
        if (!customer) {
            const resolvedEmail = isPhone ? `cust_${(0, uuid_1.v4)()}@noreply.poshakh.in` : identifier;
            customer = await customerService.createCustomers({
                email: resolvedEmail,
                phone: isPhone ? identifier : undefined,
                first_name: firstName ?? entry.firstName ?? "",
                last_name: lastName ?? entry.lastName ?? "",
            });
            logger_1.logger.info({ customerId: customer.id }, "Customer created via OTP");
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
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "verify-otp" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvdmVyaWZ5LW90cC9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVFBLG9CQXVEQztBQTlERCxxREFBb0Q7QUFDcEQsK0JBQW9DO0FBQ3BDLHlEQUE4RztBQUM5RywrREFBMkQ7QUFDM0QsbURBQWdEO0FBQ2hELHNFQUFzRTtBQUUvRCxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsOEJBQWUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRTdELGtEQUFrRDtRQUNsRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUEsNkJBQWlCLEVBQUMsVUFBVSxDQUFDLENBQUM7UUFDckQsSUFBSSxRQUFRLEdBQUcsd0JBQVksRUFBRSxDQUFDO1lBQzVCLE1BQU0sSUFBQSxxQkFBUyxFQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsdUNBQXVDLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLENBQUM7UUFFRCxNQUFNLEtBQUss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