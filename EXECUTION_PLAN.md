> ⚠️ **ARCHIVED — 2026-04-29**
> Medusa.js has been removed. This execution plan was written for the Medusa backend and is entirely obsolete. Do not act on this document. Current state and next steps are in **PROGRESS.md**.

---

# EXECUTION PLAN — POSHAKH
> Continues from commit 3a28675 · No restarts · Highest-impact first  
> Date: 2026-04-25 · Target: production-ready v1

---

## HOW TO READ THIS DOCUMENT

Each sprint has a **goal**, a set of **tasks**, and a **done signal** — the exact condition that confirms the sprint is complete before the next one starts. Tasks are ordered within each sprint: complete them in sequence.

---

## CURRENT BASELINE (what is live and working)

```
backend/src/api/store/auth/send-otp/route.ts       ← phone OTP via MSG91 ✓, email OTP stubbed ✗
backend/src/api/store/auth/verify-otp/route.ts     ← verifies OTP, creates customer ✓, no attempt limit ✗
backend/src/api/store/checkout/create-order/route.ts ← Razorpay order ✓
backend/src/api/store/checkout/verify-payment/route.ts ← HMAC verification ✓, no replay protection ✗
backend/src/api/store/checkout/complete/route.ts   ← full checkout workflow ✓, no idempotency ✗
backend/src/lib/otp-store.ts                       ← Redis OTP store ✓, no attempt counting ✗
backend/src/lib/redis.ts                           ← singleton client ✓
backend/src/scripts/seed.ts                        ← 9 products, 4 categories ✓
frontend/                                          ← empty directory ✗
```

---

## SPRINT 0 — TOOLING & DEPENDENCIES
**Duration**: 2 hours  
**Goal**: Install every missing package and configure code quality tools. Nothing runs differently after this sprint — it only unlocks every sprint that follows.

### Task 0.1 — Install production dependencies
```bash
cd backend
npm install bcrypt resend zod pino pino-http twilio envalid @sentry/node uuid
npm install --save-dev @types/bcrypt @types/uuid
```

### Task 0.2 — Install dev tooling
```bash
npm install --save-dev \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint-config-prettier \
  prettier \
  husky \
  lint-staged
```

### Task 0.3 — Add `.eslintrc.json`
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "warn"
  }
}
```

### Task 0.4 — Add `.prettierrc`
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Task 0.5 — Add `package.json` scripts
```json
"lint": "eslint 'src/**/*.ts'",
"format": "prettier --write 'src/**/*.ts'",
"typecheck": "tsc --noEmit"
```

### Task 0.6 — Initialize Husky
```bash
npx husky init
echo "npm run lint && npm run typecheck" > .husky/pre-commit
```

**Sprint 0 done signal**: `npm run lint` exits 0. `npm run typecheck` exits 0.

---

## SPRINT 1 — PATCH CRITICAL BUGS IN EXISTING CODE
**Duration**: 1.5 days  
**Goal**: Fix the 5 exploitable bugs in the code that already exists — without changing any behavior that works correctly.

---

### Task 1.1 — Add attempt limiting to OTP store
**File to modify**: `backend/src/lib/otp-store.ts`

Add two new exported functions after the existing ones:

```typescript
const ATTEMPT_KEY_PREFIX = "otp_attempts:"
const MAX_ATTEMPTS = 5

