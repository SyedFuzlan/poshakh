# Coding Conventions

**Analysis Date:** 2026-04-22

## TypeScript Usage

**Strict mode:** Enabled via `frontend/tsconfig.json` — `"strict": true`, `"noEmit": true`.

**Target:** ES2017 with ESNext modules; bundler module resolution.

**Path aliases:** `@/*` maps to `frontend/src/*`. Use `@/` for all internal imports — never use relative `../../` paths across feature boundaries.

**`any` usage:** Actively suppressed — ESLint enforces TypeScript rules via `eslint-config-next/typescript`. Existing violations are silenced inline with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments and are concentrated in `frontend/src/lib/products.ts` where Medusa API responses are mapped. New code must avoid `any`; define proper interfaces instead.

**Type definitions location:**
- Shared domain types live in `frontend/src/types/index.ts`
- Local component/store types are defined inline in the same file where they are used (e.g., `Customer` interface inside `frontend/src/store/index.ts`)
- Named exports only — no `export default` for types

## Naming Patterns

**Files:**
- React components: PascalCase, `.tsx` extension (e.g., `CartDrawer.tsx`, `SessionProvider.tsx`)
- Lib/utility modules: camelCase, `.ts` extension (e.g., `cart.ts`, `auth.ts`, `products.ts`, `session.ts`)
- Next.js App Router files: lowercase conventional names (`route.ts`, `page.tsx`, `layout.tsx`)
- Store: `frontend/src/store/index.ts` — single file, no barrel pattern

**Functions:**
- Exported utility functions: camelCase verb phrases (e.g., `getProducts`, `addMedusaLineItem`, `verifyPhoneOTP`, `createSignedCookie`)
- Event handlers inside components: camelCase with `handle` prefix (e.g., `handleCheckout`, `handleRemove`, `handleQtyChange`)
- Zustand action names in store: camelCase verbs matching their operation (e.g., `addToCart`, `setCartOpen`, `setSessionReady`)

**Variables and constants:**
- Module-level constants: SCREAMING_SNAKE_CASE (e.g., `BACKEND`, `PK`, `CART_KEY`, `FREE_SHIPPING_THRESHOLD`)
- Local variables: camelCase
- Boolean flags: prefixed with `is` (e.g., `isHome`, `isScrolled`, `isCartOpen`)

**Interfaces/Types:**
- Interfaces: PascalCase noun phrases (e.g., `Product`, `CartItem`, `ShippingAddress`, `GlobalState`)
- Union types: PascalCase type alias (e.g., `Category`)

## Component Patterns

**Client/Server boundary:**
- All interactive components declare `"use client"` at the top of the file — no exceptions seen for components using hooks or browser APIs
- `frontend/src/components/SessionProvider.tsx` wraps session restoration logic with `"use client"`
- Page-level components in `frontend/src/app/` do not declare `"use client"` (server components by default)

**Component structure:**
```tsx
"use client";                        // if interactive
import { ... } from "react";
import Link from "next/link";
import { useStore } from "@/store";  // zustand store
import ComponentName from "./ComponentName";

// Module-level constants (not inside the component)
const NAV_LINKS = [...];

export default function ComponentName() {
  // 1. Store selectors
  const { stateValue, action } = useStore();
  // 2. Local state (useState)
  const [localState, setLocalState] = useState(false);
  // 3. Effects
  useEffect(() => { ... }, []);
  // 4. Derived values
  const derivedValue = ...;
  // 5. Handlers (handle* prefix)
  const handleAction = () => { ... };
  // 6. Early return for null/hidden states
  if (!isOpen) return null;
  // 7. JSX
  return (...);
}
```

**Exports:** All components use `export default function ComponentName()`. Named exports are used for lib functions and types.

**Props:** Typed inline with `: { children: React.ReactNode }` syntax — no separate `Props` type declarations seen for simple props.

**Conditional rendering:** Ternary for binary states, `&&` for optional renders (e.g., cart badge only when `cart.length > 0`).

## State Management Patterns

**Zustand (global state):**
- Single store at `frontend/src/store/index.ts` — all global state in one `useStore` hook
- Store interface `GlobalState` documents all state and actions
- Selectors: either destructure from `useStore()` call or use selector function `useStore((s) => s.fieldName)`
- Async side effects (e.g., `logout`) are defined directly inside the store as `async` functions calling `fetch`
- `localStorage` reads happen in store initialisation with an SSR guard: `typeof window !== "undefined" ? localStorage.getItem(...) : null`

**Local state:**
- `useState` is used for purely UI-local state (e.g., scroll position, mobile drawer open/closed)
- No TanStack Query is present — API data is fetched via `fetch` in lib functions and passed as props or stored in Zustand. This is a gap from the intended CLAUDE.md convention.

