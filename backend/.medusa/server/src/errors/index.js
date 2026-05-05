"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.PaymentError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.AuthError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(m) { super(422, m, "VALIDATION_ERROR"); }
}
exports.ValidationError = ValidationError;
class AuthError extends AppError {
    constructor(m) { super(401, m, "AUTH_ERROR"); }
}
exports.AuthError = AuthError;
class ForbiddenError extends AppError {
    constructor(m) { super(403, m, "FORBIDDEN"); }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(m) { super(404, m, "NOT_FOUND"); }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(m) { super(409, m, "CONFLICT"); }
}
exports.ConflictError = ConflictError;
class PaymentError extends AppError {
    constructor(m) { super(422, m, "PAYMENT_ERROR"); }
}
exports.PaymentError = PaymentError;
class RateLimitError extends AppError {
    constructor(m) { super(429, m, "RATE_LIMITED"); }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZXJyb3JzL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQWEsUUFBUyxTQUFRLEtBQUs7SUFDakMsWUFDa0IsVUFBa0IsRUFDbEMsT0FBZSxFQUNDLElBQWE7UUFFN0IsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBSkMsZUFBVSxHQUFWLFVBQVUsQ0FBUTtRQUVsQixTQUFJLEdBQUosSUFBSSxDQUFTO1FBRzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDO0lBQ3pCLENBQUM7Q0FDRjtBQVRELDRCQVNDO0FBRUQsTUFBYSxlQUFpQixTQUFRLFFBQVE7SUFBRyxZQUFZLENBQVMsSUFBSSxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQWhILDBDQUFnSDtBQUNoSCxNQUFhLFNBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQTNHLDhCQUEyRztBQUMzRyxNQUFhLGNBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQTFHLHdDQUEwRztBQUMxRyxNQUFhLGFBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQTFHLHNDQUEwRztBQUMxRyxNQUFhLGFBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQXpHLHNDQUF5RztBQUN6RyxNQUFhLFlBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQTlHLG9DQUE4RztBQUM5RyxNQUFhLGNBQWtCLFNBQVEsUUFBUTtJQUFHLFlBQVksQ0FBUyxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUFFO0FBQTdHLHdDQUE2RyJ9