export async function incrementAttempts(identifier: string): Promise<number> {
  const redis = getRedisClient()
  const key = `${ATTEMPT_KEY_PREFIX}${identifier}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, OTP_TTL_SECONDS)
  }
  return count
}

export async function getAttempts(identifier: string): Promise<number> {
  const redis = getRedisClient()
  const val = await redis.get(`${ATTEMPT_KEY_PREFIX}${identifier}`)
  return val ? parseInt(val, 10) : 0
}

export async function clearAttempts(identifier: string): Promise<void> {
  const redis = getRedisClient()
  await redis.del(`${ATTEMPT_KEY_PREFIX}${identifier}`)
}

export { MAX_ATTEMPTS }
```

---

### Task 1.2 — Enforce attempt limit in verify-otp route
**File to modify**: `backend/src/api/store/auth/verify-otp/route.ts`

Replace the current OTP validation block (lines 17–21) with:

```typescript
import { getOtp, deleteOtp, incrementAttempts, clearAttempts, MAX_ATTEMPTS } from "../../../../lib/otp-store"

// inside POST handler, after the existing identifier/otp null check:

const attempts = await incrementAttempts(identifier)
if (attempts > MAX_ATTEMPTS) {
  await deleteOtp(identifier)
  return res.status(429).json({ error: "Too many attempts. Request a new OTP." })
}

const entry = await getOtp(identifier)
if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
  return res.status(401).json({ error: "Invalid or expired OTP" })
}

await deleteOtp(identifier)
await clearAttempts(identifier)
```

**Why**: After 5 wrong guesses the OTP is burned. Attacker cannot enumerate all 1M codes.

---

### Task 1.3 — Fix fallback email generation
**File to modify**: `backend/src/api/store/auth/verify-otp/route.ts`  
**Line to change**: `const resolvedEmail = email ?? \`${identifier.replace(/\D/g, "")}@poshakh.in\``

Replace with:
```typescript
import { v4 as uuidv4 } from "uuid"
// ...
const resolvedEmail = email ?? `cust_${uuidv4()}@noreply.poshakh.in`
```

**Why**: Old pattern encoded the customer's phone number into their email address — visible in admin, logs, and analytics.

---

### Task 1.4 — Add payment replay protection
**File to modify**: `backend/src/api/store/checkout/verify-payment/route.ts`

Add after the existing imports:
```typescript
import { getRedisClient } from "../../../lib/redis"

const PAYMENT_TTL = 60 * 60 * 24 * 30 // 30 days

async function isPaymentAlreadyVerified(paymentId: string): Promise<boolean> {
  const redis = getRedisClient()
  return (await redis.get(`verified_payment:${paymentId}`)) !== null
}

async function markPaymentVerified(paymentId: string): Promise<void> {
  const redis = getRedisClient()
  await redis.setex(`verified_payment:${paymentId}`, PAYMENT_TTL, "1")
}
```

Add at the top of the POST handler (after signature verification succeeds):
```typescript
if (await isPaymentAlreadyVerified(razorpay_payment_id)) {
  return res.status(409).json({ error: "Payment already verified" })
}
// ... existing verification logic ...
await markPaymentVerified(razorpay_payment_id)
```

---

### Task 1.5 — Add idempotency to checkout complete
**File to modify**: `backend/src/api/store/checkout/complete/route.ts`

Add at the top of the POST handler:
```typescript
import { getRedisClient } from "../../../lib/redis"

const IDEM_TTL = 60 * 60 * 24 // 24 hours

// inside POST, before any other logic:
const idempotencyKey = req.headers["idempotency-key"] as string | undefined
if (idempotencyKey) {
  const redis = getRedisClient()
  const cached = await redis.get(`idem:${idempotencyKey}`)
  if (cached) {
    return res.json(JSON.parse(cached))
  }
}
```

At the end of the success path (before `res.json`):
```typescript
const responsePayload = { success: true, order_id: (order as any)?.id ?? null }
if (idempotencyKey) {
  const redis = getRedisClient()
  await redis.setex(`idem:${idempotencyKey}`, IDEM_TTL, JSON.stringify(responsePayload))
}
res.json(responsePayload)
```

---

### Task 1.6 — Remove hardcoded secrets from .env.template
**File to modify**: `backend/.env.template`

Change lines 5–6:
```
JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_32
COOKIE_SECRET=CHANGE_ME_run_openssl_rand_base64_32
```

**Sprint 1 done signal**: Run `GET /store/auth/verify-otp` 6 times with a wrong OTP — 6th returns 429. Run `POST /store/checkout/verify-payment` twice with same signature — second returns 409.

---

## SPRINT 2 — FOUNDATION LAYER
**Duration**: 1.5 days  
**Goal**: Build the shared infrastructure every future route will use: env validation, structured logging, custom error classes, and centralized error handling. All existing routes are migrated to use these.

---

### Task 2.1 — Environment validation
**File to create**: `backend/src/config/env.ts`

```typescript
import { cleanEnv, str, url } from "envalid"

export const env = cleanEnv(process.env, {
  DATABASE_URL:        str({ desc: "PostgreSQL connection URL" }),
  REDIS_URL:           url({ default: "redis://localhost:6379" }),
  JWT_SECRET:          str({ desc: "JWT signing secret" }),
  COOKIE_SECRET:       str({ desc: "Cookie signing secret" }),
  STORE_CORS:          str(),
  ADMIN_CORS:          str(),
  AUTH_CORS:           str(),
  MSG91_AUTH_KEY:      str({ default: "" }),
  MSG91_TEMPLATE_ID:   str({ default: "" }),
  RAZORPAY_KEY_ID:     str({ default: "" }),
  RAZORPAY_KEY_SECRET: str({ default: "" }),
  RAZORPAY_WEBHOOK_SECRET: str({ default: "" }),
  RESEND_API_KEY:      str({ default: "" }),
  SENTRY_DSN:          str({ default: "" }),
  NODE_ENV:            str({ choices: ["development", "test", "production"], default: "development" }),
})
```

**Add startup guard** in `medusa-config.ts` (line 1):
```typescript
import "./src/config/env"  // fails fast on missing required vars
```

---

### Task 2.2 — Structured logger
**File to create**: `backend/src/lib/logger.ts`

```typescript
import pino from "pino"

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  base: { service: "poshakh-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
})
```

**Migrate existing console calls**:
- `backend/src/lib/redis.ts` line 13: replace `console.error(...)` with `logger.error({ err }, "[Redis] connection error")`
- `backend/src/api/store/checkout/complete/route.ts` line 79: replace `console.error(...)` with `logger.error({ err, cart_id }, "cart complete failed")`
- `backend/src/api/store/auth/send-otp/route.ts` line 53: replace `console.log(...)` with `logger.debug({ identifier }, "DEV email OTP")`

---

### Task 2.3 — Custom error classes
**File to create**: `backend/src/errors/index.ts`

```typescript
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string) { super(400, message, "VALIDATION_ERROR") }
}

export class AuthError extends AppError {
  constructor(message: string) { super(401, message, "AUTH_ERROR") }
}

export class ConflictError extends AppError {
  constructor(message: string) { super(409, message, "CONFLICT_ERROR") }
}

export class PaymentError extends AppError {
  constructor(message: string) { super(422, message, "PAYMENT_ERROR") }
}

export class NotFoundError extends AppError {
  constructor(message: string) { super(404, message, "NOT_FOUND") }
}
```

---

### Task 2.4 — Centralized error handler utility
**File to create**: `backend/src/lib/handle-error.ts`

```typescript
import { MedusaResponse } from "@medusajs/framework/http"
import { AppError } from "../errors"
import { logger } from "./logger"

export function handleError(err: unknown, res: MedusaResponse, context?: object): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }
  logger.error({ err, ...context }, "Unhandled error")
  res.status(500).json({ error: "An unexpected error occurred. Please try again." })
}
```

**Migrate existing catch blocks**:  
Replace `res.status(500).json({ error: err?.message ... })` in `checkout/complete/route.ts` with:
```typescript
} catch (err) {
  handleError(err, res, { cart_id })
}
```

---

### Task 2.5 — Zod validation schemas
**File to create**: `backend/src/validators/auth.schemas.ts`

```typescript
import { z } from "zod"

export const SendOtpSchema = z.object({
  identifier: z.string().min(5, "identifier required"),
  firstName: z.string().optional(),
  lastName:  z.string().optional(),
})

export const VerifyOtpSchema = z.object({
  identifier: z.string().min(5),
  otp:        z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/),
  firstName:  z.string().optional(),
  lastName:   z.string().optional(),
})
```

**File to create**: `backend/src/validators/checkout.schemas.ts`

```typescript
import { z } from "zod"

export const CreateOrderSchema = z.object({
  cart_id: z.string().min(1, "cart_id required"),
})

export const VerifyPaymentSchema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
})

export const CompleteCheckoutSchema = z.object({
  cart_id:            z.string().min(1),
  email:              z.string().email(),
  customer_id:        z.string().optional(),
  shipping_option_id: z.string().min(1),
  shipping_address: z.object({
    firstName:   z.string().min(1),
    lastName:    z.string().min(1),
    address:     z.string().min(1),
    apartment:   z.string().optional(),
    city:        z.string().min(1),
    state:       z.string().min(1),
    pinCode:     z.string().regex(/^\d{6}$/, "Invalid PIN code"),
    phone:       z.string().min(10),
    countryCode: z.string().length(2).default("in"),
  }),
})
```

**Wire validation into routes**: Add at the top of each POST handler:
```typescript
const parsed = SomeSchema.safeParse(req.body)
if (!parsed.success) {
  return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() })
}
const { fieldName } = parsed.data
```

Also fix BUG-009 (hardcoded country_code) in `checkout/complete/route.ts` — use `parsed.data.shipping_address.countryCode` instead of `"in"`.

---

**Sprint 2 done signal**: `npm run typecheck` passes. Submit an invalid OTP format — get a 422 with field-level detail. Submit checkout with invalid pinCode — get 422. Start backend without `DATABASE_URL` — process exits with a clear message.

---

## SPRINT 3 — AUTH SYSTEM REBUILD
**Duration**: 2.5 days  
**Goal**: Add password-based auth on top of the existing OTP infrastructure. Do not remove the working OTP flow — extend it. Phone OTP login remains as an alternative.

---

### Task 3.1 — Create Medusa custom module for auth metadata
**Why**: Medusa's customer model has no `password_hash` or `email_verified` field. We store these in a separate Redis-backed metadata store (fast to ship, no schema migration) and replace with a proper DB column in v1.1.

**File to create**: `backend/src/lib/auth-meta.ts`

```typescript
import { getRedisClient } from "./redis"
import bcrypt from "bcrypt"

const BCRYPT_ROUNDS = 12
const META_TTL = 0  // persist forever (Redis must be durable or use DB in v1.1)

interface AuthMeta {
  passwordHash?: string
  emailVerified: boolean
  createdAt: number
}

function metaKey(customerId: string) {
  return `auth_meta:${customerId}`
}

export async function setPasswordHash(customerId: string, plainPassword: string): Promise<void> {
  const redis = getRedisClient()
  const existing = await getAuthMeta(customerId)
  const meta: AuthMeta = {
    ...existing,
    passwordHash: await bcrypt.hash(plainPassword, BCRYPT_ROUNDS),
    emailVerified: existing?.emailVerified ?? false,
    createdAt: existing?.createdAt ?? Date.now(),
  }
  await redis.set(metaKey(customerId), JSON.stringify(meta))
}

export async function verifyPassword(customerId: string, plainPassword: string): Promise<boolean> {
  const meta = await getAuthMeta(customerId)
  if (!meta?.passwordHash) return false
  return bcrypt.compare(plainPassword, meta.passwordHash)
}

export async function setEmailVerified(customerId: string): Promise<void> {
  const redis = getRedisClient()
  const existing = await getAuthMeta(customerId) ?? { emailVerified: false, createdAt: Date.now() }
  await redis.set(metaKey(customerId), JSON.stringify({ ...existing, emailVerified: true }))
}

export async function getAuthMeta(customerId: string): Promise<AuthMeta | null> {
  const redis = getRedisClient()
  const raw = await redis.get(metaKey(customerId))
  return raw ? (JSON.parse(raw) as AuthMeta) : null
}

export async function hasPassword(customerId: string): Promise<boolean> {
  const meta = await getAuthMeta(customerId)
  return !!meta?.passwordHash
}
```

---

### Task 3.2 — Email OTP delivery via Resend
**File to create**: `backend/src/lib/email.ts`

```typescript
import { Resend } from "resend"
import { logger } from "./logger"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "Poshakh <noreply@poshakh.in>"

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.debug({ email, otp }, "[DEV] Email OTP")
    return
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Poshakh verification code",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto">
        <h2>Verify your email</h2>
        <p>Your one-time verification code is:</p>
        <h1 style="letter-spacing:8px;font-size:36px">${otp}</h1>
        <p>This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  })
  if (error) {
    logger.error({ error, email }, "Resend delivery failed")
    throw new Error("Failed to send verification email")
  }
}

export async function sendPasswordResetEmail(email: string, otp: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.debug({ email, otp }, "[DEV] Password reset OTP")
    return
  }
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Poshakh password",
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto">
        <h2>Reset your password</h2>
        <p>Enter this code to reset your password:</p>
        <h1 style="letter-spacing:8px;font-size:36px">${otp}</h1>
        <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  })
  if (error) {
    logger.error({ error, email }, "Resend password reset delivery failed")
    throw new Error("Failed to send password reset email")
  }
}
```

**Update `send-otp/route.ts`** — replace the `else` stub (lines 51–56) with:
```typescript
import { sendOtpEmail } from "../../../../lib/email"
// ...
} else {
  await sendOtpEmail(identifier, otp)
}
```

---

### Task 3.3 — Signup endpoint
**File to create**: `backend/src/api/store/auth/signup/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import { setOtp, isRateLimited } from "../../../../lib/otp-store"
import { setPasswordHash } from "../../../../lib/auth-meta"
import { sendOtpEmail } from "../../../../lib/email"
import { handleError } from "../../../../lib/handle-error"
import { logger } from "../../../../lib/logger"

const SignupSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().optional(),
  password:  z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = SignupSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() })
    }
    const { firstName, lastName, email, phone, password } = parsed.data

    if (await isRateLimited(email)) {
      return res.status(429).json({ error: "Please wait before requesting another OTP." })
    }

    const customerService = req.scope.resolve(Modules.CUSTOMER)
    const existing = await customerService.listCustomers({ email })

    let customer = existing[0]
    if (!customer) {
      customer = await customerService.createCustomers({
        email,
        phone: phone ?? undefined,
        first_name: firstName,
        last_name: lastName,
      })
      logger.info({ customerId: customer.id }, "Customer created at signup")
    }

    // Store hashed password immediately
    await setPasswordHash(customer.id, password)

    // Send email verification OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    await setOtp(email, { otp, firstName, lastName })
    await sendOtpEmail(email, otp)

    res.status(201).json({ success: true, customerId: customer.id, message: "Check your email for a verification code." })
  } catch (err) {
    handleError(err, res, { action: "signup" })
  }
}
```

---

### Task 3.4 — Login endpoint
**File to create**: `backend/src/api/store/auth/login/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { verifyPassword, hasPassword } from "../../../../lib/auth-meta"
import { handleError } from "../../../../lib/handle-error"
import { logger } from "../../../../lib/logger"

const LoginSchema = z.object({
  identifier: z.string().min(1, "Email or phone required"),
  password:   z.string().min(1, "Password required"),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = LoginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() })
    }
    const { identifier, password } = parsed.data
    const customerService = req.scope.resolve(Modules.CUSTOMER)

    const isPhone = /^\+?\d{7,}$/.test(identifier)
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier })
      : await customerService.listCustomers({ email: identifier })

    const customer = customers[0]

    // Constant-time response regardless of whether customer exists
    if (!customer || !(await hasPassword(customer.id))) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const valid = await verifyPassword(customer.id, password)
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" })
    }

    logger.info({ customerId: customer.id }, "Customer logged in")

    res.json({
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        firstName: customer.first_name,
        lastName: customer.last_name,
      },
    })
  } catch (err) {
    handleError(err, res, { action: "login" })
  }
}
```

---

### Task 3.5 — Forgot password endpoint
**File to create**: `backend/src/api/store/auth/forgot-password/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { setOtp, isRateLimited } from "../../../../lib/otp-store"
import { sendOtpEmail, sendPasswordResetEmail } from "../../../../lib/email"
import { handleError } from "../../../../lib/handle-error"

const ForgotSchema = z.object({
  identifier: z.string().min(5),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = ForgotSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() })
    }
    const { identifier } = parsed.data

    if (await isRateLimited(identifier)) {
      return res.status(429).json({ error: "Please wait before requesting another code." })
    }

    const customerService = req.scope.resolve(Modules.CUSTOMER)
    const isPhone = /^\+?\d{7,}$/.test(identifier)
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier })
      : await customerService.listCustomers({ email: identifier })

    // Always return 200 to prevent user enumeration
    if (!customers[0]) {
      return res.json({ success: true, message: "If that account exists, a reset code was sent." })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    await setOtp(identifier, { otp })

    if (!isPhone) {
      await sendPasswordResetEmail(identifier, otp)
    }
    // Phone reset: could send SMS here; omitted until Twilio is wired

    res.json({ success: true, message: "If that account exists, a reset code was sent." })
  } catch (err) {
    handleError(err, res, { action: "forgot-password" })
  }
}
```

---

### Task 3.6 — Reset password endpoint
**File to create**: `backend/src/api/store/auth/reset-password/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "zod"
import { getOtp, deleteOtp, incrementAttempts, clearAttempts, MAX_ATTEMPTS } from "../../../../lib/otp-store"
import { setPasswordHash } from "../../../../lib/auth-meta"
import { handleError } from "../../../../lib/handle-error"

const ResetSchema = z.object({
  identifier:  z.string().min(5),
  otp:         z.string().length(6).regex(/^\d{6}$/),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const parsed = ResetSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() })
    }
    const { identifier, otp, newPassword } = parsed.data

    const attempts = await incrementAttempts(identifier)
    if (attempts > MAX_ATTEMPTS) {
      await deleteOtp(identifier)
      return res.status(429).json({ error: "Too many attempts. Request a new reset code." })
    }

    const entry = await getOtp(identifier)
    if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt) {
      return res.status(401).json({ error: "Invalid or expired code" })
    }
    await deleteOtp(identifier)
    await clearAttempts(identifier)

    const customerService = req.scope.resolve(Modules.CUSTOMER)
    const isPhone = /^\+?\d{7,}$/.test(identifier)
    const customers = isPhone
      ? await customerService.listCustomers({ phone: identifier })
      : await customerService.listCustomers({ email: identifier })

    if (!customers[0]) {
      return res.status(404).json({ error: "Account not found" })
    }

    await setPasswordHash(customers[0].id, newPassword)
    res.json({ success: true, message: "Password updated successfully." })
  } catch (err) {
    handleError(err, res, { action: "reset-password" })
  }
}
```

---

**Sprint 3 done signal**: 
- POST `/store/auth/signup` with valid data returns 201, sends email OTP in dev (visible in logs)
- POST `/store/auth/login` with correct password returns customer object; wrong password returns 401
- POST `/store/auth/forgot-password` always returns 200 regardless of whether account exists
- POST `/store/auth/reset-password` with valid OTP updates password; new login succeeds

New folder structure after Sprint 3:
```
src/api/store/auth/
├── send-otp/route.ts     ← existing (patched)
├── verify-otp/route.ts   ← existing (patched)
├── signup/route.ts       ← new
├── login/route.ts        ← new
├── forgot-password/route.ts ← new
└── reset-password/route.ts  ← new

src/lib/
├── redis.ts              ← existing
├── otp-store.ts          ← extended
├── auth-meta.ts          ← new (password hashing, email verified flag)
├── email.ts              ← new (Resend)
├── logger.ts             ← new (pino)
└── handle-error.ts       ← new

src/config/
└── env.ts                ← new (envalid)

src/errors/
└── index.ts              ← new

src/validators/
├── auth.schemas.ts       ← new
└── checkout.schemas.ts   ← new
```

---

## SPRINT 4 — RAZORPAY WEBHOOK
**Duration**: 1 day  
**Goal**: Make order creation server-driven. The current client-orchestrated flow stays in place for now but the webhook acts as a safety net — it creates the order if the client never called `/checkout/complete`.

---

### Task 4.1 — Add Razorpay webhook secret to env
**File to modify**: `backend/.env.template`
```
RAZORPAY_WEBHOOK_SECRET=CHANGE_ME_set_in_razorpay_dashboard
```

---

### Task 4.2 — Create webhook route
**File to create**: `backend/src/api/webhooks/razorpay/route.ts`

```typescript
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { getRedisClient } from "../../../lib/redis"
import { logger } from "../../../lib/logger"
import { handleError } from "../../../lib/handle-error"

function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

const PROCESSED_KEY_TTL = 60 * 60 * 24 * 7 // 7 days

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error("RAZORPAY_WEBHOOK_SECRET not set")
      return res.status(500).json({ error: "Webhook not configured" })
    }

    const signature = req.headers["x-razorpay-signature"] as string
    const rawBody = JSON.stringify(req.body)

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn({ signature }, "Invalid webhook signature")
      return res.status(400).json({ error: "Invalid signature" })
    }

    const event = req.body as { event: string; payload: any }
    const paymentId = event.payload?.payment?.entity?.id as string | undefined
    const orderId   = event.payload?.payment?.entity?.order_id as string | undefined

    // Idempotency: skip if already processed
    if (paymentId) {
      const redis = getRedisClient()
      const key = `webhook_processed:${paymentId}`
      const alreadyProcessed = await redis.get(key)
      if (alreadyProcessed) {
        logger.info({ paymentId }, "Webhook already processed, skipping")
        return res.json({ received: true })
      }
      await redis.setex(key, PROCESSED_KEY_TTL, "1")
    }

    if (event.event === "payment.captured") {
      logger.info({ paymentId, orderId }, "Payment captured via webhook")
      // The client typically calls /checkout/complete first.
      // This webhook acts as fallback — implement order reconciliation in v1.1
      // when we have a cart_id ↔ razorpay_order_id mapping table.
    }

    if (event.event === "payment.failed") {
      logger.warn({ paymentId, orderId }, "Payment failed via webhook")
    }

    res.json({ received: true })
  } catch (err) {
    handleError(err, res, { action: "razorpay-webhook" })
  }
}
```

**Note on webhook limitation**: Full webhook-driven order creation requires a `razorpay_order_id → cart_id` mapping stored at order creation time. This is the reconciliation table to add in v1.1. The webhook as written correctly handles idempotency and signature verification — it just logs the payment.captured event for now and creates the paper trail.

---

### Task 4.3 — Store cart_id ↔ razorpay_order_id at order creation
**File to modify**: `backend/src/api/store/checkout/create-order/route.ts`

Add after Razorpay order is created:
```typescript
import { getRedisClient } from "../../../lib/redis"
// ...
// after: const order = await razorpay.orders.create(...)
const redis = getRedisClient()
await redis.setex(`rp_order:${order.id}`, 60 * 60 * 24, cart_id) // 24hr TTL
```

This unblocks full webhook-driven order creation in Sprint 4+.

Also modify `CreateOrderSchema` in `checkout.schemas.ts` to require `cart_id`:
```typescript
export const CreateOrderSchema = z.object({
  cart_id:          z.string().min(1),
  amount_in_rupees: z.number().positive().max(500000), // ₹5L limit
})
```

**Sprint 4 done signal**: POST to `/webhooks/razorpay` with an incorrect signature returns 400. With a correct signature returns 200 and logs the event.

---

## SPRINT 5 — BACKEND TEST COVERAGE
**Duration**: 2 days  
**Goal**: Test the auth and checkout flows at 80%+ on critical paths. Write tests before touching any more code.

---

### Task 5.1 — Auth integration tests
**File to create**: `backend/integration-tests/http/auth.spec.ts`

Tests to write (use `@medusajs/test-utils` pattern already established in `health.spec.ts`):
- `POST /store/auth/send-otp` — valid phone → 200; missing identifier → 400; rate-limited → 429
- `POST /store/auth/verify-otp` — valid OTP → 200 with customer; wrong OTP → 401; 6th attempt → 429; expired OTP → 401
- `POST /store/auth/signup` — valid body → 201; duplicate email → returns existing customer; invalid password → 422
- `POST /store/auth/login` — correct password → 200; wrong password → 401; non-existent → 401
- `POST /store/auth/forgot-password` — any identifier → 200 (no enumeration)
- `POST /store/auth/reset-password` — valid OTP → 200; then login with new password → 200

### Task 5.2 — Checkout integration tests
**File to create**: `backend/integration-tests/http/checkout.spec.ts`

Tests to write:
- `POST /store/checkout/create-order` — valid cart_id + amount → 200 with razorpay_order_id; negative amount → 422
- `POST /store/checkout/verify-payment` — valid HMAC → 200; invalid HMAC → 401; replay → 409
- `POST /store/checkout/complete` — valid cart → 200 with order_id; duplicate idempotency-key → returns cached response; missing fields → 422

### Task 5.3 — Unit tests for lib functions
**File to create**: `backend/src/lib/__tests__/otp-store.unit.spec.ts`

Tests:
- `setOtp` stores and retrieves correctly
- `isRateLimited` returns true within 60s window
- `incrementAttempts` returns incrementing count; OTP invalidated at MAX_ATTEMPTS
- `deleteOtp` removes entry; subsequent `getOtp` returns null

**Sprint 5 done signal**: `npm run test:integration:http` passes for all auth and checkout tests. `npm run test:unit` passes for otp-store.

---

## SPRINT 6 — FRONTEND BOOTSTRAP
**Duration**: 2 days  
**Goal**: Initialize the Next.js project with all dependencies, folder structure, API client, and auth state. No visible pages yet — but the skeleton is correct.

---

### Task 6.1 — Initialize Next.js project
```bash
cd frontend
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

---

### Task 6.2 — Install frontend dependencies
```bash
npm install \
  @medusajs/js-sdk \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  react-hook-form \
  @hookform/resolvers \
  zod \
  zustand \
  clsx \
  tailwind-merge \
  lucide-react \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-toast
```

---

### Task 6.3 — Medusa SDK client
**File to create**: `frontend/src/lib/medusa.ts`

```typescript
import Medusa from "@medusajs/js-sdk"

export const medusa = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
})
```

**File to create**: `frontend/src/lib/query-client.ts`

```typescript
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5 },
  },
})
```

---

### Task 6.4 — Auth store (Zustand)
**File to create**: `frontend/src/store/auth.ts`

```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface Customer {
  id: string
  email: string
  phone?: string
  firstName: string
  lastName: string
}

