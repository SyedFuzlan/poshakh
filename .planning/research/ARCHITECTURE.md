# Architecture Patterns: Password + OTP Auth System

**Domain:** Phone-number-first authentication on Indian e-commerce platform
**Stack context:** Next.js 16 App Router + Medusa.js v2 + Redis + HMAC HttpOnly cookie
**Researched:** 2026-04-22
**Confidence:** HIGH (derived from official Medusa v2 architecture, Next.js App Router patterns, OWASP password hashing standards, and direct analysis of the existing codebase)

---

## Decision Summary (Answers to All Research Questions)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Where does password live? | Separate `poshakh_auth` table (linked to customer by phone) | Never pollute commerce records with auth credentials; clean separation |
| Where is password hashed? | Medusa backend route ONLY | BFF must never see plaintext passwords beyond transit; hashing is a backend concern |
| Signup flow order | Verify OTP first, then create customer | Avoids orphaned unverified customer records in Medusa |
| Migration for OTP-only customers | Password-null flag + forced reset on first login attempt | Non-breaking; existing sessions survive |
| Session format | Keep HMAC HttpOnly cookie | Pattern is sound; JWT adds complexity with no benefit in this stack |
| middleware.ts integration | Read `poshakh_token` cookie, verify HMAC in-process | No network hop; fast edge-compatible verification |
| Brute-force protection placement | Redis attempt counters on Medusa backend routes | Source of truth for rate limits; BFF cannot be the guard |

---

## Recommended Architecture

### System Boundary Map

```
Browser
  │
  │  HTTPS
  ▼
┌─────────────────────────────────────────────────┐
│  Next.js 16 (frontend/) — Port 3000             │
│                                                  │
│  middleware.ts ──── reads poshakh_token cookie   │
│       │             verifies HMAC in-process     │
│       │             redirects /account/* if no   │
│       │             valid session                │
│                                                  │
│  BFF API Routes (frontend/src/app/api/)          │
│  ├── POST /api/auth/signup        (new)          │
│  ├── POST /api/auth/verify-signup (new)          │
│  ├── POST /api/auth/login         (new)          │
│  ├── POST /api/auth/forgot-password (new)        │
│  ├── POST /api/auth/reset-password  (new)        │
│  ├── GET  /api/auth/me            (exists)       │
│  └── POST /api/auth/logout        (exists)       │
│                                                  │
│  Service Library (frontend/src/lib/)             │
│  └── auth.ts  — all BFF calls centralised here  │
└───────────────────┬─────────────────────────────┘
                    │  Internal HTTP (server-to-server)
                    │  Header: x-medusa-secret
                    ▼
┌─────────────────────────────────────────────────┐
│  Medusa.js v2 (backend/) — Port 9000            │
│                                                  │
│  Custom Store Routes (backend/src/api/store/)    │
│  ├── POST /store/auth/signup        (new)        │
│  ├── POST /store/auth/verify-signup (new)        │
│  ├── POST /store/auth/login         (new)        │
│  ├── POST /store/auth/forgot-password (new)      │
│  ├── POST /store/auth/reset-password  (new)      │
│  ├── POST /store/auth/send-otp      (exists — refactor) │
│  └── POST /store/auth/verify-otp   (exists — remove)    │
│                                                  │
│  Lib (backend/src/lib/)                          │
│  ├── redis.ts         (exists — keep)            │
│  ├── otp-store.ts     (exists — extend)          │
│  └── password.ts      (new — bcrypt wrapper)     │
│                                                  │
│  Medusa Customer Module (commerce record)        │
│  └── customer table: id, phone, email, name,     │
│      metadata → existing, no password here       │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL                                      │
│  ├── customer (Medusa-managed)                   │
│  │   columns: id, phone, email, first_name,      │
│  │   last_name, has_account, metadata            │
│  └── poshakh_auth  (NEW — raw SQL migration)     │
│      columns: id, phone, password_hash,          │
│      password_set, created_at, updated_at        │
│      (phone is UNIQUE, FK-equivalent to customer │
│      by phone — no FK across schema boundaries)  │
└─────────────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────────────┐
│  Redis                                           │
│  ├── otp:{phone}:{purpose}  — OTP value + TTL   │
│  │   purposes: "signup", "forgot_password"       │
│  ├── otp_rate:{phone}       — 60-sec rate limit  │
│  └── attempts:{phone}:{purpose} — brute-force    │
│      counter (5 attempts, 15-min window)         │
└─────────────────────────────────────────────────┘
```

