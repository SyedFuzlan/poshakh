"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = sendOtpEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const resend_1 = require("resend");
const logger_1 = require("./logger");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
const FROM = "Poshakh <noreply@poshakh.in>";
async function sendOtpEmail(to, otp) {
    if (process.env.NODE_ENV !== "production") {
        logger_1.logger.debug({ to, otp }, "[DEV] Email OTP");
        return;
    }
    const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject: "Your Poshakh verification code",
        html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p style="color:#555;margin:0 0 24px">Your one-time verification code:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111">${otp}</div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">Expires in 10 minutes. Do not share this code.</p>
      </div>`,
    });
    if (error) {
        logger_1.logger.error({ error, to }, "Resend OTP delivery failed");
        throw new Error("Failed to send verification email. Please try again.");
    }
}
async function sendPasswordResetEmail(to, otp) {
    if (process.env.NODE_ENV !== "production") {
        logger_1.logger.debug({ to, otp }, "[DEV] Password reset OTP");
        return;
    }
    const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject: "Reset your Poshakh password",
        html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin:0 0 8px">Reset your password</h2>
        <p style="color:#555;margin:0 0 24px">Enter this code to reset your password:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111">${otp}</div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>`,
    });
    if (error) {
        logger_1.logger.error({ error, to }, "Resend password reset delivery failed");
        throw new Error("Failed to send password reset email. Please try again.");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1haWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvbGliL2VtYWlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBTUEsb0NBcUJDO0FBRUQsd0RBcUJDO0FBbERELG1DQUFnQztBQUNoQyxxQ0FBa0M7QUFFbEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxlQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUN0RCxNQUFNLElBQUksR0FBRyw4QkFBOEIsQ0FBQztBQUVyQyxLQUFLLFVBQVUsWUFBWSxDQUFDLEVBQVUsRUFBRSxHQUFXO0lBQ3hELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssWUFBWSxFQUFFLENBQUM7UUFDMUMsZUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzdDLE9BQU87SUFDVCxDQUFDO0lBQ0QsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDekMsSUFBSSxFQUFFLElBQUk7UUFDVixFQUFFO1FBQ0YsT0FBTyxFQUFFLGdDQUFnQztRQUN6QyxJQUFJLEVBQUU7Ozs7cUZBSTJFLEdBQUc7O2FBRTNFO0tBQ1YsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNWLGVBQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztRQUMxRCxNQUFNLElBQUksS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7SUFDMUUsQ0FBQztBQUNILENBQUM7QUFFTSxLQUFLLFVBQVUsc0JBQXNCLENBQUMsRUFBVSxFQUFFLEdBQVc7SUFDbEUsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUUsQ0FBQztRQUMxQyxlQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLDBCQUEwQixDQUFDLENBQUM7UUFDdEQsT0FBTztJQUNULENBQUM7SUFDRCxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztRQUN6QyxJQUFJLEVBQUUsSUFBSTtRQUNWLEVBQUU7UUFDRixPQUFPLEVBQUUsNkJBQTZCO1FBQ3RDLElBQUksRUFBRTs7OztxRkFJMkUsR0FBRzs7YUFFM0U7S0FDVixDQUFDLENBQUM7SUFDSCxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ1YsZUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sSUFBSSxLQUFLLENBQUMsd0RBQXdELENBQUMsQ0FBQztJQUM1RSxDQUFDO0FBQ0gsQ0FBQyJ9