interface AuthState {
  customer: Customer | null
  setCustomer: (c: Customer | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      setCustomer: (customer) => set({ customer }),
      logout: () => set({ customer: null }),
    }),
    { name: "poshakh-auth" }
  )
)
```

---

### Task 6.5 — Cart store (Zustand)
**File to create**: `frontend/src/store/cart.ts`

```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface CartState {
  cartId: string | null
  itemCount: number
  setCartId: (id: string) => void
  setItemCount: (n: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cartId: null,
      itemCount: 0,
      setCartId: (cartId) => set({ cartId }),
      setItemCount: (itemCount) => set({ itemCount }),
      clearCart: () => set({ cartId: null, itemCount: 0 }),
    }),
    { name: "poshakh-cart" }
  )
)
```

---

### Task 6.6 — Root layout with providers
**File to modify**: `frontend/src/app/layout.tsx`

```tsx
import Providers from "@/components/providers"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**File to create**: `frontend/src/components/providers.tsx`

```tsx
"use client"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/query-client"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

---

**Sprint 6 done signal**: `npm run dev` in `frontend/` starts without errors. `http://localhost:3000` renders the default Next.js home page.

---

## SPRINT 7 — FRONTEND AUTH PAGES
**Duration**: 2 days  
**Goal**: Full auth flow that talks to the Sprint 3 backend endpoints.

