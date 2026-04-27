export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError  extends AppError { constructor(m: string) { super(422, m, "VALIDATION_ERROR"); } }
export class AuthError         extends AppError { constructor(m: string) { super(401, m, "AUTH_ERROR"); } }
export class ForbiddenError    extends AppError { constructor(m: string) { super(403, m, "FORBIDDEN"); } }
export class NotFoundError     extends AppError { constructor(m: string) { super(404, m, "NOT_FOUND"); } }
export class ConflictError     extends AppError { constructor(m: string) { super(409, m, "CONFLICT"); } }
export class PaymentError      extends AppError { constructor(m: string) { super(422, m, "PAYMENT_ERROR"); } }
export class RateLimitError    extends AppError { constructor(m: string) { super(429, m, "RATE_LIMITED"); } }