---

## Component Definitions and Boundaries

### Component 1: `poshakh_auth` Table (PostgreSQL)

**Responsibility:** Store auth credentials only. Not a Medusa module — a raw table managed by a custom migration script.

**Why not extend the Medusa customer record:**
- Medusa's customer module does not support extending the core `customer` table with custom columns using the standard module extension pattern in v2 without a full custom module override. The reliable path is a separate table.
- Passwords and commerce data have different security requirements, retention policies, and access patterns. Mixing them couples auth to the commerce layer — a long-term maintainability trap.
- A separate table means the password hash is NEVER returned in any Medusa customer API response, even by mistake.

**Schema:**
```sql
CREATE TABLE poshakh_auth (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        VARCHAR(15) UNIQUE NOT NULL,
  password_hash VARCHAR(72),          -- bcrypt output is always 60 chars; 72 is safe headroom
  password_set BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_poshakh_auth_phone ON poshakh_auth (phone);
```

**Communicates with:** Backend route handlers only. Never exposed to BFF or browser.

**Migration file:** `backend/src/scripts/migrate-auth-table.ts` — run once via `medusa exec`.

---

### Component 2: `password.ts` (Backend Lib)

**Responsibility:** Bcrypt hashing and verification. Single module, no business logic.

**Location:** `backend/src/lib/password.ts`

**Why bcrypt (not argon2 or scrypt):**
- bcrypt is the industry default for web applications at this scale. Argon2 is superior but requires native binaries that can create deployment friction on Node.js without careful setup. bcrypt (`bcryptjs` pure-JS or `bcrypt` native) has zero deployment risk.
- Use cost factor 12 — ~250ms hash time on current hardware. Adequate against GPU attacks; not perceptibly slow for users.
- Use `bcryptjs` (pure JS) to avoid native binary build issues on host platforms (Vercel, Railway) — acceptable performance at this scale.

**Interface:**
```typescript
export async function hashPassword(plain: string): Promise<string>
export async function verifyPassword(plain: string, hash: string): Promise<boolean>
```

**Communicates with:** Backend auth route handlers only.

---

### Component 3: Extended `otp-store.ts` (Backend Lib)

**Responsibility:** OTP generation, storage, retrieval, expiry, rate limiting, and brute-force attempt counting. The existing module handles storage and rate limits; extend it with purpose-scoped keys and attempt counting.

**Key schema changes:**
- Existing key: `otp:{identifier}` → New: `otp:{purpose}:{phone}` (e.g., `otp:signup:+919876543210`)
- New key: `attempts:{purpose}:{phone}` → integer counter, 15-min TTL, max 5

**Why purpose-scoped keys:** A phone in the middle of a signup should not be able to use a forgot-password OTP for signup verification, and vice versa. Scoping prevents OTP reuse across flows.

**New interface additions:**
```typescript
export async function storeOtp(phone: string, purpose: OtpPurpose): Promise<string>
export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string): Promise<boolean>
export async function recordAttempt(phone: string, purpose: OtpPurpose): Promise<number>
export async function isAttemptLimitExceeded(phone: string, purpose: OtpPurpose): Promise<boolean>

type OtpPurpose = "signup" | "forgot_password"
```

**Communicates with:** Backend route handlers (`/store/auth/*`).

---

### Component 4: Medusa Backend Auth Routes (5 new + 2 modified)

**Location:** `backend/src/api/store/auth/`

**Boundary:** These routes own ALL auth business logic. The BFF routes are thin proxies — they do NOT perform business logic.

**Route responsibilities:**

| Route | Responsibility |
|-------|---------------|
| `POST /store/auth/signup` | Validate fields → check phone not already registered → store pending signup in Redis (not DB yet) → send SMS OTP via MSG91/Twilio → return `{ status: "otp_sent" }` |
| `POST /store/auth/verify-signup` | Check attempt limit → verify OTP from Redis → create `poshakh_auth` row → create Medusa customer → return customer object |
| `POST /store/auth/login` | Check attempt limit → look up `poshakh_auth` by phone → if `password_set: false` return `{ status: "no_password", action: "reset_required" }` → bcrypt verify → return customer object |
| `POST /store/auth/forgot-password` | Verify phone exists in `poshakh_auth` → send SMS OTP (purpose: forgot_password) → return `{ status: "otp_sent" }` |
| `POST /store/auth/reset-password` | Check attempt limit → verify OTP (purpose: forgot_password) → hash new password → update `poshakh_auth` → return `{ status: "ok" }` |