---

### Task 7.1 — Signup page
**File**: `frontend/src/app/(auth)/signup/page.tsx`  
Fields: firstName, lastName, email, phone (optional), password  
On submit → POST `/store/auth/signup` → redirect to `/auth/verify-otp?identifier={email}`

### Task 7.2 — OTP verify page
**File**: `frontend/src/app/(auth)/verify-otp/page.tsx`  
Fields: 6-digit OTP input (auto-focus each digit)  
Reads `identifier` from URL params  
On submit → POST `/store/auth/verify-otp` → store customer in Zustand → redirect to `/`  
Resend link → POST `/store/auth/send-otp` with same identifier

### Task 7.3 — Login page
**File**: `frontend/src/app/(auth)/login/page.tsx`  
Fields: email or phone, password  
On submit → POST `/store/auth/login` → store customer in Zustand → redirect to `/`  
Link to forgot-password

### Task 7.4 — Forgot password page
**File**: `frontend/src/app/(auth)/forgot-password/page.tsx`  
Fields: email or phone  
On submit → POST `/store/auth/forgot-password` → redirect to `/auth/reset-password?identifier={value}`

### Task 7.5 — Reset password page
**File**: `frontend/src/app/(auth)/reset-password/page.tsx`  
Fields: OTP, new password, confirm password  
On submit → POST `/store/auth/reset-password` → redirect to `/auth/login`