**No React Context** usage detected — Zustand replaces it entirely.

## API Call Patterns

**Frontend lib functions** (`frontend/src/lib/`):
- All external API calls are pure async functions returning typed values or throwing `Error`
- Pattern: `fetch` → check `.ok` or parse response → throw on error → return typed data
- Internal Next.js API routes are called via relative paths (`/api/otp/send`) from lib functions
- Medusa Store API is called directly from `frontend/src/lib/cart.ts` and `frontend/src/lib/products.ts` using environment variables

```typescript
// Pattern from frontend/src/lib/auth.ts
export async function sendPhoneOTP(phone: string): Promise<void> {
  const res = await fetch("/api/otp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile: phone }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Failed to send OTP");
}
```

**Next.js Route Handlers** (`frontend/src/app/api/`):
- All route handlers are in `route.ts` files following App Router conventions
- Pattern: parse request → validate inputs → proxy to Medusa backend → return `NextResponse.json()`
- Consistent error response shape: `{ success: boolean, error?: string }`
- Top-level `try/catch` wraps the handler body; catch returns `{ success: false, error: String(e) }`

```typescript
// Pattern from frontend/src/app/api/otp/send/route.ts
export async function POST(req: NextRequest) {
  try {
    const { mobile } = await req.json();
    if (!mobile) return NextResponse.json({ success: false, error: "..." }, { status: 400 });
    // ... proxy to backend ...
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
```

**Environment variables:**
- `NEXT_PUBLIC_*` vars for client-side use; unprefixed vars for server-side only
- Always fallback with `?? "default"` for optional config; use `!` assertion with runtime guard for required secrets (e.g., `frontend/src/lib/session.ts` throws immediately if `MEDUSA_CUSTOMER_SECRET` is missing)

## Error Handling Patterns

**In lib functions:** Throw `Error` with descriptive message — callers are responsible for catching.

**In route handlers:** Top-level try/catch; all errors converted to `{ success: false, error: string }` JSON response.

**In components:** Fire-and-forget pattern for non-critical Medusa sync operations — errors are silently swallowed with `.catch(() => {})` (seen in `frontend/src/components/CartDrawer.tsx`). This is a known gap — no user-visible error feedback for failed Medusa sync.

**In server-side lib functions:** Try/catch with `console.error` logging and static fallback data returned (seen in `frontend/src/lib/products.ts`).

**No global error boundary** detected in `frontend/src/app/layout.tsx` — this is a gap.

## Import Organization

**Order (observed pattern):**
1. React and framework imports (`"use client"`, then `import { useState } from "react"`, `import Link from "next/link"`)
2. Internal store (`import { useStore } from "@/store"`)
3. Internal lib functions (`import { removeMedusaLineItem } from "@/lib/cart"`)
4. Internal components (relative — `import MobileDrawer from "./MobileDrawer"`)
5. Internal types (`import { Product } from "@/types"`)

No blank-line grouping enforced by linter — grouping is loose but consistent.

**Alias:** Always use `@/` for cross-directory imports. Relative paths are only used for sibling files in the same directory.

## Styling Conventions

**Framework:** Tailwind CSS v4 with PostCSS.

**Custom design tokens** (`poshakh-*` prefix): `poshakh-cream`, `poshakh-gold`, `poshakh-charcoal`, `poshakh-maroon` — used consistently across all components.

**Inline styles:** Used sparingly only for values not expressible as Tailwind utilities (e.g., `fontSize: "32px"`, `letterSpacing: "2px"`).

**Responsive approach:** Mobile-first; breakpoints applied with `lg:` prefix for desktop layout. `hidden lg:block` / `lg:hidden` pattern used for show/hide.

## Linting Configuration

**ESLint:** `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` via `frontend/eslint.config.mjs` (flat config format).

**No Prettier config detected** — formatting is not enforced by a formatter. This is a gap.

**Run lint:** `npm run lint` (calls `eslint` directly, no explicit path — scans project root).

## Backend Conventions (Medusa)

**Language:** TypeScript (compiled by SWC via `@swc/jest` for tests).

**Folder structure** (backend `src/`):
- `api/` — custom API routes (store and admin sub-folders)
- `modules/` — custom Medusa modules
- `workflows/` — Medusa workflow definitions
- `subscribers/` — event subscribers
- `scripts/` — seed and migration scripts
- `jobs/` — scheduled jobs
- `links/` — module link definitions
- `admin/` — custom admin UI extensions

**Medusa rule:** Never modify core `@medusajs/medusa` packages. All customisation goes through the plugin/module/subscriber pattern.

---

*Convention analysis: 2026-04-22*