**All routes:**
- Read `x-medusa-secret` header → reject 401 if missing or wrong (same pattern as existing verify-otp route)
- Return structured `{ error: string, code: string }` on failure (not bare strings)
- Never return `password_hash` in any response shape
- Log all auth events with structured fields (phone truncated to last 4 digits in logs)

---

### Component 5: BFF Auth Routes (Next.js API Routes)

**Location:** `frontend/src/app/api/auth/`

**Boundary:** The BFF does ONLY three things:
1. Validate that required fields are present (surface-level, not business logic)
2. Forward to Medusa backend with `x-medusa-secret` header
3. On login/verify-signup success: sign customer into HMAC cookie and return sanitised customer to browser

**The BFF must NOT:**
- Hash passwords (hashing happens on Medusa backend)
- Read the `poshakh_auth` table directly
- Perform OTP verification logic
- Hold any auth state between requests

**Cookie management** (only these two BFF routes touch the cookie):
- `POST /api/auth/verify-signup` — receives customer from Medusa, calls `signSession(customer)`, sets `poshakh_token`
- `POST /api/auth/login` — same pattern
- `POST /api/auth/logout` — clears `poshakh_token`

**Existing routes to preserve unchanged:**
- `GET /api/auth/me` — reads and verifies existing cookie; no changes needed

---

### Component 6: `middleware.ts` (Next.js Route Protection)

**Location:** `frontend/src/middleware.ts` (project root of frontend, i.e., `frontend/middleware.ts`)

**Responsibility:** Intercept requests to protected routes. Read `poshakh_token` cookie. Verify HMAC in-process (no network call). Redirect to `/` if session is absent or invalid.

**Why HMAC verification in middleware is safe:**
- `middleware.ts` runs in the Next.js Edge Runtime. The `crypto` module used for HMAC-SHA256 in `session.ts` uses the Web Crypto API (`crypto.subtle`) which is available in Edge Runtime. IMPORTANT: the existing `session.ts` likely uses Node.js `crypto` module — this must be refactored to use `crypto.subtle` (Web Crypto) for middleware compatibility, OR the middleware must use `runtime: 'nodejs'` (which runs in the Node.js runtime, not Edge, and has slightly higher cold-start time but full Node.js API access).
- Recommended: set `export const runtime = 'nodejs'` in middleware — avoids refactoring session.ts and the performance difference is negligible for an app at this scale.

**Protected path matcher:**
```typescript
export const config = {
  matcher: ['/account/:path*', '/checkout/:path*', '/orders/:path*'],
}
```

**Logic:**
```
1. Read poshakh_token cookie
2. If absent → redirect to /?auth=required (not /login — phone drawer opens on home)
3. If present → verify HMAC
4. If invalid (tampered) → delete cookie → redirect to /?auth=required
5. If valid → allow request through; optionally forward decoded customer id as x-customer-id header to server components
```

**Communicates with:** `frontend/src/lib/session.ts` (in-process, no network).

---

### Component 7: Session Layer (Existing — Minimal Changes)

**Location:** `frontend/src/lib/session.ts`

**Current state:** HMAC-SHA256 signing and verification of a JSON payload stored as a HttpOnly cookie. This pattern is correct and should be kept.

**Why keep HMAC cookie over JWT:**
- JWTs require either a token store for revocation (negating statelessness) or accepting that a stolen token is valid until expiry. The HMAC cookie here is essentially a short-lived signed session — functionally equivalent to a JWT but without the complexity of the JWT spec, algorithm confusion attacks, or `alg: none` vulnerabilities.
- The existing `poshakh_token` cookie is already HttpOnly + (presumably) Secure + SameSite=Lax. Keeping this avoids any risk of breaking the existing checkout/session flow.
- Logout is instant — clear the cookie. With a stateless JWT there is no server-side revocation without a deny-list (which requires Redis anyway).

**Required addition to cookie payload:** Add `passwordSet: boolean` field so the BFF can surface the "you need to set a password" state without a round-trip.

**No other changes to session.ts.**

