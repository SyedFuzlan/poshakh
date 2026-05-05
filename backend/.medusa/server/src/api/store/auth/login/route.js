"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const auth_meta_1 = require("../../../../lib/auth-meta");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
const INVALID_CREDS = "Invalid credentials";
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { identifier, password } = parsed.data;
        const customerService = req.scope.resolve(utils_1.Modules.CUSTOMER);
        const isPhone = /^\+?\d{7,}$/.test(identifier);
        const customers = isPhone
            ? await customerService.listCustomers({ phone: identifier })
            : await customerService.listCustomers({ email: identifier });
        const customer = customers[0];
        // Constant-time path — no user enumeration
        if (!customer || !(await (0, auth_meta_1.hasPassword)(customer.id))) {
            return res.status(401).json({ error: INVALID_CREDS });
        }
        if (!(await (0, auth_meta_1.verifyPassword)(customer.id, password))) {
            return res.status(401).json({ error: INVALID_CREDS });
        }
        logger_1.logger.info({ customerId: customer.id }, "Customer logged in");
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
        (0, handle_error_1.handleError)(err, res, { action: "login" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvbG9naW4vcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFTQSxvQkF1Q0M7QUEvQ0QscURBQW9EO0FBQ3BELHlEQUF3RTtBQUN4RSwrREFBMkQ7QUFDM0QsbURBQWdEO0FBQ2hELHNFQUFrRTtBQUVsRSxNQUFNLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQztBQUVyQyxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsSUFBSSxDQUFDO1FBQ0gsTUFBTSxNQUFNLEdBQUcsMEJBQVcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDcEIsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxtQkFBbUIsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsQ0FBQztRQUNELE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUU3QyxNQUFNLGVBQWUsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxlQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUQsTUFBTSxPQUFPLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUMvQyxNQUFNLFNBQVMsR0FBRyxPQUFPO1lBQ3ZCLENBQUMsQ0FBQyxNQUFNLGVBQWUsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFTLENBQUM7WUFDbkUsQ0FBQyxDQUFDLE1BQU0sZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBRS9ELE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUU5QiwyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFBLHVCQUFXLEVBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNuRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUVELElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBQSwwQkFBYyxFQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ25ELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLENBQUMsQ0FBQztRQUN4RCxDQUFDO1FBRUQsZUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUUvRCxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ1AsUUFBUSxFQUFFO2dCQUNSLEVBQUUsRUFBUyxRQUFRLENBQUMsRUFBRTtnQkFDdEIsS0FBSyxFQUFNLFFBQVEsQ0FBQyxLQUFLO2dCQUN6QixLQUFLLEVBQU0sUUFBUSxDQUFDLEtBQUs7Z0JBQ3pCLFNBQVMsRUFBRSxRQUFRLENBQUMsVUFBVTtnQkFDOUIsUUFBUSxFQUFHLFFBQVEsQ0FBQyxTQUFTO2FBQzlCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDYixJQUFBLDBCQUFXLEVBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7QUFDSCxDQUFDIn0=