"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const otp_store_1 = require("../../../../lib/otp-store");
const email_1 = require("../../../../lib/email");
const handle_error_1 = require("../../../../lib/handle-error");
const logger_1 = require("../../../../lib/logger");
const auth_schemas_1 = require("../../../../validators/auth.schemas");
async function sendViaMSG91(mobile, otp) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!authKey || !templateId)
        throw new Error("MSG91 credentials not configured");
    const normalized = String(mobile).replace(/^\+/, "");
    const res = await fetch(`https://api.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${normalized}&authkey=${authKey}&otp=${otp}`, { method: "POST" });
    if (!res.ok) {
        logger_1.logger.error({ status: res.status }, "MSG91 delivery failed");
        throw new Error("Failed to send SMS OTP. Please try again.");
    }
}
async function POST(req, res) {
    try {
        const parsed = auth_schemas_1.SendOtpSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
        }
        const { identifier, firstName, lastName } = parsed.data;
        if (await (0, otp_store_1.isRateLimited)(identifier)) {
            return res.status(429).json({ error: "Please wait 60 seconds before requesting another OTP." });
        }
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        await (0, otp_store_1.setOtp)(identifier, { otp, firstName, lastName });
        const isPhone = /^\+?\d{7,}$/.test(identifier);
        if (isPhone) {
            await sendViaMSG91(identifier, otp);
        }
        else {
            await (0, email_1.sendOtpEmail)(identifier, otp);
        }
        logger_1.logger.info({ identifier: isPhone ? "[phone]" : identifier }, "OTP sent");
        res.json({ success: true });
    }
    catch (err) {
        (0, handle_error_1.handleError)(err, res, { action: "send-otp" });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2F1dGgvc2VuZC1vdHAvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUF1QkEsb0JBMkJDO0FBakRELHlEQUFrRTtBQUNsRSxpREFBcUQ7QUFDckQsK0RBQTJEO0FBQzNELG1EQUFnRDtBQUNoRCxzRUFBb0U7QUFFcEUsS0FBSyxVQUFVLFlBQVksQ0FBQyxNQUFjLEVBQUUsR0FBVztJQUNyRCxNQUFNLE9BQU8sR0FBTSxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQztJQUM5QyxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0lBQ2pELElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxVQUFVO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO0lBRWpGLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELE1BQU0sR0FBRyxHQUFHLE1BQU0sS0FBSyxDQUNyQixnREFBZ0QsVUFBVSxXQUFXLFVBQVUsWUFBWSxPQUFPLFFBQVEsR0FBRyxFQUFFLEVBQy9HLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUNuQixDQUFDO0lBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNaLGVBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLHVCQUF1QixDQUFDLENBQUM7UUFDOUQsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0lBQy9ELENBQUM7QUFDSCxDQUFDO0FBRU0sS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sTUFBTSxHQUFHLDRCQUFhLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3BCLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQy9GLENBQUM7UUFDRCxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRXhELElBQUksTUFBTSxJQUFBLHlCQUFhLEVBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUNwQyxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLHVEQUF1RCxFQUFFLENBQUMsQ0FBQztRQUNsRyxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sSUFBQSxrQkFBTSxFQUFDLFVBQVUsRUFBRSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUV2RCxNQUFNLE9BQU8sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQy9DLElBQUksT0FBTyxFQUFFLENBQUM7WUFDWixNQUFNLFlBQVksQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLElBQUEsb0JBQVksRUFBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELGVBQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUEsMEJBQVcsRUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDaEQsQ0FBQztBQUNILENBQUMifQ==