---

## Data Flow: All Auth Flows

### Flow 1: Signup (New User)

```
Browser → POST /api/auth/signup { name, phone, password, email? }
  BFF: validate fields present → forward to Medusa (x-medusa-secret header)
  Medusa /store/auth/signup:
    → check poshakh_auth: phone already exists? → 409 Conflict
    → check Medusa customer: phone already exists? → 409 Conflict
    → store pending signup in Redis: pending_signup:{phone} = { name, email, passwordHash }
      (hash password HERE on Medusa backend using bcrypt)
      (TTL: 10 minutes — signup window)
    → send SMS OTP (purpose: signup)
    → return { status: "otp_sent" }
  BFF: return { status: "otp_sent" } to browser (no cookie set yet)

Browser → POST /api/auth/verify-signup { phone, otp }
  BFF: forward to Medusa
  Medusa /store/auth/verify-signup:
    → isAttemptLimitExceeded(phone, "signup")? → 429
    → recordAttempt(phone, "signup")
    → verifyOtp(phone, "signup", otp)? → 400 if wrong
    → read pending_signup:{phone} from Redis
    → INSERT INTO poshakh_auth (phone, password_hash, password_set=true)
    → create Medusa customer (name, phone, email)
    → delete pending_signup:{phone} from Redis
    → return customer object
  BFF: receive customer → signSession(customer) → set poshakh_token cookie
  BFF: return sanitised customer to browser
  Zustand: setCustomer(customer)
```

**Why OTP verification BEFORE customer creation:**
- If OTP is wrong, no orphaned records exist in Medusa or `poshakh_auth`
- Avoids a scenario where a bot submits thousands of signup requests creating unverified customer records that pollute the Medusa database
- Pending signup state is cheap (Redis, 10-min TTL, auto-expires)
- If the user never verifies, nothing is left in the DB

**Tradeoff:** The password is hashed and stored in Redis (pending) before verification. This is acceptable — Redis is a trusted server-side store, not a client. The hash is what's stored, not the plaintext. The plaintext password leaves the browser once (over HTTPS) and is hashed on the Medusa backend before touching any storage.

---

### Flow 2: Login (Existing User)

```
Browser → POST /api/auth/login { phone, password }
  BFF: validate fields → forward to Medusa
  Medusa /store/auth/login:
    → isAttemptLimitExceeded(phone, "login")? → 429 with retry-after
    → look up poshakh_auth by phone → 404 if not found ("account not found")
    → if password_set = false → return { status: "no_password", action: "reset_required" }
    → recordAttempt(phone, "login")
    → bcrypt.compare(password, password_hash)
    → if fail → return 401 { error: "invalid_credentials" }  [generic — no hint which field]
    → if success → clear attempts counter from Redis
    → look up Medusa customer by phone
    → return customer object
  BFF: receive customer → signSession(customer) → set poshakh_token cookie
  BFF: return customer to browser

Note on `no_password` response:
  BFF receives status:"no_password" → does NOT set cookie
  BFF returns { status: "no_password" } to browser
  Browser: show "Set a password to continue" prompt → trigger forgot-password flow
```

---

### Flow 3: Forgot Password

```
Browser → POST /api/auth/forgot-password { phone }
  BFF: forward to Medusa
  Medusa /store/auth/forgot-password:
    → look up poshakh_auth by phone
    → if not found → return { status: "otp_sent" }  [intentional — no enumeration]
    → send SMS OTP (purpose: "forgot_password")
    → return { status: "otp_sent" }
  BFF: return { status: "otp_sent" }

Browser → POST /api/auth/reset-password { phone, otp, newPassword }
  BFF: forward to Medusa
  Medusa /store/auth/reset-password:
    → isAttemptLimitExceeded(phone, "forgot_password")? → 429
    → recordAttempt(phone, "forgot_password")
    → verifyOtp(phone, "forgot_password", otp) → 400 if wrong
    → hash newPassword with bcrypt (cost 12)
    → UPDATE poshakh_auth SET password_hash=..., password_set=true WHERE phone=...
    → clear attempts counter
    → return { status: "ok" }
  BFF: return { status: "ok" } — no cookie set (user must login after reset)
  Browser: redirect to login prompt
```

**Why no auto-login after reset:** Reduces CSRF risk. User proves identity again with the new password on login. One extra step; significantly simpler attack surface.

