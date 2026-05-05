"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const otp_store_1 = require("../../../../lib/otp-store");
const auth_meta_1 = require("../../../../lib/auth-meta");
const email_1 = require("../../../../lib/email");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.SignupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { firstName, lastName, email, phone, password } = parsed.data;
        if (await (0, otp_store_1.isRateLimited)(email)) {
            return res.status(429).json({ error: "Please wait before requesting another OTP." });
        }
        const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
        const existing = await customerService.listCustomers({ email });
        let customer = existing[0];
        if (!customer) {
            customer = await customerService.createCustomers({
                email,
                phone: phone ?? undefined,
                first_name: firstName,
                last_name: lastName,
            });
            logger_1.logger.info({ customerId: customer.id }, "New customer registered");
        }
        await (0, auth_meta_1.setPasswordHash)(customer.id, password);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await (0, otp_store_1.setOtp)(email, { otp, firstName, lastName });
        await (0, email_1.sendOtpEmail)(email, otp);
        res.status(201).json({
            success: true,
            customerId: customer.id,
            message: "Check your email for a verification code.",
        });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "signup" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvc2lnbnVwL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esb0JBd0NDO0FBaERELHFEQUFvRDtBQUNwRCx5REFBa0U7QUFDbEUseURBQTREO0FBQzVELGlEQUFxRDtBQUNyRCwrREFBMkQ7QUFDM0QsbURBQWdEO0FBQ2hELHNFQUFtRTtBQUU1RCxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsMkJBQVksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUVwRSxJQUFJLE1BQU0sSUFBQSx5QkFBYSxFQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDL0IsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSw0Q0FBNEMsRUFBRSxDQUFDLENBQUM7UUFDdkYsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1RCxNQUFNLFFBQVEsR0FBRyxNQUFNLGVBQWUsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ2hFLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZCxRQUFRLEdBQUcsTUFBTSxlQUFlLENBQUMsZUFBZSxDQUFDO2dCQUMvQyxLQUFLO2dCQUNMLEtBQUssRUFBTyxLQUFLLElBQUksU0FBUztnQkFDOUIsVUFBVSxFQUFFLFNBQVM7Z0JBQ3JCLFNBQVMsRUFBRyxRQUFRO2FBQ3JCLENBQUMsQ0FBQztZQUNILGVBQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxVQUFVLEVBQUUsUUFBUSxDQUFDLEVBQUUsRUFBRSxFQUFFLHlCQUF5QixDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUVELE1BQU0sSUFBQSwyQkFBZSxFQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFN0MsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sSUFBQSxrQkFBTSxFQUFDLEtBQUssRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNsRCxNQUFNLElBQUEsb0JBQVksRUFBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFL0IsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDbkIsT0FBTyxFQUFLLElBQUk7WUFDaEIsVUFBVSxFQUFFLFFBQVEsQ0FBQyxFQUFFO1lBQ3ZCLE9BQU8sRUFBSywyQ0FBMkM7U0FDeEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixJQUFBLDBCQUFXLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7QUFDSCxDQUFDIn0=