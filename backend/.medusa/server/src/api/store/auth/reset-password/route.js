"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const otp_store_1 = require("../../../../lib/otp-store");
const auth_meta_1 = require("../../../../lib/auth-meta");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.ResetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { identifier, otp, newPassword } = parsed.data;
        const attempts = await (0, otp_store_1.incrementAttempts)(identifier);
        if (attempts > otp_store_1.MAX_ATTEMPTS) {
            await (0, otp_store_1.deleteOtp)(identifier);
            return res.status(429).json({ error: "Too many attempts. Request a new reset code." });
        }
        const entry = await (0, otp_store_1.getOtp)(identifier);
        if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
            return res.status(401).json({ error: "Invalid or expired code" });
        }
        await (0, otp_store_1.deleteOtp)(identifier);
        await (0, otp_store_1.clearAttempts)(identifier);
        const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
        const isPhone = /^\+?\d{7,}$/.test(identifier);
        const customers = isPhone
            ? await customerService.listCustomers({ phone: identifier })
            : await customerService.listCustomers({ email: identifier });
        if (!customers[0])
            return res.status(404).json({ error: "Account not found" });
        await (0, auth_meta_1.setPasswordHash)(customers[0].id, newPassword);
        logger_1.logger.info({ customerId: customers[0].id }, "Password reset");
        res.json({ success: true, message: "Password updated successfully." });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "reset-password" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvcmVzZXQtcGFzc3dvcmQvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFRQSxvQkFxQ0M7QUE1Q0QscURBQW9EO0FBQ3BELHlEQUE4RztBQUM5Ryx5REFBNEQ7QUFDNUQsK0RBQTJEO0FBQzNELG1EQUFnRDtBQUNoRCxzRUFBMEU7QUFFbkUsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLGtDQUFtQixDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMvRixDQUFDO1FBQ0QsTUFBTSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUVyRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUEsNkJBQWlCLEVBQUMsVUFBVSxDQUFDLENBQUM7UUFDckQsSUFBSSxRQUFRLEdBQUcsd0JBQVksRUFBRSxDQUFDO1lBQzVCLE1BQU0sSUFBQSxxQkFBUyxFQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsOENBQThDLEVBQUUsQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFFRCxNQUFNLEtBQUssR0FBRyxNQUFNLElBQUEsa0JBQU0sRUFBQyxVQUFVLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSx5QkFBeUIsRUFBRSxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUVELE1BQU0sSUFBQSxxQkFBUyxFQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sSUFBQSx5QkFBYSxFQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRWhDLE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGVBQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM1RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9DLE1BQU0sU0FBUyxHQUFHLE9BQU87WUFDdkIsQ0FBQyxDQUFDLE1BQU0sZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQVMsQ0FBQztZQUNuRSxDQUFDLENBQUMsTUFBTSxlQUFlLENBQUMsYUFBYSxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFFL0QsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFBRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLG1CQUFtQixFQUFFLENBQUMsQ0FBQztRQUUvRSxNQUFNLElBQUEsMkJBQWUsRUFBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3BELGVBQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFFL0QsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUEsMEJBQVcsRUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUN0RCxDQUFDO0FBQ0gsQ0FBQyJ9