---

### Flow 4: Session Hydration (Unchanged)

The existing `GET /api/auth/me` → HMAC verify → Zustand `setCustomer()` flow is unchanged. No modifications required.

---

## Migration Path: OTP-Only Existing Customers

**Problem:** Existing customers have a Medusa customer record (phone, name) but no `poshakh_auth` row and no password.

**Approach: Lazy migration on first login attempt**

No batch migration needed. The new login endpoint handles the "no_password" case explicitly.

**Steps:**

1. When the new `poshakh_auth` table is created (migration), do NOT back-fill existing customers. Leave the table empty initially.

2. When an existing customer tries to log in via the new login form:
   - `poshakh_auth` lookup by phone → row not found
   - Return: `404` with `{ code: "account_not_found" }`
   - BFF interprets `account_not_found` → returns to browser: "No account found. Please sign up or reset your password."

3. Actually: a better UX is to detect "phone exists in Medusa but not in poshakh_auth" and trigger the "set password" flow:
   - Medusa `/store/auth/login` checks `poshakh_auth` → not found → checks Medusa customer by phone → found → return `{ status: "legacy_user", action: "set_password_required" }`
   - BFF returns this to browser
   - Browser: show "Welcome back. Set a password to continue." prompt
   - User sets a password → triggers forgot-password / reset-password flow (which creates the `poshakh_auth` row)

4. Existing sessions (`poshakh_token` cookies already in browsers) remain valid through the session hydration flow (`GET /api/auth/me`) — no disruption to logged-in users. They will only hit the new flow when their cookie expires (7 days) and they need to log in again.

5. For the "set password" path for legacy users, the `reset-password` endpoint must handle the case where `poshakh_auth` row does not exist: INSERT instead of UPDATE.

**What does NOT change:**
- Existing Medusa customer records — untouched
- Existing HMAC cookies — remain valid until expiry
- Cart/checkout flow — completely unaffected (cart is keyed to cart_id in localStorage, not to auth state)

---

## Brute-Force Protection: Placement and Rules

**Placement: Medusa backend routes — not BFF routes**

Reason: The BFF can be bypassed. Any client with knowledge of the Medusa backend URL and `MEDUSA_CUSTOMER_SECRET` (or no secret if the env var is missing) can hit Medusa directly. Rate limiting on the BFF only creates a false sense of security. The backend is the authoritative enforcement point.

**Redis key schema:**
```
attempts:login:{phone}         → INCR / EXPIRE 900 (15 min)
attempts:signup:{phone}        → INCR / EXPIRE 900
attempts:forgot_password:{phone} → INCR / EXPIRE 900
```

**Limits:**

| Endpoint | Max Attempts | Window | Action on Exceed |
|----------|-------------|--------|-----------------|
| `/store/auth/login` | 5 | 15 min | 429 + `Retry-After` header |
| `/store/auth/verify-signup` | 5 | 15 min | 429 |
| `/store/auth/reset-password` | 5 | 15 min | 429 |
| `/store/auth/signup` (OTP send) | 3 | 60 sec | 429 (existing rate limit in otp-store.ts) |
| `/store/auth/forgot-password` (OTP send) | 3 | 60 sec | 429 |

**Clear on success:** After a successful login or successful OTP verify, call `DEL attempts:{purpose}:{phone}` to reset the counter. This prevents a user who made 4 failed attempts and then succeeded from being locked out on the next partial-failure cycle.

**BFF-side addition:** The BFF should also apply a lightweight IP-based rate limit using a simple Redis counter (`attempts:ip:{ip}`) to catch distributed credential stuffing before it reaches Medusa. Limit: 20 requests per minute per IP across all auth endpoints. This is a secondary layer, not the primary.

---

## Security Checklist by Component

| Component | Risk | Mitigation |
|-----------|------|-----------|
| `poshakh_auth` table | Password hash exposed in logs | Never log hash; truncate phone in logs |
| Medusa auth routes | No `x-medusa-secret` guard | Add guard to ALL new routes (same as existing otp routes) |
| BFF signup route | Plaintext password logged | Ensure no `console.log(body)` pattern in BFF |
| OTP brute force | Attacker tries all 6-digit codes | Attempt counter + 15-min lockout on backend |
| Phone enumeration | Forgot-password reveals whether phone is registered | Return `{ status: "otp_sent" }` unconditionally |
| `DEV_TEST_OTP` bypass | Left active in production | Guard with `if (process.env.NODE_ENV !== "production")` — already flagged in PROJECT.md |
| Session cookie | Missing Secure flag in prod | Ensure `Secure` attribute set when `NODE_ENV === "production"` |
| middleware.ts Edge | Node.js `crypto` not available in Edge | Use `runtime: 'nodejs'` in middleware.ts |
| Password in pending signup Redis key | Redis dump exposes pending hashes | Hash before storing (never store plaintext, even in Redis) |