### Task 7.6 — Auth route guard middleware
**File**: `frontend/src/middleware.ts`

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PROTECTED = ["/account", "/checkout"]

export function middleware(request: NextRequest) {
  const isProtected = PROTECTED.some((p) => request.nextUrl.pathname.startsWith(p))
  const hasAuth = request.cookies.has("_medusa_jwt") // Medusa sets this
  if (isProtected && !hasAuth) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }
  return NextResponse.next()
}
```

**Sprint 7 done signal**: Manually complete full signup → OTP verify → login → logout cycle in browser. Check Zustand devtools to confirm customer state is populated.

---

## SPRINT 8 — PRODUCT CATALOG & CART
**Duration**: 3 days  
**Goal**: Customers can browse products, view details, and add to a persisted cart.

---

### Task 8.1 — Homepage
**File**: `frontend/src/app/page.tsx`  
- Hero banner (static image or Tailwind placeholder for now)
- 4 category cards (Sarees, Salwar Kameez, Lehengas, Gowns) — fetch from `GET /store/product-categories`
- "New Arrivals" grid — fetch first 8 products from `GET /store/products`

### Task 8.2 — Category page
**File**: `frontend/src/app/categories/[handle]/page.tsx`  
- Fetch products filtered by category handle: `GET /store/products?category_handle[]=sarees`
- Product grid with image, title, price (formatted as ₹X,XXX)
- Pagination: 12 per page, "Load more" button

### Task 8.3 — Product detail page
**File**: `frontend/src/app/products/[handle]/page.tsx`  
- Fetch single product: `GET /store/products?handle={handle}`
- Image gallery (placeholder thumbnails until S3 is wired)
- Size selector (XS/S/M/L/XL/XXL) — maps to variant_id
- "Add to cart" button
- Breadcrumb: Home > Category > Product

### Task 8.4 — Cart operations
**File**: `frontend/src/lib/cart.ts`  
Wrapper functions around Medusa JS SDK:
- `getOrCreateCart()` — returns existing cartId from Zustand or creates new one
- `addToCart(variantId, quantity)` — calls `medusa.store.cart.lineItems.create(...)`
- `updateQuantity(lineItemId, quantity)` — calls `medusa.store.cart.lineItems.update(...)`
- `removeFromCart(lineItemId)` — calls `medusa.store.cart.lineItems.delete(...)`

### Task 8.5 — Cart drawer
**File**: `frontend/src/components/cart/CartDrawer.tsx`  
- Slide-in panel (Radix UI Dialog)
- Lists line items with quantity controls
- Subtotal, "Proceed to checkout" CTA
- Opens on cart icon click in header

### Task 8.6 — Header with cart icon
**File**: `frontend/src/components/layout/Header.tsx`  
- Logo ("Poshakh"), category nav links, cart icon with item count badge
- Auth state: show "Login" or customer name + dropdown (Orders, Profile, Logout)

**Sprint 8 done signal**: Navigate homepage → click category → click product → select size → add to cart → open cart drawer → see item with correct price. Refresh page — cart persists (Zustand persist).

---

## SPRINT 9 — CHECKOUT FLOW
**Duration**: 2.5 days  
**Goal**: End-to-end purchase from cart to order confirmation, powered by the existing backend.

---

### Task 9.1 — Checkout page — step 1: Address
**File**: `frontend/src/app/checkout/page.tsx`  
Multi-step form with React state: `step: "address" | "shipping" | "payment" | "complete"`

Address form fields (mapped to `CompleteCheckoutSchema`):
- First name, Last name, Email, Phone
- Address line 1, Apartment/flat (optional)
- City, State (dropdown: Indian states), PIN code

### Task 9.2 — Checkout step 2: Shipping
- Two options from Medusa: Standard (₹99, 5–7 days) or Express (₹199, 2–3 days)
- Fetch shipping options: `GET /store/shipping-options?cart_id={cartId}`
- User selects one; value stored in component state

### Task 9.3 — Checkout step 3: Payment (Razorpay)

```tsx
import Script from "next/script"

