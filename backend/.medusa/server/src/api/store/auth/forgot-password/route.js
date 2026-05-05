"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const otp_store_1 = require("../../../../lib/otp-store");
const email_1 = require("../../../../lib/email");
const handle_error_1 = require("../../../../lib/handle-error");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
const OK = { success: true, message: "If that account exists, a reset code was sent." };
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.ForgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { identifier } = parsed.data;
        if (await (0, otp_store_1.isRateLimited)(identifier)) {
            return res.status(429).json({ error: "Please wait before requesting another code." });
        }
        const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
        const isPhone = /^\+?\d{7,}$/.test(identifier);
        const customers = isPhone
            ? await customerService.listCustomers({ phone: identifier })
            : await customerService.listCustomers({ email: identifier });
        // Always 200 — prevents user enumeration
        if (!customers[0])
            return res.json(OK);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await (0, otp_store_1.setOtp)(identifier, { otp });
        if (!isPhone)
            await (0, email_1.sendPasswordResetEmail)(identifier, otp);
        res.json(OK);
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "forgot-password" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvZm9yZ290LXBhc3N3b3JkL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esb0JBOEJDO0FBdENELHFEQUFvRDtBQUNwRCx5REFBa0U7QUFDbEUsaURBQStEO0FBQy9ELCtEQUEyRDtBQUMzRCxzRUFBMkU7QUFFM0UsTUFBTSxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxnREFBZ0QsRUFBRSxDQUFDO0FBRWpGLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLE1BQU0sR0FBRyxtQ0FBb0IsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxVQUFVLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRW5DLElBQUksTUFBTSxJQUFBLHlCQUFhLEVBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUNwQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLDZDQUE2QyxFQUFFLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsZUFBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsTUFBTSxTQUFTLEdBQUcsT0FBTztZQUN2QixDQUFDLENBQUMsTUFBTSxlQUFlLENBQUMsYUFBYSxDQUFDLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBUyxDQUFDO1lBQ25FLENBQUMsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUUvRCx5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFBRSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFdkMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sSUFBQSxrQkFBTSxFQUFDLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFbEMsSUFBSSxDQUFDLE9BQU87WUFBRSxNQUFNLElBQUEsOEJBQXNCLEVBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTVELEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDZixDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUEsMEJBQVcsRUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsTUFBTSxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUN2RCxDQUFDO0FBQ0gsQ0FBQyJ9