---

## Build Order Implications

The components have clear dependency ordering. Build bottom-up.

### Phase ordering rationale

**Stage 1 — Foundation (must be first):**
1. `poshakh_auth` table migration — everything depends on this existing
2. `password.ts` bcrypt lib — login and signup both depend on it
3. Extended `otp-store.ts` with purpose-scoped keys and attempt counting — all routes depend on it

**Stage 2 — Backend Routes (after Stage 1):**
4. `POST /store/auth/signup` + `POST /store/auth/verify-signup` — signup flow; also validates that the full OTP + DB creation pipeline works end-to-end
5. `POST /store/auth/login` — depends on `poshakh_auth` rows existing (created by signup routes)
6. `POST /store/auth/forgot-password` + `POST /store/auth/reset-password` — depends on login flow being understood; shares OTP infrastructure with signup

**Stage 3 — BFF Routes (after Stage 2):**
7. BFF `POST /api/auth/signup` + `POST /api/auth/verify-signup` — thin proxy; testable once backend routes exist
8. BFF `POST /api/auth/login` — same
9. BFF `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` — same

**Stage 4 — Frontend Protection (after Stage 3):**
10. `middleware.ts` — route protection; requires working session + BFF to be testable
11. `frontend/src/lib/auth.ts` updates — add new function signatures for all new flows
12. `AccountDrawer` / auth UI components — consumes lib/auth.ts functions

**Stage 5 — Migration Handling (after Stage 4):**
13. Legacy user detection in `/store/auth/login` — add `legacy_user` response path
14. Frontend UI for "set password" prompt for legacy users
15. Smoke-test existing cart/checkout with new auth: verify Razorpay flow unbroken

**Stage 6 — Hardening:**
16. IP-rate-limit middleware on BFF auth routes
17. `DEV_TEST_OTP` production guard
18. Structured auth event logging
19. `Secure` cookie flag enforcement

---

## What Does NOT Change

These components are explicitly out of scope for the auth rebuild and must not be touched:

- Razorpay checkout routes (`/store/checkout/*`) — completely independent of auth
- Cart library (`frontend/src/lib/cart.ts`) — keyed to `poshakh_cart_id` in localStorage
- Medusa customer `metadata` field usage (if any) — untouched
- Admin auth — Medusa built-in; not part of this system
- `GET /api/auth/me` — already correct; no changes
- `POST /api/auth/logout` — already correct; clears cookie

---

## Open Architecture Questions (Flag for Phase Research)

1. **MSG91 vs Twilio for SMS:** PROJECT.md flags MSG91 as unreliable (no delivery confirmation, no retry). Twilio Verify is the recommended replacement but has per-SMS cost. This decision must be made before the signup route is built — the SMS provider is wired into `/store/auth/signup`. Recommend: switch to Twilio Verify (free trial sufficient for dev). Flag as a phase-level decision.

2. **Email OTP delivery:** Resend SDK is not installed. AUTH-03 requires email OTP if email is provided at signup. The `pending_signup` Redis key should store email alongside other fields, and the `/store/auth/signup` route must send email OTP in parallel with SMS OTP if email is provided. Resend SDK installation is a prerequisite for this feature.

3. **`poshakh_auth` migration execution:** Medusa v2 does not auto-run raw SQL migrations. The `migrate-auth-table.ts` script must be run manually via `medusa exec` or integrated into a startup hook. The dev setup instructions must document this explicitly.

4. **`bcryptjs` vs `bcrypt` native:** `bcryptjs` (pure JS) is recommended for zero build friction. If the production platform (Railway, etc.) supports native modules reliably, switching to `bcrypt` gives ~3x speed improvement on cost factor 12 (~80ms vs ~250ms). Not critical at this scale but worth noting for the future.

---

*Architecture analysis complete: 2026-04-22*