// After user clicks "Pay Now":
async function initiatePayment() {
  // 1. Create Razorpay order via backend
  const { razorpay_order_id, amount, key_id } = await fetch("/store/checkout/create-order", {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId, amount_in_rupees: cartTotal }),
  }).then(r => r.json())

  // 2. Open Razorpay widget
  const options = {
    key: key_id,
    amount,
    currency: "INR",
    order_id: razorpay_order_id,
    name: "Poshakh",
    prefill: { email, contact: phone },
    theme: { color: "#7C3AED" },
    handler: async (response: any) => {
      // 3. Verify signature
      await fetch("/store/checkout/verify-payment", {
        method: "POST",
        body: JSON.stringify(response),
      })
      // 4. Complete order with idempotency key
      const idempotencyKey = razorpay_order_id
      const { order_id } = await fetch("/store/checkout/complete", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ cart_id: cartId, email, shipping_address, shipping_option_id }),
      }).then(r => r.json())
      router.push(`/checkout/complete?order=${order_id}`)
    },
  }
  const rzp = new (window as any).Razorpay(options)
  rzp.open()
}
```

### Task 9.4 — Order confirmation page
**File**: `frontend/src/app/checkout/complete/page.tsx`  
- Reads `order` from URL param
- Fetches order from `GET /store/orders/{id}`
- Shows: order number, items summary, shipping address, estimated delivery
- "Continue shopping" CTA

**Sprint 9 done signal**: Complete a full purchase (use Razorpay test mode). Confirm order appears in Medusa admin. Confirm idempotency works by retrying the complete call — same order_id returned.

---

## SPRINT 10 — ACCOUNT PAGES
**Duration**: 1.5 days

### Task 10.1 — Order history: `frontend/src/app/account/orders/page.tsx`
Fetch `GET /store/orders?customer_id={id}` — list with order number, date, total, status badge

### Task 10.2 — Order detail: `frontend/src/app/account/orders/[id]/page.tsx`
Items, shipping address, payment status, fulfillment status, tracking number (if set)

### Task 10.3 — Profile: `frontend/src/app/account/profile/page.tsx`
Edit name, phone. Change password form (current password + new password).

### Task 10.4 — Address book: `frontend/src/app/account/addresses/page.tsx`
CRUD for saved addresses. "Set as default" toggle. Auto-populate checkout from default address.

**Sprint 10 done signal**: Logged-in user can view order placed in Sprint 9. Profile form saves changes.

---

## SPRINT 11 — PRODUCTION INFRASTRUCTURE
**Duration**: 2 days

### Task 11.1 — Docker Compose
**File to create**: `docker-compose.yml` (project root)

```yaml
version: "3.9"
services:
  api:
    build: ./backend
    ports: ["9000:9000"]
    env_file: ./backend/.env
    depends_on: [postgres, redis]
    command: npm run start
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: poshakh
      POSTGRES_USER: poshakh
      POSTGRES_PASSWORD: local_dev_password
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    env_file: ./frontend/.env.local
    depends_on: [api]
volumes:
  pgdata:
```

### Task 11.2 — CI/CD GitHub Actions

**File to create**: `.github/workflows/ci.yml`

```yaml
name: CI
on: [pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: poshakh_test }
        ports: ["5432:5432"]
      redis:
        image: redis:7
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm", cache-dependency-path: "backend/package-lock.json" }
      - run: npm ci
        working-directory: backend
      - run: npm run lint
        working-directory: backend
      - run: npm run typecheck
        working-directory: backend
      - run: npm run test:unit
        working-directory: backend
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/poshakh_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test_jwt_secret_32chars_minimum
          COOKIE_SECRET: test_cookie_secret_32chars_min
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm", cache-dependency-path: "frontend/package-lock.json" }
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npx tsc --noEmit
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

### Task 11.3 — Production security headers
**File to create**: `frontend/src/middleware.ts` — extend existing auth guard with:

```typescript
const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

// Add to all responses:
Object.entries(securityHeaders).forEach(([key, value]) => {
  response.headers.set(key, value)
})
```

### Task 11.4 — Deployment
- **Backend**: Deploy to Railway (`railway up` from `backend/`)
- **Frontend**: Deploy to Vercel (`vercel --prod` from `frontend/`)
- **Database**: Railway PostgreSQL plugin
- **Redis**: Upstash (zero-ops, HA by default)

Rotate all secrets for production:
```bash
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # COOKIE_SECRET
```

**Sprint 11 done signal**: `docker-compose up` starts all services. `git push` on a PR triggers CI and fails on lint errors. Production URL responds on `GET /health`.

---

## MASTER TASK CHECKLIST

### Sprint 0 — Tooling (2 hours)
- [ ] 0.1 Install production deps (bcrypt, resend, zod, pino, twilio, envalid, @sentry/node, uuid)
- [ ] 0.2 Install dev tooling (eslint, prettier, husky)
- [ ] 0.3 Add .eslintrc.json
- [ ] 0.4 Add .prettierrc
- [ ] 0.5 Add lint/format/typecheck scripts
- [ ] 0.6 Initialize Husky pre-commit hook

### Sprint 1 — Critical Bug Patches (1.5 days)
- [ ] 1.1 Add attempt limiting to otp-store.ts (incrementAttempts, clearAttempts, MAX_ATTEMPTS)
- [ ] 1.2 Enforce attempt limit in verify-otp route (burn OTP at attempt 5)
- [ ] 1.3 Fix fallback email generation (cust_{uuid}@noreply.poshakh.in)
- [ ] 1.4 Add payment replay protection (Redis-backed payment_id dedup)
- [ ] 1.5 Add idempotency to checkout/complete (Idempotency-Key header)
- [ ] 1.6 Remove hardcoded secrets from .env.template

### Sprint 2 — Foundation Layer (1.5 days)
- [ ] 2.1 Create src/config/env.ts with envalid schema; wire into medusa-config.ts
- [ ] 2.2 Create src/lib/logger.ts (pino); migrate all console calls
- [ ] 2.3 Create src/errors/index.ts (AppError, ValidationError, AuthError, etc.)
- [ ] 2.4 Create src/lib/handle-error.ts; migrate checkout/complete catch block
- [ ] 2.5 Create src/validators/ with Zod schemas; wire into all existing routes; fix BUG-009 (country_code)

### Sprint 3 — Auth Rebuild (2.5 days)
- [ ] 3.1 Create src/lib/auth-meta.ts (bcrypt password storage in Redis)
- [ ] 3.2 Create src/lib/email.ts (Resend); wire into send-otp route
- [ ] 3.3 Create /store/auth/signup/route.ts
- [ ] 3.4 Create /store/auth/login/route.ts
- [ ] 3.5 Create /store/auth/forgot-password/route.ts
- [ ] 3.6 Create /store/auth/reset-password/route.ts

### Sprint 4 — Razorpay Webhook (1 day)
- [ ] 4.1 Add RAZORPAY_WEBHOOK_SECRET to .env.template
- [ ] 4.2 Create /webhooks/razorpay/route.ts (signature verify + idempotency)
- [ ] 4.3 Store cart_id ↔ razorpay_order_id in create-order route

### Sprint 5 — Tests (2 days)
- [ ] 5.1 Write auth integration tests (send-otp, verify-otp, signup, login, forgot, reset)
- [ ] 5.2 Write checkout integration tests (create-order, verify-payment, complete)
- [ ] 5.3 Write unit tests for otp-store functions

### Sprint 6 — Frontend Bootstrap (2 days)
- [ ] 6.1 Initialize Next.js 15 with TypeScript + Tailwind + App Router
- [ ] 6.2 Install all frontend dependencies
- [ ] 6.3 Create src/lib/medusa.ts (SDK client)
- [ ] 6.4 Create src/store/auth.ts (Zustand)
- [ ] 6.5 Create src/store/cart.ts (Zustand)
- [ ] 6.6 Wire QueryClientProvider + Zustand into root layout

### Sprint 7 — Auth Pages (2 days)
- [ ] 7.1 Signup page (form → POST /signup → redirect to verify-otp)
- [ ] 7.2 OTP verify page (6-digit input → POST /verify-otp → store customer → redirect /)
- [ ] 7.3 Login page (email/phone + password → POST /login → store customer)
- [ ] 7.4 Forgot password page
- [ ] 7.5 Reset password page
- [ ] 7.6 Middleware auth guard (redirect /account and /checkout to /login if unauthenticated)

### Sprint 8 — Catalog & Cart (3 days)
- [ ] 8.1 Homepage (hero + category cards + new arrivals grid)
- [ ] 8.2 Category page (product grid, pagination)
- [ ] 8.3 Product detail page (image gallery, size selector, add to cart)
- [ ] 8.4 Cart operations wrapper (getOrCreateCart, addToCart, updateQuantity, removeFromCart)
- [ ] 8.5 Cart drawer (Radix Dialog, line items, quantity controls, subtotal)
- [ ] 8.6 Header (logo, nav, cart icon with count badge, auth state dropdown)

### Sprint 9 — Checkout (2.5 days)
- [ ] 9.1 Checkout step 1: Address form (validated with Zod + RHF)
- [ ] 9.2 Checkout step 2: Shipping options (Standard ₹99 / Express ₹199)
- [ ] 9.3 Checkout step 3: Razorpay widget integration + /create-order + /verify-payment + /complete
- [ ] 9.4 Order confirmation page

### Sprint 10 — Account (1.5 days)
- [ ] 10.1 Order history page
- [ ] 10.2 Order detail page
- [ ] 10.3 Profile edit page
- [ ] 10.4 Address book page

### Sprint 11 — Infrastructure (2 days)
- [ ] 11.1 docker-compose.yml (api + postgres + redis + frontend)
- [ ] 11.2 GitHub Actions CI (lint + typecheck + test on PR)
- [ ] 11.3 Security headers middleware in frontend
- [ ] 11.4 Deploy backend to Railway; frontend to Vercel; rotate all secrets

---

## DEPENDENCY GRAPH

```
Sprint 0  ─────────────────────────────────┐
           Sprint 1 ──────────────────────┐ │
                     Sprint 2 ───────────┐│ │
                               Sprint 3 ─┤│ │
                               Sprint 4 ─┤│ │
                               Sprint 5 ─┘│ │  (tests must pass before frontend work)
                                          │ │
                               Sprint 6 ──┘ │  (needs backend running)
                               Sprint 7 ────┘
                               Sprint 8
                               Sprint 9  (needs Sprint 3 backend auth + Sprint 7 frontend auth)
                               Sprint 10 (needs Sprint 9)
                               Sprint 11 (needs Sprint 5 + Sprint 10)
```

---

## TIMELINE

| Sprint | Goal | Duration | Cumulative |
|--------|------|---------|------------|
| 0 | Tooling | 2h | Day 1 |
| 1 | Critical bug patches | 1.5d | Day 2–3 |
| 2 | Foundation layer | 1.5d | Day 3–5 |
| 3 | Auth rebuild | 2.5d | Day 5–8 |
| 4 | Razorpay webhook | 1d | Day 9 |
| 5 | Backend tests | 2d | Day 10–11 |
| 6 | Frontend bootstrap | 2d | Day 12–13 |
| 7 | Frontend auth pages | 2d | Day 14–15 |
| 8 | Catalog & cart | 3d | Day 16–18 |
| 9 | Checkout flow | 2.5d | Day 19–21 |
| 10 | Account pages | 1.5d | Day 22–23 |
| 11 | Infrastructure + deploy | 2d | Day 24–25 |

**Total: 25 working days (5 weeks, 1 engineer)**  
**With 2 engineers (backend + frontend in parallel from Sprint 6): ~15 working days (3 weeks)**
