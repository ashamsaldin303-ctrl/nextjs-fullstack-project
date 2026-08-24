# Full-Stack Development Master Guide
### The Definitive Reference for Building Production-Ready Websites

> **Stack versions targeted**: Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) ·
> Tailwind CSS 4 · Prisma 6 · next-intl 4 · Node 20+. **Last reviewed**: 2026-08 — always
> verify version-specific rules against your lockfile; guides drift faster than codebases.

> **Purpose**: This file is a complete, self-contained knowledge base for any full-stack
> development agent. It distills every lesson learned from a deep, multi-round audit of a
> real multi-tenant rental platform (Next.js 16 + Prisma + next-intl). Every pitfall here was
> encountered and fixed in production code. Follow this guide and you will avoid the entire
> class of bugs that consume 80% of debugging time.
>
> **How to use**: Read top-to-bottom on first encounter. Thereafter, jump to the relevant
> section via the table of contents. The "Common Pitfalls" catalog (Part 9) is the single
> most valuable section — it maps concrete symptoms to root causes and exact fixes.
> The companion **Assistant Agent manual** (Arabic) covers operations, monitoring, and
> incident response — the two guides share one source of truth for colors, auth policy,
> and deployment rules.

---

## Table of Contents

1. [Architecture & Project Structure](#1-architecture--project-structure)
2. [Security Hardening](#2-security-hardening)
3. [Database & Prisma Patterns](#3-database--prisma-patterns)
4. [TypeScript & Code Quality](#4-typescript--code-quality)
5. [Internationalization (i18n)](#5-internationalization-i18n)
6. [Business Logic: Booking, Cart, Checkout, Payment](#6-business-logic-booking-cart-checkout-payment)
7. [Accessibility (a11y) & UX](#7-accessibility-a11y--ux)
8. [Performance & SEO](#8-performance--seo)
9. [Common Pitfalls Catalog](#9-common-pitfalls-catalog)
10. [The Loops Audit Methodology](#10-the-loops-audit-methodology)
11. [Final Pre-Deployment Checklist](#11-final-pre-deployment-checklist)

---

## 1. Architecture & Project Structure

### 1.1 Tech Stack (Battle-Tested Defaults)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Server Components, RSC streaming, standalone output |
| Language | TypeScript 5 (strict) | Catches ~70% of bugs at compile time |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, no CSS-in-JS runtime |
| Database | Prisma 6 + SQLite (dev) / PostgreSQL (prod) | Type-safe queries, migrations |
| Auth | NextAuth.js v4 or custom HMAC sessions | Edge-compatible, HttpOnly cookies |
| i18n | next-intl 4 | AR/EN, RTL/LTR, ICU message format |
| State | Zustand (client) + TanStack Query (server) | Minimal boilerplate |
| 3D/Heavy | Three.js via `dynamic(() => import(...), { ssr: false })` | Never ship to SSR |

### 1.2 Directory Structure

```
src/
├── app/
│   ├── [locale]/              # i18n route group
│   │   ├── layout.tsx          # Root locale layout (providers, navbar, footer)
│   │   ├── page.tsx            # Home
│   │   ├── (shop)/             # Public storefront route group
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   └── (dashboard)/    # Auth-protected route group
│   │   │       ├── layout.tsx   # ← requireAuth() guard lives HERE
│   │   │       └── page.tsx     # Dashboard
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   └── not-found.tsx
│   ├── global-error.tsx        # ← MUST be at src/app/global-error.tsx (root)
│   ├── sitemap.ts
│   ├── robots.ts
│   ├── icon.tsx
│   └── layout.tsx              # Root layout (<html>, <body>)
├── components/
│   ├── ui/                    # shadcn/ui primitives (don't duplicate)
│   ├── layout/                # navbar, footer
│   ├── providers/             # cart-provider, theme-provider, brand-theme-setter
│   └── [feature]/             # product, cart, checkout, admin, etc.
├── lib/
│   ├── db.ts                  # Prisma client singleton
│   ├── auth.ts                # requireAuth(), session helpers
│   ├── brand.ts               # resolveBrandFromPath(), getProductsBasePath()
│   └── [domain].ts            # products.ts, cart.ts, rate-limiter.ts, etc.
├── i18n/
│   ├── routing.ts             # locale prefix config
│   └── request.ts             # next-intl request config
└── proxy.ts                   # ← Next.js 16: replaces middleware.ts
messages/
├── en.json
└── ar.json
prisma/
├── schema.prisma
├── seed.ts
└── db/app.db
```

### 1.3 Next.js 16 Specifics (Critical — These Changed)

#### `params` and `searchParams` are now Promises
In Next.js 16, every page that receives `params` or `searchParams` MUST await them. The old
synchronous signature silently breaks or causes type errors.

```tsx
// ✅ CORRECT (Next.js 16)
export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  // ...
}

// ❌ WRONG (Next.js 15 and earlier — will break)
export default function ProductPage({ params }: { params: { slug: string } }) {
  const { slug } = params
}
```

#### `proxy.ts` replaces `middleware.ts`
Next.js 16 renamed `middleware.ts` to `proxy.ts`. **Never** create `src/middleware.ts` — it
will conflict with `proxy.ts` and cause build failures. If you see a stale `middleware.ts`,
delete it and add it to `.gitignore`.

#### `cookies()` and `headers()` are now async
Since Next.js 15, `cookies()` and `headers()` (from `next/headers`) return Promises. You must
`await` them — calling `.get()` on the Promise directly is a type error and a runtime crash:

```ts
import { cookies } from 'next/headers'

// ✅ CORRECT
const store = await cookies()
const session = store.get('session')

// ❌ WRONG (Next.js 14 style — breaks on 15+)
const session = cookies().get('session')
```

Note: `store.set()` only works inside Server Actions and Route Handlers — never during a
page render.

#### `global-error.tsx` location
`global-error.tsx` is only honored at `src/app/global-error.tsx` (the root). Placing it
inside `[locale]/` makes it dead code. It must render its own `<html>` and `<body>`:

```tsx
'use client'
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
```

### 1.4 Route Group Pitfalls

Route groups `(name)` do NOT affect the URL. Two files at the same effective path cause a
build-time "two parallel pages that resolve to the same path" error:

```
src/app/[locale]/admin/page.tsx              → /admin
src/app/[locale]/admin/(dashboard)/page.tsx  → /admin   ← CONFLICT!
```

**Rule**: Only ONE page.tsx may resolve to any given URL. Use route groups for layout
grouping, not for alternate page content. If you need a "landing vs dashboard" split,
redirect from one to the other:

```tsx
// src/app/[locale]/admin/page.tsx
import { redirect } from 'next/navigation'
export default function AdminEntry() {
  redirect('/admin/dashboard')  // or to login if unauthenticated
}
```

### 1.5 Server vs Client Component Boundaries

Mark a component `'use client'` ONLY when it needs:
- `useState`, `useEffect`, `useReducer`, context
- Event handlers (`onClick`, etc.)
- Browser APIs (`window`, `localStorage`, `navigator`)
- `usePathname`, `useRouter`, `useSearchParams`

**Anti-pattern**: A `'use client'` component that imports `@/lib/db` or `fs`. This bloats
the client bundle and leaks server code. Instead, fetch data in a server component and pass
it as serializable props to a client child.

**Anti-pattern**: A server component using hooks. It will crash at runtime.

**Heavy library rule**: Three.js, Chart.js, and any library >50KB should be dynamically
imported with `{ ssr: false }` when used in client components:

```tsx
const Heavy3D = dynamic(() => import('./heavy-3d'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-background" />, // ← NEVER null
})
```

### 1.6 Hydration Safety

Anything that differs between server and client renders causes a hydration mismatch
warning (or crash). The classic traps:

| Trap | Fix |
|------|-----|
| `Date.now()`, `Math.random()` in render | Move to `useEffect` |
| `typeof window !== 'undefined'` checks | Use `useEffect` + state instead |
| `localStorage` / `sessionStorage` in render | Gate with `useEffect` + `mounted` state |
| Timezone-dependent date formatting | Format on the client only, after mount |
| `window.matchMedia('(prefers-reduced-motion)')` in render | Use a `mounted` flag |

```tsx
// ✅ Safe hydration guard pattern
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return <Skeleton />  // server + first paint
return <RealContent />              // client only
```

### 1.7 Layout Hierarchy & Sticky Footer

The root locale layout MUST establish the sticky-footer pattern so short pages push the
footer to the viewport bottom and long pages push it down naturally:

```tsx
// src/app/[locale]/layout.tsx
<body className="min-h-screen flex flex-col">
  <Navbar />
  <main className="flex-1">{children}</main>
  <Footer className="mt-auto" />
</body>
```

- `min-h-screen flex flex-col` on the body makes it at least viewport-height and a flex column.
- `flex-1` on `<main>` grows to fill available space.
- `mt-auto` on `<footer>` pushes it to the bottom when content is short.
- For iOS safe area: add `pb-[env(safe-area-inset-bottom)]` to the footer.

### 1.8 Loading, Error, and Not-Found Files

Every route segment that does async work should have:
- `loading.tsx` — skeleton or spinner with `role="status"` + `aria-live="polite"` + `sr-only` text
- `error.tsx` — user-friendly message + retry button (never show stack traces)
- `not-found.tsx` — for 404s specific to this segment

```tsx
// loading.tsx
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center py-20">
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
```

```tsx
// not-found.tsx (server component — use getTranslations, NOT useTranslations)
import { getTranslations } from 'next-intl/server'
export default async function NotFound() {
  const t = await getTranslations()
  return <h1>{t('notFound.title')}</h1>
}
```

> **Critical pitfall**: `not-found.tsx` renders when `notFound()` is called, which can happen
> BEFORE the i18n provider is mounted (e.g., invalid locale). Using `useTranslations()` (a
> client hook) in a server `not-found.tsx` will throw. Always use `getTranslations()` (the
> server-side async version).

---

## 2. Security Hardening

### 2.1 Authentication Architecture

Use a **two-layer defense-in-depth** model:

1. **Edge layer** (`src/proxy.ts`): HMAC-verified session cookie check. Runs before SSR.
   Redirects unauthenticated users to `/login` for admin routes.
2. **Server layer** (`requireAuth()` in every server action / admin page): Re-verifies the
   session in Node. This catches any edge-layer bypass and is your real source of truth.

```ts
// src/lib/auth.ts
import { cookies } from 'next/headers'

export async function requireAuth() {
  const store = await cookies()          // cookies() is async since Next.js 15
  const session = store.get('session')
  if (!session) throw new Error('UNAUTHORIZED')
  const payload = await verifySession(session.value)  // HMAC verify
  if (!payload) throw new Error('INVALID_SESSION')
  return payload  // { userId, role, brand, ... }
}
```

**Rule**: Every admin server action MUST call `requireAuth()` as its first statement. No
exceptions. Do not rely on "the layout checks it" — defense in depth.

### 2.2 Input Validation

Validate EVERY API input before it reaches Prisma. Use Zod:

```ts
import { z } from 'zod'

const CreateOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().max(100),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  })).min(1).max(50),
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().min(5).max(20),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', details: parsed.error.flatten() }, { status: 400 })
  }
  // Use parsed.data — it's now type-safe and validated
}
```

### 2.3 SQL/NoSQL Injection

Prisma's query builder is parameterized by default — safe from injection. The danger zones:

- `Prisma.raw()` / `$queryRawUnsafe()` — NEVER interpolate user input.
- Dynamic `orderBy` from user input — validate against an allow-list.
- Dynamic field names in `select`/`where` — validate against an allow-list.

```ts
// ❌ DANGEROUS
const orderBy = req.nextUrl.searchParams.get('sort')!
const products = await db.product.findMany({ orderBy: { [orderBy]: 'asc' } })

// ✅ SAFE
const ALLOWED_SORTS = ['name', 'price', 'createdAt'] as const
const sort = ALLOWED_SORTS.find(s => s === req.nextUrl.searchParams.get('sort')) ?? 'createdAt'
const products = await db.product.findMany({ orderBy: { [sort]: 'asc' } })
```

### 2.4 Webhook Security

Webhooks (payment callbacks, etc.) are a prime attack surface. Three layers of defense:

1. **HMAC signature verification** — verify the request actually came from the claimed sender.
2. **Timestamp skew check** — reject requests older than 5 minutes (replay protection).
3. **Nonce / idempotency key** — store the nonce in a DB table inside the transaction; reject
   duplicates.

```ts
// Webhook verification
const signature = req.headers.get('x-webhook-signature')  // hmac(rawBody + timestamp + nonce)
const timestamp = req.headers.get('x-webhook-timestamp')
const nonce = req.headers.get('x-webhook-nonce')

// 1. Skew check (replay protection)
const skew = Math.abs(Date.now() - Number(timestamp))
if (skew > 5 * 60 * 1000) return NextResponse.json({ error: 'stale' }, { status: 401 })

// 2. HMAC verify (constant-time comparison!)
// In a Node-runtime route handler, use node:crypto (NOT crypto.subtle — see note below):
import { createHmac, timingSafeEqual } from 'node:crypto'
const expected = createHmac('sha256', WEBHOOK_SECRET)
  .update(rawBody + timestamp + nonce)
  .digest('hex')
const sigBuf = Buffer.from(signature, 'hex')
const expBuf = Buffer.from(expected, 'hex')
if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
  return NextResponse.json({ error: 'invalid_sig' }, { status: 401 })
}

// 3. Nonce uniqueness (inside the Serializable transaction)
await db.$transaction(async (tx) => {
  await tx.idempotencyKey.create({ data: { key: nonce, expiresAt: new Date(Date.now() + 86400000) } })
  // ... process webhook ...
}, { isolationLevel: 'Serializable' })  // ← catches concurrent duplicate nonces
```

**Constant-time comparison**: Use `timingSafeEqual` from `node:crypto` on equal-length
Buffers. **There is no `crypto.subtle.timingSafeEqual`** — that API does not exist in Web
Crypto (a common AI-generated hallucination; it fails at runtime). On Edge runtime, use a
custom constant-time XOR comparison. Never `===` for secret comparison — it leaks
length/timing info.

### 2.5 Rate Limiting

Rate-limit ALL sensitive endpoints: login, contact form, checkout, password reset.

```ts
// src/lib/rate-limiter.ts
const RATE_LIMIT = { windowMs: 60_000, max: 10 }  // 10 req/min/IP

export async function rateLimit(ip: string, route: string) {
  const key = `${route}:${ip}`
  const entry = cache.get(key) ?? { count: 0, resetAt: Date.now() + RATE_LIMIT.windowMs }
  if (Date.now() > entry.resetAt) {
    entry.count = 0
    entry.resetAt = Date.now() + RATE_LIMIT.windowMs
  }
  entry.count++
  cache.set(key, entry)
  if (entry.count > RATE_LIMIT.max) {
    throw new RateLimitError(entry.resetAt)
  }
}
```

**IP extraction pitfall**: `X-Forwarded-For` can be spoofed. If behind a trusted proxy
(Caddy, Cloudflare), take the LAST IP in the chain or use the proxy-specific header
(`CF-Connecting-IP`, `X-Real-IP`). Never trust a client-supplied `X-Forwarded-For` directly.

**Multi-instance warning**: The in-memory `cache` above is per-process. On serverless or
multi-instance deployments, each instance keeps its own counter — the effective limit
multiplies by the instance count. Back the limiter with shared storage (Redis / Upstash:
atomic `INCR` + `EXPIRE`) whenever you scale beyond one instance.

### 2.6 Secrets Management

- ALL secrets live in `.env` (or environment variables in production). Never hardcoded.
- The `NEXT_PUBLIC_` prefix makes a var available in the client bundle. **Only** use it for
  truly public values (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`). Secrets like
  `DATABASE_URL`, `PAYMENT_SECRET`, `JWT_SECRET` must NEVER have the `NEXT_PUBLIC_` prefix.
- Validate secrets at startup — fail closed if missing or too short:

```ts
function getSecret(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  if (val.length < 32) throw new Error(`${name} must be at least 32 chars`)
  return val
}
```

### 2.7 IDOR (Insecure Direct Object Reference)

Any endpoint that takes an ID (`/api/orders/[id]`, `/api/bookings/[id]`) MUST verify the
requester owns that resource:

```ts
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const order = await db.order.findFirst({
    where: { id, userId: session.userId },  // ← scope to owner
  })
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
}
```

Admin endpoints should scope by brand, not by user — but still verify the admin has access
to that brand.

### 2.8 Cookie Security

Session cookies MUST have:
- `httpOnly: true` — prevents JavaScript access (XSS protection)
- `secure: true` — HTTPS only (in production)
- `sameSite: 'lax'` — CSRF protection (or `'strict'` for maximum security)
- `__Host-` prefix — binds the cookie to the host (no subdomain sharing)

```ts
// Must run inside a Server Action or Route Handler (set() is not allowed during renders)
const store = await cookies()  // async since Next.js 15
store.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24,  // 24h — keep admin sessions short (policy: 24h max)
})
```

### 2.9 Payment Integrity

NEVER trust a client-supplied price. The server recomputes everything inside a Serializable
transaction:

```ts
await db.$transaction(async (tx) => {
  // 1. Fetch the product (with a fresh read inside the tx)
  const product = await tx.product.findUniqueOrThrow({ where: { id } })
  
  // 2. Recompute days, totals
  const days = computeDays(startDate, endDate)
  const total = product.rentalPricePerDay * days * quantity
  
  // 3. Tolerance check (floating-point safety)
  if (Math.abs(total - clientSuppliedTotal) > 0.001) {
    throw new Error('PRICE_MISMATCH')
  }
  
  // 4. Create the booking
  await tx.booking.create({ data: { ... } })
}, { isolationLevel: 'Serializable' })
```

### 2.10 Dev-Only Endpoints

Mock/dev endpoints (test payment, debug routes) MUST be gated to non-production:

```ts
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  // ... dev-only logic ...
}
```

### 2.11 Information Disclosure

Error responses should NEVER leak:
- Stack traces (use a generic message in production, log full trace server-side)
- Internal file paths
- DB schema / table names
- Exact remaining stock counts (use generic "insufficient stock" messages)

```ts
// ❌ LEAKS INFO
return NextResponse.json({ error: `Requested ${qty} but only ${available} left` }, { status: 409 })

// ✅ SAFE
return NextResponse.json({ error: 'out_of_stock', message: 'Requested quantity exceeds available stock' }, { status: 409 })
```

### 2.12 Security Headers

Set baseline security headers centrally in `next.config.ts` — they then apply to every route
(including API), with zero per-page effort:

```ts
// next.config.ts
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" },
]

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
```

- Tighten the CSP progressively toward nonces/hashes. `'unsafe-inline'` on `script-src` is a
  last resort — acceptable at launch, not as the end state.
- Add HSTS only after confirming HTTPS is fully working on the production domain — it pins
  HTTPS permanently for returning visitors.
- Verify with securityheaders.com after every deployment; a missing header after a config
  rewrite is a classic silent regression.

---

## 3. Database & Prisma Patterns

### 3.1 Schema Design Principles

**Money**: Use `Decimal` (not `Float`) for monetary values. Float has ~15 significant digits
and accumulates rounding errors. If you MUST use Float (SQLite limitation), apply a
`KWD_TOLERANCE = 0.001` check in every aggregation.

```prisma
model Product {
  rentalPricePerDay Decimal @db.Decimal(10, 3)  // 3 decimal places for KWD
}
```

**Status fields**: Use enums, not strings:

```prisma
enum BookingStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
  PAYMENT_FAILED
}

model Booking {
  status BookingStatus @default(PENDING)
}
```

**Timestamps**: Always include `createdAt` and `updatedAt` with defaults:

```prisma
model Booking {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3.2 Indexes (Critical for Performance)

Add compound indexes for every common query filter. Missing indexes cause full table scans
that kill performance at scale.

```prisma
model Booking {
  brand      Brand       @default(LUT)
  status     BookingStatus @default(PENDING)
  productId  String?
  orderId    String?
  
  product    Product?    @relation(fields: [productId], references: [id], onDelete: SetNull)
  
  @@index([brand, status])           // admin dashboard filter
  @@index([productId, status])       // availability queries
  @@index([orderId])                // multi-item order grouping
  @@index([brand, isActive, createdAt])  // storefront "newest in brand" sort
}
```

**Rule of thumb**: For every `findMany({ where: { a, b } })`, there should be an
`@@index([a, b])`. Foreign keys are NOT automatically indexed in SQLite — add them explicitly.

### 3.3 Relations & onDelete

Always declare `onDelete` behavior explicitly:

| Setting | Use when |
|---------|----------|
| `Cascade` | Child can't exist without parent (e.g., OrderItem → Order) |
| `SetNull` | Child should survive parent deletion (e.g., Booking → Product; booking history stays) |
| `Restrict` | Prevent deletion if children exist (e.g., can't delete a Product with active bookings) |
| `NoAction` | Default — DB decides (usually same as Restrict) |

```prisma
model Booking {
  productId String?
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
}
```

The FK field must be nullable (`String?`) for `SetNull` to work.

### 3.4 Multi-Tenant Isolation

If your app has multiple tenants (brands, organizations), every tenant-scoped model MUST
have a `brand` (or `tenantId`) field. Every query MUST filter by it:

```ts
// ✅ Correct — always scope by brand
export async function getProducts({ brand, ... }: { brand: Brand }) {
  return db.product.findMany({ where: { brand, isActive: true } })
}
```

Admin queries use `getAdminBrand()` to determine which brand the admin is managing:

```ts
export async function adminGetProducts(adminSession: Session) {
  const brand = adminSession.brand  // from the session, not the URL
  return db.product.findMany({ where: { brand } })
}
```

**Pitfall**: A product lookup by ID alone (no brand filter) is acceptable IF the ID is a
unguessable cuid. But availability checks should still scope by brand for defense-in-depth.

### 3.5 Transactions & Concurrency

Multi-step writes MUST be in a transaction. Booking/stock operations need `Serializable`
isolation to prevent race conditions:

```ts
await db.$transaction(async (tx) => {
  // 1. Check availability (fresh read inside tx)
  const available = await checkStockAvailabilityInTx(tx, productId, startDate, endDate)
  if (available < quantity) throw new Error('OUT_OF_STOCK')
  
  // 2. Create booking (within the same tx — next check sees this)
  await tx.booking.create({ data: { ... } })
}, { isolationLevel: 'Serializable' })
```

**Critical**: The stock check and the booking create MUST be in the same transaction. If they
are in separate transactions (or sequential queries), two concurrent requests can both pass
the check and both create bookings → **overbooking**.

### 3.6 Booking Overlap Detection

The hardest part of any rental system. The overlap condition is:

```
A booking overlaps B if: A.start < B.end AND A.end > B.start
```

For same-day rentals (where `start === end`), you MUST extend the effective end date by 24h
on BOTH sides, or multi-day vs same-day comparisons break:

```ts
// ✅ Symmetric overlap detection
function overlaps(requestStart: Date, requestEnd: Date, storedStart: Date, storedEnd: Date): boolean {
  // Extend end dates to end-of-day for both request and stored
  const requestEffectiveEnd = endOfDay(requestEnd)
  const storedEffectiveEnd = endOfDay(storedEnd)
  
  return requestStart < storedEffectiveEnd && storedStart < requestEffectiveEnd
}

function endOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setUTCHours(23, 59, 59, 999)
  return copy
}
```

**The asymmetric bug — concrete example**: A customer tries to book a same-day rental on
Aug 5 (`start = end = Aug 5 00:00`). Another user already holds a multi-day booking
Aug 1–5, whose `end` is stored as `Aug 5 00:00` (NOT extended). The overlap check:
`request.start (Aug 5 00:00) < stored.effectiveEnd (Aug 5 00:00)` → **false** → no overlap
detected → double-booking on a day the existing booking actually owns. Extending BOTH
sides to end-of-day catches it: `Aug 5 00:00 < Aug 5 23:59.999` → true. The rule:
**always extend both sides** and use strict `<` — never extend only the request, never only
the stored booking, and never mix `<` with `<=` across the two comparisons.

### 3.7 PENDING Booking Expiry

If your system has a PENDING state (booking created, awaiting payment), PENDING bookings
lock stock indefinitely unless they expire. This is a DoS vector — an attacker can spam
PENDING bookings to exhaust all stock.

**Fix**: Filter out PENDING bookings older than a TTL (e.g., 30 minutes) in availability
queries:

```ts
const PENDING_BOOKING_TTL_MS = 30 * 60 * 1000

export async function checkStockAvailability(productId: string, start: Date, end: Date) {
  const activeBookings = await db.booking.findMany({
    where: {
      productId,
      OR: [
        { status: { in: ['CONFIRMED', 'COMPLETED'] } },
        { status: 'PENDING', createdAt: { gte: new Date(Date.now() - PENDING_BOOKING_TTL_MS) } },
      ],
      // overlap condition...
    },
  })
}
```

This is "lazy GC" — no cron job needed. Stale PENDING bookings are simply ignored.

### 3.8 Prisma Error Handling

Catch specific Prisma error codes and return user-friendly messages:

```ts
import { Prisma } from '@prisma/client'

try {
  await db.product.create({ data: { ... } })
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      // Unique constraint violation
      return { error: 'slug_exists' }
    }
    if (e.code === 'P2025') {
      // Record not found
      return { error: 'not_found' }
    }
    if (e.code === 'P2034') {
      // Transaction conflict (race condition)
      return { error: 'conflict_retry' }
    }
  }
  throw e  // re-throw unknown errors
}
```

**TOCTOU fix**: The `findFirst` duplicate-check + `create` pattern is not atomic. Even if
you pre-check, a concurrent request can create the same record between check and create.
The P2002 catch is the real safety net — always have it.

### 3.9 Multi-Item Orders

If a cart can have multiple items, ALL bookings created in one checkout MUST be grouped
under a shared `orderId`. Any status change (confirm, cancel) applies to ALL bookings in
the order:

```ts
// Generate one orderId per checkout
const orderId = `ORD-${Date.now()}-${randomSuffix}`

await db.$transaction(async (tx) => {
  for (const item of items) {
    await tx.booking.create({
      data: { ...item, orderId },  // ← shared orderId
    })
  }
})

// Payment webhook confirms ALL bookings in the order
await db.booking.updateMany({
  where: { orderId },
  data: { status: 'CONFIRMED' },
})
```

**Critical pitfall**: If you return `bookings[0].id` as the orderId and the webhook only
confirms that single booking, the other items stay PENDING forever (and silently release
stock after the TTL).

### 3.10 Soft Deletes vs Hard Deletes

Pick ONE pattern and apply it consistently:

| Pattern | When | Example |
|---------|------|---------|
| Soft delete (`isActive: boolean`) | When historical data matters (orders, bookings, products) | `where: { isActive: true }` on every read |
| Hard delete (`delete()`) | When data is truly disposable (drafts, temp tokens) | Categories if no order references them |

**Inconsistency warning**: If Product uses soft-delete but Category uses hard-delete, you'll
have orphaned products when a category is deleted. Either cascade-soft-delete or use
`onDelete: Restrict` to prevent deletion with active children.

### 3.11 Date Normalization

Dates from the client are timezone-dependent. A user in UTC+3 selecting "Aug 1" sends
`Aug 1 00:00 +03:00` = `Jul 31 21:00 UTC`. Two users in different timezones booking the
"same" calendar date produce non-overlapping UTC ranges → phantom availability or
double-booking.

**Fix**: Normalize all dates to midnight UTC server-side:

```ts
// Client sends YYYY-MM-DD; server normalizes
function normalizeToUTCMidnight(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`)
}
```

If the client sends full ISO timestamps, extract the date and re-normalize:

```ts
const dateOnly = new Date(clientDate).toISOString().split('T')[0]
const normalized = new Date(`${dateOnly}T00:00:00.000Z`)
```

### 3.12 DB Path Consistency (SQLite)

SQLite's `file:./path` is RELATIVE to the schema file location (`prisma/schema.prisma`).
`file:./db/app.db` from the schema resolves to `prisma/db/app.db`. But if you set
`DATABASE_URL=file:./prisma/db/app.db` in package.json scripts, Prisma resolves it relative
to the schema → `prisma/prisma/db/app.db` — a different file!

**Rule**: Use ONE consistent path everywhere:
- `.env`: `DATABASE_URL="file:./db/app.db"` (relative to schema)
- `package.json` scripts: `DATABASE_URL=file:./db/app.db` (same)
- Or use an ABSOLUTE path in `.env`: `DATABASE_URL="file:/abs/path/to/app.db"`

Verify with: `find . -name "*.db" -not -path "*/node_modules/*"` — there should be exactly ONE.

---

## 4. TypeScript & Code Quality

### 4.1 Strict Mode (Non-Negotiable)

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 4.2 The `any` Taxonomy

| Form | Severity | When OK |
|------|----------|---------|
| `: any` | Avoid | Never in production code |
| `as any` | Avoid | Never — fix the type instead |
| `unknown` | OK | When you genuinely don't know the shape (parse first) |
| `Record<string, unknown>` | OK | Generic JSON payloads |

Replace `any` with proper types. If you can't, use `unknown` and narrow:

```ts
// ❌
function parse(data: any) { return data.users.map((u: any) => u.name) }

// ✅
function parse(data: unknown): string[] {
  const obj = data as { users?: Array<{ name?: unknown }> }
  if (!obj.users || !Array.isArray(obj.users)) return []
  return obj.users.map(u => (typeof u.name === 'string' ? u.name : '')).filter(Boolean)
}
```

### 4.3 Non-Null Assertions (`!`)

`value!` tells TypeScript "trust me, this isn't null." It's a runtime crash waiting to
happen. Replace with explicit checks:

```ts
// ❌ Crash if canvas is null
const ctx = canvas.getContext('2d')!

// ✅ Safe
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('Canvas 2D context unavailable')
```

### 4.4 Error Handling

Never swallow errors silently. The empty catch `catch (e) {}` is a bug factory — when
something breaks, you'll have no idea why.

```ts
// ❌ Silent failure
try { await action() } catch (e) {}

// ❌ Logs but doesn't surface
try { await action() } catch (e) { console.error(e) }

// ✅ Log + handle
try {
  await action()
} catch (e) {
  console.error('[Context] action failed:', e)
  showToast('error', t('errors.generic'))
} finally {
  setSubmitting(false)  // ← ALWAYS reset loading state in finally
}
```

**Loading state rule**: If you set `setSubmitting(true)` before an await, you MUST reset it
in a `finally` block — not in the `try` (which skips on error) and not only in `catch`
(which leaves it stuck on success-with-no-throw paths).

### 4.5 React Anti-Patterns

| Anti-pattern | Fix |
|--------------|-----|
| Missing `key` in `.map()` | Use a stable ID (not array index) |
| `useEffect` with missing deps | Either add the dep or wrap in `useCallback`/`useMemo` |
| `useEffect` for derived state | Compute inline: `const total = price * qty` |
| `useState` for computed value | Use `useMemo` or just compute inline |
| `setInterval`/`setTimeout` without cleanup | Return a cleanup function from `useEffect` |
| Event listener without removal | `useEffect(() => { el.addEventListener(...); return () => el.removeEventListener(...) }, [])` |
| `useRef` for derived data | Use `useMemo` |
| Reading `window`/`document` in render | Move to `useEffect` |

### 4.6 Dynamic i18n Keys

When building i18n keys dynamically (e.g., `t(\`status.${booking.status}\`)`), you risk a
`MISSING_MESSAGE` error if the status value has no key. Always guard:

```ts
const statusKey = `admin.bookings.filterStatus.${booking.status}`
const statusLabel = t.has(statusKey) ? t(statusKey) : booking.status
```

### 4.7 Dead Code Prevention

- Exported but never imported → delete (verify with Grep first).
- Typed props that are silently ignored → remove from the interface AND all call sites.
- Commented-out code blocks → delete (use git history, not comments).
- Unused imports → ESLint catches these; run `bun run lint` regularly.

### 4.8 Brand-Aware Routing

In a multi-brand app, shared components (ProductCard, CartButton, Breadcrumbs) must build
URLs based on the active brand. Centralize this in ONE helper:

```ts
// src/lib/brand.ts
export function resolveBrandFromPath(pathname: string): 'lut' | 'lalounge' | 'birthday' {
  if (pathname.startsWith('/la-lounge')) return 'lalounge'
  if (pathname.startsWith('/your-birthday')) return 'birthday'
  return 'lut'
}

export function getProductsBasePath(brand: Brand): string {
  switch (brand) {
    case 'birthday': return '/your-birthday/products'
    case 'lalounge': return '/products'  // La Lounge shares the LUT storefront
    default: return '/products'
  }
}

export function getCartHref(brand: Brand): string {
  return brand === 'birthday' ? '/your-birthday/cart' : '/cart'
}
```

**Pitfall**: If `ProductCard` hardcodes `href={\`/products/${slug}\`}`, it 404s on the
Your Birthday storefront (where slugs live at `/your-birthday/products/[slug]`). Use the
helper everywhere.

### 4.9 Component Size Guidelines

- **Under 100 lines**: Ideal.
- **100–300 lines**: Acceptable if cohesive.
- **300–500 lines**: Refactor — extract sub-components.
- **Over 500 lines**: Code smell. Split immediately.

### 4.10 Brand Color Consistency

Declare brand colors ONCE in a constants file. Never hardcode hex values in components:

```ts
// src/lib/brand-colors.ts
export const BRAND_COLORS = {
  LUT: '#8B6B3D',
  LA_LOUNGE: '#E6007E',
  YOUR_BIRTHDAY: '#FFCC00',
} as const
```

If you find `#F5B914` (an old color) anywhere in components, it's a stale reference. Grep
for all hex values and consolidate. Components should use CSS variables (`bg-primary`,
`text-foreground`) set via `data-brand` on `<html>`, not hardcoded hexes.

### 4.11 Structured Logging

`console.log('booking done')` is unsearchable at scale. Log **events** as JSON with stable
fields (server-side only — never in client components):

```ts
console.info(JSON.stringify({
  level: 'info',
  event: 'booking.created',   // events, not sentences
  orderId,
  brand,
  correlationId,              // per-request UUID, attached to every log of that request
}))
```

- A `correlationId` generated per request lets you follow one request across proxy → route →
  webhook logs — this is what turns logs from noise into a timeline.
- Never log secrets, session tokens, or customer PII. Log **IDs**, not payloads.
- In production, pipe these into Sentry / Railway logs and alert on `level: 'error'` spikes
  (see the Assistant Agent manual, Ch. 11 for the monitoring cadence).

---

## 5. Internationalization (i18n)

### 5.1 Key Parity

EN and AR JSON files MUST have exactly the same keys. Any mismatch causes a `MISSING_MESSAGE`
error in one language. Verify with a diff script:

```js
// scripts/check-i18n-parity.js
const fs = require('fs')
function flat(o, p = '') {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flat(v, p + k + '.') : [p + k]
  )
}
const en = flat(JSON.parse(fs.readFileSync('messages/en.json', 'utf8'))).sort()
const ar = flat(JSON.parse(fs.readFileSync('messages/ar.json', 'utf8'))).sort()
const enOnly = en.filter(k => !ar.includes(k))
const arOnly = ar.filter(k => !en.includes(k))
if (enOnly.length || arOnly.length) {
  console.error('PARITY FAIL:', { enOnly, arOnly })
  process.exit(1)
}
console.log(`Parity OK: ${en.length} keys`)
```

Run this in CI. It catches missing translations immediately.

### 5.2 Snake_case vs camelCase

Pick ONE convention for i18n keys. Mixing them creates "orphaned duplicates":

```json
// ❌ Both exist — which does the code use?
{
  "errors": {
    "out_of_stock": "Out of stock",
    "outOfStock": "Out of stock"
  }
}
```

**Rule**: Use camelCase consistently (`outOfStock`, `invalidInput`). If you see snake_case
duplicates, verify they're not referenced (Grep), then delete them.

### 5.3 ICU Placeholders

Use ICU format for interpolation — it's consistent across locales:

```json
{
  "cart": {
    "itemCount": "{count, plural, =0 {Empty} =1 {1 item} other {# items}}",
    "welcome": "Welcome, {name}"
  }
}
```

```tsx
t('cart.itemCount', { count: items.length })
t('cart.welcome', { name: user.name })
```

**Pitfall**: Plural forms differ between languages. Arabic has 6 plural forms (zero, one,
two, few, many, other). next-intl handles this if you use the `plural` format — but verify
AR translations include all forms.

### 5.4 Server vs Client Translation Hooks

- `useTranslations()` — CLIENT hook only. Crashes in server components.
- `getTranslations()` — SERVER async function. Use in server components, layouts, pages.

```tsx
// ✅ Server component
export default async function Page() {
  const t = await getTranslations()
  return <h1>{t('home.title')}</h1>
}

// ✅ Client component
'use client'
export function Client() {
  const t = useTranslations()
  return <h1>{t('home.title')}</h1>
}
```

**Pitfall**: `not-found.tsx` and `error.tsx` may render before the i18n provider mounts
(e.g., invalid locale). Use `getTranslations()` (server) with a locale fallback, not
`useTranslations()` (client).

### 5.5 RTL Support

- Use logical properties (`ms-4` not `ml-4`, `ps-4` not `pl-4`, `start-0` not `left-0`).
- Tailwind 4 supports `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-` which flip automatically in RTL.
- Set `<html dir="rtl">` for Arabic (next-intl does this via the locale).
- Test EVERY page in RTL — icons, padding, flex direction all need verification.

### 5.6 Brand Name Consistency

Brand names must be spelled identically in both languages:

```json
// en.json
{ "brandSelector": { "lalounge": { "name": "La Lounge" } } }

// ar.json
{ "brandSelector": { "lalounge": { "name": "لا لاونج" } } }
```

Don't mix "La Lounge" and "LaLounge" and "la lounge" — pick one per language.

---

## 6. Business Logic: Booking, Cart, Checkout, Payment

### 6.1 The Complete Booking Flow

```
Cart (client)
  → Checkout page (client, validates cart)
    → POST /api/orders (server, Serializable tx)
      → Check availability per item (interleaved with create)
      → Create Booking per item (all under one orderId)
      → Return orderId to client
    → Redirect to /checkout/payment?order=ORD-...
      → Payment view fetches ALL bookings by orderId, sums total
      → User confirms
    → Payment webhook (server, HMAC verified)
      → Find ALL bookings by orderId
      → Validate state machine (all PENDING)
      → Update ALL to CONFIRMED (in transaction)
    → Redirect to /checkout/success
```

### 6.2 Stock Check + Create MUST Be Interleaved

The #1 overbooking bug: checking all items' availability FIRST, then creating all bookings.
Two items for the same product both pass the check, then both get created.

```ts
// ❌ OVERBOOKING BUG
for (const item of items) {
  const available = await checkAvailability(item)  // all checks first
  if (available < item.quantity) throw error
}
for (const item of items) {
  await tx.booking.create({ data: item })  // all creates after
}

// ✅ CORRECT — interleaved
for (const item of items) {
  const available = await checkStockAvailabilityInTx(tx, item.productId, item.startDate, item.endDate)
  if (available < item.quantity) throw new Error('OUT_OF_STOCK')
  await tx.booking.create({ data: { ...item, orderId } })  // next iteration sees this
}
```

The second item's check runs AFTER the first booking is created (within the same
Serializable transaction), so it sees the reduced stock.

### 6.3 Cart Validation at Checkout

The cart is client-side (localStorage). It can be stale — a product may have been
deactivated, had its price changed, or gone out of stock. Validate against the DB at
checkout:

```ts
// POST /api/orders
const products = await db.product.findMany({
  where: { id: { in: items.map(i => i.productId) }, isActive: true },
})
if (products.length !== items.length) {
  return NextResponse.json({ error: 'invalid_products' }, { status: 400 })
}
// Recompute price from DB (never trust client price)
```

### 6.4 Payment State Machine

Define valid status transitions and enforce them:

```ts
const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  CANCELLED: [],  // terminal
  COMPLETED: [],  // terminal
  PAYMENT_FAILED: ['CONFIRMED', 'CANCELLED'],  // retry allowed
}

function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
```

In the webhook, validate the transition BEFORE updating:

```ts
const booking = await tx.booking.findFirstOrThrow({ where: { id } })
if (!canTransition(booking.status, 'CONFIRMED')) {
  throw new Error(`Invalid transition: ${booking.status} → CONFIRMED`)
}
await tx.booking.update({ where: { id }, data: { status: 'CONFIRMED' } })
```

### 6.5 Webhook Idempotency

If the payment gateway retries the webhook (which they do), you must not double-process.
Use an `IdempotencyKey` table:

```prisma
model IdempotencyKey {
  key       String   @id
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([expiresAt])
}
```

```ts
await db.$transaction(async (tx) => {
  // This throws P2002 if the key already exists (duplicate webhook)
  await tx.idempotencyKey.create({
    data: { key: webhookNonce, expiresAt: new Date(Date.now() + 86400000) },
  })
  // ... process the webhook ...
}, { isolationLevel: 'Serializable' })
```

**GC note**: Add a periodic cleanup for expired keys, or filter by `expiresAt > now()` on
insert (lazy GC).

### 6.6 Multi-Brand Cart Isolation

If brands have separate storefronts, the cart should be brand-scoped. Either:
- Separate cart per brand (cart key includes brand: `lut-cart`, `birthday-cart`)
- Reject cross-brand items at add-to-cart

```ts
// Adding to cart
const currentBrand = resolveBrandFromPath(pathname)
const cart = getCart(currentBrand)
if (cart.items.length && cart.items[0].brand !== product.brand) {
  // Cross-brand — either reject or clear the cart first
  showToast('error', t('cart.crossBrand'))
  return
}
```

---

## 7. Accessibility (a11y) & UX

### 7.1 WCAG 2.1 AA Checklist

For EVERY interactive element:
- [ ] Semantic HTML (`<button>` not `<div onClick>`, `<a href>` not `<span onClick>`)
- [ ] Keyboard reachable (Tab key moves focus)
- [ ] Visible focus indicator (`focus-visible:ring-2`)
- [ ] 44px minimum touch target (mobile)
- [ ] `aria-label` on icon-only buttons (cart, search, close, menu)
- [ ] `alt` text on all images (empty `alt=""` for decorative)

For EVERY form:
- [ ] `<label>` associated with each input (or `aria-label`)
- [ ] Required fields marked (`aria-required` or visual `*`)
- [ ] Inline validation with `aria-invalid` and `aria-describedby`
- [ ] Error messages in `role="alert"` with red color (not brand color)

For EVERY dynamic content:
- [ ] Loading states: `role="status"` + `aria-live="polite"` + `sr-only` text
- [ ] Error toasts: `role="alert"` + `aria-live="assertive"`
- [ ] Modals: focus trap, `role="dialog"`, `aria-modal="true"`, ESC to close
- [ ] Success confirmations: move focus to the message, don't auto-close too fast

### 7.2 Color Contrast

WCAG AA requires:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+ or 14pt bold): 3:1
- UI components: 3:1

Avoid low-opacity text on dark backgrounds:
```tsx
// ❌ Fails AA (text-paper/30 = ~2:1)
<p className="text-paper/30">Crafted in Kuwait</p>

// ✅ Passes AA (text-paper/60 = ~5:1)
<p className="text-paper/60">Crafted in Kuwait</p>
```

### 7.3 Brand-Aware Links in Shared Components

Footer, navbar, breadcrumbs — all shared components must build links based on the active
brand. A footer that hardcodes `/products` breaks on the Your Birthday storefront.

```tsx
// ✅ Brand-aware footer links
function Footer() {
  const pathname = usePathname()
  const brand = resolveBrandFromPath(pathname)
  const productsHref = getProductsBasePath(brand)
  const contactHref = getContactHref(brand)
  
  return (
    <nav>
      <Link href={productsHref}>Products</Link>
      <Link href={contactHref}>Contact</Link>
    </nav>
  )
}
```

### 7.4 3D Background Fallbacks

3D WebGL backgrounds early-return on `prefers-reduced-motion: reduce`, no WebGL, or
low-end devices. Without a fallback, the page background is white and hero text (often
light-colored) becomes invisible.

**Fix**: Add a dark gradient fallback on the hero wrapper:

```css
/* globals.css */
.brand-hero-fallback {
  background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
}
[data-brand="lalounge"] .brand-hero-fallback {
  background: linear-gradient(135deg, #150912 0%, #0a0408 100%);
}
[data-brand="birthday"] .brand-hero-fallback {
  background: linear-gradient(135deg, #2a1f0a 0%, #150f05 100%);
}
```

```tsx
// The 3D canvas renders on top (z-0); the fallback shows when 3D is disabled
<div className="brand-hero-fallback min-h-screen">
  <Heavy3D />  {/* position: fixed; z-0; renders null if disabled */}
  <div className="relative z-10">{/* hero text */}</div>
</div>
```

Also add a `loading` fallback to the `dynamic()` import (not `null`):

```tsx
const Heavy3D = dynamic(() => import('./heavy-3d'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-background" />,
})
```

### 7.5 Focus Management on State Change

When a modal/dialog shows a success state, move focus to it. Screen reader users won't
know the state changed otherwise.

```tsx
const successRef = useRef<HTMLDivElement>(null)
const [success, setSuccess] = useState(false)

useEffect(() => {
  if (success && successRef.current) {
    successRef.current.focus()
  }
}, [success])

return (
  <div ref={successRef} role="status" aria-live="assertive" tabIndex={-1}>
    {success ? 'Booking confirmed!' : 'Processing...'}
  </div>
)
```

### 7.6 Hydration Flash Prevention

Values computed client-side (like `total.toFixed(3)`) flash `0.000` before hydration. Guard
them:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])

const displayTotal = mounted ? total.toFixed(3) : '—'
```

### 7.7 Sticky Footer

```tsx
<body className="min-h-screen flex flex-col">
  <Navbar />
  <main className="flex-1">{children}</main>
  <Footer className="mt-auto" />
</body>
```

On iOS, add safe-area padding to the footer: `pb-[env(safe-area-inset-bottom)]`.

---

## 8. Performance & SEO

### 8.1 Image Optimization

Always use `next/image` (not raw `<img>`). It optimizes format (WebP/AVIF), size, and lazy-
loads. Every image needs `alt` and either `width`/`height` or `fill` + `sizes`.

```tsx
import Image from 'next/image'

// ✅ Fixed dimensions
<Image src={img} alt={product.name} width={400} height={400} />

// ✅ Fill (needs sized parent + sizes)
<div className="relative aspect-square">
  <Image src={img} alt={name} fill sizes="(max-width: 768px) 100vw, 33vw" />
</div>
```

### 8.2 Font Optimization

Use `next/font` (not raw `<link>` to Google Fonts). It self-hosts, preloads, and avoids
render-blocking:

```tsx
import { Inter, Cairo } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const cairo = Cairo({ subsets: ['arabic'], variable: '--font-cairo' })

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${cairo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

For non-default fonts (e.g., a brand-specific font only used on some pages), set
`preload: false` to avoid preloading unused fonts.

### 8.3 Bundle Size

- Three.js, Chart.js, and any >50KB library: `dynamic(() => import(...), { ssr: false })`
- Don't import entire icon libraries: `import { Menu } from 'lucide-react'` (tree-shaken), not
  `import * as Icons from 'lucide-react'`.
- Check for `'use client'` components importing server-only modules.

### 8.4 Caching Strategy

- Static pages: `generateStaticParams` + `dynamicParams = false` (pre-rendered at build)
- ISR: `export const revalidate = 3600` (revalidate every hour)
- Dynamic data: `dynamic = 'force-dynamic'` or no cache directive
- Per-request: `fetch(url, { cache: 'no-store' })` or `fetch(url, { next: { revalidate: 60 } })`

### 8.5 generateStaticParams

Every dynamic route (`[slug]`, `[id]`) should export `generateStaticParams` to pre-render
known pages at build time:

```tsx
export async function generateStaticParams() {
  const products = await db.product.findMany({
    where: { isActive: true },
    select: { slug: true },
  })
  return products.map(p => ({ slug: p.slug }))
}

export const dynamicParams = false  // 404 for unknown slugs
```

### 8.6 Metadata

Every page should export `metadata` or `generateMetadata`. Use a centralized `buildMetadata`
helper:

```ts
// src/lib/seo.ts
export function buildMetadata({ locale, path, title, description }: MetadataInput): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    title,
    description,
    alternates: {
      canonical: `${baseUrl}/${locale}${path}`,
      languages: { en: `${baseUrl}/en${path}`, ar: `${baseUrl}/ar${path}` },
    },
    openGraph: { title, description, url: `${baseUrl}/${locale}${path}` },
  }
}
```

**Never hardcode the site URL** — always use `process.env.NEXT_PUBLIC_SITE_URL`. Hardcoded
URLs leak the wrong domain in preview/staging.

### 8.7 Sitemap

`src/app/sitemap.ts` should list ALL indexable URLs (200-OK only, no redirects):

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  // Static pages
  const staticEntries = [...].map(path => ({
    url: `${baseUrl}/en${path}`,
    alternates: { languages: { en: `${baseUrl}/en${path}`, ar: `${baseUrl}/ar${path}` } },
    priority: 0.8,
  }))
  
  // Dynamic product pages (ALL brands with storefronts)
  const products = await db.product.findMany({
    where: { isActive: true, brand: { in: ['LUT', 'YOUR_BIRTHDAY'] } },
    select: { slug: true, brand: true, updatedAt: true },
  })
  
  const productEntries = products.map(p => ({
    url: `${baseUrl}/en${p.brand === 'YOUR_BIRTHDAY' ? '/your-birthday' : ''}/products/${p.slug}`,
    lastModified: p.updatedAt,
    alternates: { languages: { en: '...', ar: '...' } },
    priority: 0.8,
  }))
  
  return [...staticEntries, ...productEntries]
}
```

**Pitfalls**:
- Don't list redirect routes (302/301) — sitemaps must be 200-OK.
- Don't list routes that 404 (e.g., La Lounge product slugs if La Lounge has no product page).
- Include hreflang alternates via `alternates.languages`.

### 8.8 robots.txt

Use `src/app/robots.ts` (NOT a static `public/robots.txt`). The static file shadows the
generated one:

```ts
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    rules: { userAgent: '*', disallow: ['/admin', '/api', '/checkout'] },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

**Pitfall**: If both `public/robots.txt` and `src/app/robots.ts` exist, the static file wins
and the dynamic rules are ignored. Delete the static file.

### 8.9 JSON-LD Structured Data

Emit `Organization` + `WebSite` schema on the HOME page only (not every route — it causes
duplicate competing schemas). Use `env`-aware URLs:

```tsx
<JsonLd schema={{
  '@type': 'Organization',
  name: 'Last Unique Touch',
  url: process.env.NEXT_PUBLIC_SITE_URL,
}} />
```

Product pages emit `Product` + `BreadcrumbList` schema. Never hardcode the URL.

---

## 9. Common Pitfalls Catalog

This is the single most valuable section. Each entry maps a concrete symptom to its root
cause and exact fix. These are real bugs found in production code.

### 9.1 Next.js 16 Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Page params are `undefined` | Used sync `params` signature | Change to `params: Promise<{...}>` + `await params` |
| Build error: "two pages resolve to same path" | Route group conflict | Only one `page.tsx` per URL; use redirects for alternates |
| `global-error.tsx` never triggers | Placed in `[locale]/` not root | Move to `src/app/global-error.tsx` |
| `middleware.ts` conflicts with `proxy.ts` | Next.js 16 renamed middleware | Delete `middleware.ts`, use `proxy.ts` |
| Hydration mismatch on dates/times | `Date.now()` in render | Move to `useEffect` |
| Theme flash (FOUC) on brand switch | SSR'd `data-brand` is hardcoded | Let client `BrandThemeSetter` set it; use `suppressHydrationWarning` |

### 9.2 Security Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Admin route accessible without login | Missing `requireAuth()` in server action | Add as first statement in every admin action |
| Webhook processed twice | No idempotency check | Store nonce in `IdempotencyKey` table inside Serializable tx |
| Stock exhausted by spam | PENDING bookings never expire | Filter PENDING older than 30min TTL in availability queries |
| Price manipulated client-side | Client-supplied total trusted | Recompute total server-side in Serializable tx |
| Exact stock count leaked | Error message includes `${availableStock}` | Use generic "insufficient stock" message |
| Dev mock endpoint works in prod | No `NODE_ENV` guard | `if (NODE_ENV === 'production') return 404` |
| Slug race condition | `findFirst` + `create` not atomic | Catch P2002 → return `slug_exists` |
| Session cookie stolen via XSS | Missing `httpOnly` | Set `httpOnly: true, secure: true, sameSite: 'lax'` |

### 9.3 Database Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Slow admin dashboard queries | Missing compound indexes | Add `@@index([brand, status])` etc. |
| Double-booking | Stock check + create in separate transactions | Interleave in one Serializable tx |
| Multi-day vs same-day overlap bug | Asymmetric +24h extension | Extend end date on BOTH request and stored |
| Orphaned bookings when product deleted | Missing `onDelete` | Add `onDelete: SetNull` (nullable FK) |
| Two different DB files | Path resolution mismatch | Use absolute path or consistent relative path |
| Stale Prisma client | Schema changed but not regenerated | Run `bunx prisma generate` (client only); `db:push` if the dev DB itself is stale |
| Float money drift | `Float` type for currency | Use `Decimal` (or `Float` + `KWD_TOLERANCE`) |
| Full table scan on admin search | No index on `ip`/`userId` | Add `@@index([ip])`, `@@index([userId])` |
| Multi-item order only confirms first booking | `orderId` is `bookings[0].id` | Generate shared `ORD-...` orderId; updateMany all siblings |

### 9.4 Code Quality Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Component crashes on null | `value!` non-null assertion | Explicit null check |
| Loading state stuck on `true` | `setSubmitting(false)` only in `try` | Move to `finally` block |
| Silent failure, no error | `catch (e) {}` | `console.error` + surface to user |
| TypeScript bypasses hide bugs | `as any` / `as unknown as` | Define proper types |
| Brand color mismatch | Hardcoded hex `#F5B914` | Use `BRAND_COLORS` constant + CSS vars |
| Cart button goes to wrong brand | Hardcoded `/cart` | Use `getCartHref(brand)` helper |
| Product card 404s on birthday | Hardcoded `/products/[slug]` | Use `getProductsBasePath(brand)` |
| Dead component never removed | Exported but unimported | Grep for importers; delete if zero |
| Props accepted but ignored | Interface has unused fields | Remove + update all call sites |
| `MISSING_MESSAGE` error | Dynamic i18n key has no translation | `t.has(key) ? t(key) : fallback` |

### 9.5 i18n Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Arabic shows English text | Key missing in `ar.json` | Run parity diff script |
| Both snake_case + camelCase keys | Convention drift | Pick one; delete orphans (verify with Grep first) |
| `useTranslations` crashes in server component | Client hook in server code | Use `getTranslations()` |
| RTL layout broken | `left`/`right` instead of `start`/`end` | Use logical properties (`ms-`, `ps-`, `start-`) |
| Plural form wrong in Arabic | Missing ICU plural forms | Add all 6 forms (zero/one/two/few/many/other) |

### 9.6 Accessibility Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Blank white page on reduced-motion | No 3D fallback | Add `.brand-hero-fallback` dark gradient |
| Delete buttons all sound the same | `aria-label="Delete"` with no context | `aria-label={\`Delete ${item.name}\`}` |
| Total flashes 0.000 before hydration | Client-computed value in render | Guard with `mounted` flag |
| Screen reader misses success | No focus move + auto-close too fast | Move focus to success + `role="status"` |
| Error messages hard to read | `text-primary` (brand color) | Use `text-destructive` (red) |
| Cart/checkout loading not announced | Missing `aria-live` | Add `role="status"` + `aria-live="polite"` |
| Footer links go to wrong brand | Hardcoded `/products` | `getProductsBasePath(brand)` |

### 9.7 SEO Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Duplicate JSON-LD on every page | Emitted in layout | Move to home page only |
| Wrong URLs in structured data | Hardcoded `https://example.com` | Use `process.env.NEXT_PUBLIC_SITE_URL` |
| Sitemap lists redirect URLs | `/contact` is a 302 | List final destinations only |
| robots.txt ignores rules | Static file shadows dynamic | Delete `public/robots.txt`; use `src/app/robots.ts` |
| Brand catalog invisible to crawlers | Sitemap only queries one brand | Query ALL brands with storefronts |
| Missing hreflang | No `alternates.languages` | Add `{ en: '...', ar: '...' }` per URL |

### 9.8 Performance Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Slow page load (large JS) | Heavy lib in client bundle | `dynamic(() => import(...), { ssr: false })` |
| N+1 query on admin list | Query in a loop | Use `include` / `select` for relations |
| Unbounded query returns 10k rows | `findMany` without `take` | Add pagination (`take`, `skip`) |
| Over-fetching | `findMany` without `select` | Add `select: { id: true, name: true, ... }` |
| Render-blocking fonts | `<link>` to Google Fonts | Use `next/font` |
| Images not optimized | Raw `<img>` | Use `next/image` |

### 9.9 Dev Environment Pitfalls

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Sandbox kills dev server between commands | Process dies with shell | Use `setsid nohup ... & disown` + keepalive wrapper |
| `node_modules` missing | Sandbox wiped it | Run `bun install` before any lint/test |
| DB file disappears | Sandbox wiped `prisma/db/` | Recreate: `bun run db:push && bun run db:seed` |
| `middleware.ts` reappears | Stale git cache | `rm -f src/middleware.ts`; add to `.gitignore` |
| Port 3000 already in use | Previous process didn't die | `pkill -f "next dev"` then restart |
| Stale `.next` cache | Old build artifacts | `rm -rf .next` before restart |
| Env var not picked up | Shell cached old env | Kill all processes; restart with explicit `export` |

---

## 10. The Loops Audit Methodology

This methodology was used to find and fix 84 issues in a production codebase. It consists of
two agent groups iterating until zero issues remain, followed by a final 6-reviewer panel.

### 10.1 Group 1: Analysis (Read-Only)

Launch 4 parallel agents, each specialized in one domain. They READ and ANALYZE — they do
NOT fix anything.

| Agent | Domain | Scope |
|-------|--------|-------|
| G1-A | Security | API routes, auth, webhooks, payment, admin guards, secrets |
| G1-B | Code Quality | Lib files, components, TypeScript strictness, React patterns |
| G1-C | Architecture | Routing, layouts, Next.js 16 specifics, SEO, performance |
| G1-D | Data & i18n | Prisma schema, queries, transactions, i18n parity |

Each agent:
1. Reads the worklog to understand prior context.
2. Reads EVERY file in their scope (in full, no skimming).
3. Cites exact file:line and quotes problematic code.
4. Rates severity: CRITICAL / HIGH / MEDIUM / LOW / INFO.
5. Provides a concrete recommended fix.
6. Writes findings to a shared `audit-round-N.md` (append mode).
7. Returns a summary: total issues by severity + top 5 findings.

**Output**: A consolidated, prioritized issue list.

### 10.2 Group 2: Fixers (Write)

Launch parallel fix agents. Each owns a set of files (no overlap — prevents conflicts).
Each reads the audit findings for their domain and applies surgical fixes.

| Agent | Files Owned |
|-------|-------------|
| G2-1 | Architecture: layouts, sitemap, robots, not-found, global-error, next.config |
| G2-2 | API + booking logic: orders route, products.ts, webhooks, admin actions |
| G2-3 | Components: brand-colors, cart-button, product-card, admin components, 3D backgrounds |
| G2-4 | Schema + i18n: prisma/schema.prisma, messages/*.json |

Each fixer:
1. Reads the worklog + audit findings.
2. Makes MINIMAL, surgical changes (no refactoring).
3. Preserves existing patterns.
4. Runs `bun run lint` + `tsc --noEmit` after edits.
5. Appends a worklog entry.
6. Returns a summary of fixes.

### 10.3 Round 2: Re-Verification (Group 1 Again)

The same 4 analysis agents re-verify. For each original issue:
- **FIXED** — fix is correct and complete (quote the fixed code).
- **PARTIALLY FIXED** — main issue resolved but edge cases remain.
- **NOT FIXED** — the fix didn't work or wasn't applied.

Also check for NEW issues introduced by the parallel fixes (regressions).

**Loop condition**: If any agent reports FAIL (blocking issues remain), go back to Group 2
for another fix round. Repeat until all 4 agents PASS.

### 10.4 Group 3: Final 6-Reviewer Panel

Once Groups 1 + 2 converge (zero blocking issues), launch 6 reviewers for a FRESH, deep
audit. They don't just verify fixes — they hunt for issues the first round missed.

| Reviewer | Domain |
|----------|--------|
| R1 | Security & Authentication |
| R2 | Booking & Business Logic |
| R3 | Architecture & Next.js 16 |
| R4 | TypeScript & Code Quality |
| R5 | Data Integrity & i18n |
| R6 | UI/UX & Accessibility |

Each reviewer:
1. Reads the worklog + all prior audit rounds.
2. Does a FRESH analysis (not just verifying fixes).
3. Hunts for issues the first round may have missed.
4. Returns PASS or FAIL with blocking issues.

**Loop condition**: If any reviewer FAILS, go back to Group 2 for fixes, then re-verify.
Repeat until all 6 reviewers PASS.

### 10.5 Why This Works

1. **Separation of concerns**: Analysis agents have no incentive to "fix and move on" — they
   find issues deeply. Fix agents have clear file ownership — no merge conflicts.
2. **Fresh eyes**: Group 3 reviewers haven't seen the code before — they catch what
   round 1 normalized.
3. **Forced convergence**: The loop condition (all PASS) prevents declaring victory
   prematurely.
4. **Documented trail**: Every finding, fix, and verification is in the worklog — full
   auditability.

### 10.6 Severity Definitions

| Severity | Definition | Action |
|----------|-----------|--------|
| CRITICAL | Exploitable / data loss / crash / RCE / auth bypass | Fix immediately; blocks release |
| HIGH | Likely bug / privilege escalation / data leak / SEO loss | Fix before release |
| MEDIUM | Code smell / inconsistency / defense-in-depth gap | Fix in next sprint |
| LOW | Minor improvement / hardening | Backlog |
| INFO | Observation / positive finding | Note only |

---

## 11. Final Pre-Deployment Checklist

Before declaring a feature "done," verify ALL of the following. This is the standard of
"done" — not "it compiles."

### 11.1 Build & Type Safety
- [ ] `bun run lint` passes (0 errors, 0 warnings)
- [ ] `tsc --noEmit` passes (0 errors)
- [ ] `JSON.parse(messages/en.json)` + `JSON.parse(messages/ar.json)` succeed
- [ ] i18n key parity: 0 keys only-in-en, 0 keys only-in-ar

### 11.2 Security
- [ ] Every admin server action calls `requireAuth()` as first statement
- [ ] Every API input validated (Zod or manual) before reaching Prisma
- [ ] No raw SQL / `$queryRawUnsafe` with user input
- [ ] No `dangerouslySetInnerHTML` with untrusted input
- [ ] Webhooks verify HMAC signature + timestamp skew + nonce idempotency
- [ ] Sensitive endpoints rate-limited (login, contact, checkout)
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] No `NEXT_PUBLIC_` prefix on secrets
- [ ] Dev-only endpoints gated with `NODE_ENV === 'production'` → 404
- [ ] Error responses don't leak stack traces / DB schema / exact counts

### 11.3 Database
- [ ] All FKs indexed
- [ ] Compound indexes on common filter combinations
- [ ] `onDelete` declared on all relations
- [ ] Multi-step writes in `$transaction` (Serializable for stock/booking)
- [ ] Stock check + create interleaved in same transaction
- [ ] PENDING bookings have a TTL (30 min) in availability queries
- [ ] Booking overlap detection is symmetric (+24h on both sides)
- [ ] Multi-item orders grouped under shared `orderId`
- [ ] P2002 / P2025 / P2034 Prisma errors handled with user-friendly messages
- [ ] `db:push` succeeds (dev); `db:seed` produces valid data; production schema changes go through `prisma migrate deploy`

### 11.4 Architecture
- [ ] All pages use `params: Promise<...>` + `await params` (Next.js 16)
- [ ] No `src/middleware.ts` (use `src/proxy.ts`)
- [ ] `global-error.tsx` at `src/app/` root (not `[locale]/`)
- [ ] No route group conflicts (one `page.tsx` per URL)
- [ ] Every dynamic route has `generateStaticParams` + `dynamicParams` where appropriate
- [ ] Every page exports `metadata` or `generateMetadata`
- [ ] `'use client'` only where needed (hooks, events, browser APIs)
- [ ] Heavy libs dynamically imported with `{ ssr: false }`
- [ ] No hydration mismatches (dates, random, localStorage gated in `useEffect`)
- [ ] Loading states (`loading.tsx`) on all async routes
- [ ] Error boundaries (`error.tsx`) at locale root + admin segment
- [ ] Sticky footer pattern: `min-h-screen flex flex-col` + `mt-auto`

### 11.5 Code Quality
- [ ] No `any` types (use `unknown` + narrow, or proper types)
- [ ] No `!` non-null assertions without justification
- [ ] No `catch (e) {}` silent catches
- [ ] No `as any` casts
- [ ] All `await`ed server actions in try/catch/finally
- [ ] Loading state reset in `finally` block
- [ ] No dead code (unused imports, exported-but-unimported, commented blocks)
- [ ] No hardcoded brand colors (use `BRAND_COLORS` constant + CSS vars)
- [ ] No hardcoded `/products` paths in shared components (use `getProductsBasePath`)
- [ ] Files under 500 lines (or documented reason)

### 11.6 i18n
- [ ] EN/AR key parity: identical key sets
- [ ] No snake_case/camelCase duplicate keys
- [ ] No untranslated AR values (still in English)
- [ ] ICU placeholders consistent between EN/AR
- [ ] Plural forms complete for Arabic (6 forms)
- [ ] Server components use `getTranslations()` (not `useTranslations()`)
- [ ] Logical properties (`ms-`, `ps-`, `start-`) not `ml-`/`pl-`/`left`

### 11.7 Accessibility
- [ ] All images have `alt` (empty for decorative)
- [ ] All icon-only buttons have `aria-label` (with context: "Delete Product X")
- [ ] All interactive elements are `<button>`/`<a>` (not `<div onClick>`)
- [ ] 44px minimum touch targets
- [ ] `focus-visible` styles on all interactive elements
- [ ] Forms have `<label>` or `aria-label`
- [ ] Error messages in `text-destructive` (red), not brand color
- [ ] Loading states: `role="status"` + `aria-live="polite"` + `sr-only`
- [ ] Modals: focus trap, `role="dialog"`, ESC to close
- [ ] Success states: focus moved to message, not auto-closed too fast
- [ ] Color contrast passes WCAG AA (4.5:1 text, 3:1 large/UI)
- [ ] 3D backgrounds have dark fallback (no white-page-on-reduced-motion)
- [ ] Hydration flashes guarded with `mounted` flag

### 11.8 SEO & Performance
- [ ] `sitemap.ts` lists all 200-OK URLs (no redirects, no 404s)
- [ ] `src/app/robots.ts` (no `public/robots.txt` shadowing it)
- [ ] JSON-LD on home page only (not every route)
- [ ] No hardcoded URLs (use `process.env.NEXT_PUBLIC_SITE_URL`)
- [ ] `next/image` everywhere (no raw `<img>`)
- [ ] `next/font` (no render-blocking font links)
- [ ] N+1 queries eliminated (`include`/`select` for relations)
- [ ] List queries paginated (`take`/`skip`)
- [ ] `select` to limit over-fetching

### 11.9 Browser Verification (Mandatory)
- [ ] Page renders (no blank/white screen, no error boundary)
- [ ] Core interactions work (click main buttons, submit key forms)
- [ ] Data-driven features show real data (not endless skeleton)
- [ ] Responsive: layout holds on mobile + desktop
- [ ] Sticky footer: sticks on short pages, pushed down on long
- [ ] RTL layout correct (Arabic)
- [ ] No console errors / runtime errors in dev log

---

## Appendix A: Essential Commands

```bash
# Install dependencies
bun install

# Start dev server (background, survives shell exit)
nohup setsid bash -c 'while true; do bun run dev >> dev.log 2>&1; sleep 3; done' \
  < /dev/null > /dev/null 2>&1 & disown

# Lint + typecheck
bun run lint
bunx tsc --noEmit

# Database
bun run db:push     # apply schema changes — DEV/PROTOTYPING ONLY!
bun run db:seed      # seed initial data
bun run db:studio    # visual DB browser

# ⚠️ db:push does NOT create migration files (schema-drift risk). In staging/production
# apply schema changes ONLY via migrations:
bunx prisma migrate deploy

# i18n parity check
node -e "
const fs = require('fs');
function flat(o,p=''){return Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v!==null?flat(v,p+k+'.'):[p+k])}
const en=flat(JSON.parse(fs.readFileSync('messages/en.json','utf8'))).sort();
const ar=flat(JSON.parse(fs.readFileSync('messages/ar.json','utf8'))).sort();
const enOnly=en.filter(k=>!ar.includes(k));
const arOnly=ar.filter(k=>!en.includes(k));
console.log('EN:',en.length,'AR:',ar.length,'diff:',enOnly.length+arOnly.length);
if(enOnly.length||arOnly.length){console.error({enOnly,arOnly});process.exit(1)}
console.log('Parity OK');
"

# Find all DB files (should be exactly one)
find . -name "*.db" -not -path "*/node_modules/*"

# Find dead code (exported but unimported)
# Replace 'ComponentName' with the export you're checking
grep -r "ComponentName" src/ --include="*.ts" --include="*.tsx" | grep -v "export"
```

---

## Appendix B: File Ownership for Parallel Fix Agents

When running the Loops methodology with parallel fixers, assign file ownership to prevent
merge conflicts. Example partition:

| Agent | Files |
|-------|-------|
| Architecture Fixer | `src/app/**/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/global-error.tsx`, `next.config.ts`, `src/proxy.ts` |
| API/Logic Fixer | `src/app/api/**`, `src/lib/products.ts`, `src/lib/auth.ts`, `src/lib/rate-limiter.ts`, `src/app/[locale]/admin/**/actions.ts` |
| Component Fixer | `src/components/**`, `src/lib/brand.ts`, `src/lib/brand-colors.ts` |
| Schema/i18n Fixer | `prisma/schema.prisma`, `prisma/seed.ts`, `messages/en.json`, `messages/ar.json` |

**Rule**: No two agents edit the same file. If a fix spans domains, the agent who owns the
primary file makes the change; the other agent documents the cross-cutting concern in the
worklog for a follow-up.

---

## Appendix C: The "It Compiles" Anti-Pattern

> "It compiles" / "the server is up" is NEVER sufficient evidence of completion.

A passing `tsc` and a running dev server prove only that the code is syntactically valid
and the server starts. They do NOT prove:
- The page renders (could be a blank screen / error boundary)
- Interactions work (could crash on click)
- Data flows (could be an endless loading skeleton)
- The layout is responsive (could overflow on mobile)
- The footer is sticky (could float mid-page)
- RTL works (could be mirrored wrong)

**The standard of done is browser-verified interactivity.** Open the page, click the
buttons, submit the forms, check the console, verify on mobile width. Only then is the
task complete.

---

## Appendix D: Testing Strategy (Minimum Viable)

Checklists catch structural issues; tests catch logic regressions. You don't need 90%
coverage on day one — prioritize pure business logic first, because that's where
money-losing bugs live and where tests are cheapest to write:

**Tier 1 — Pure functions (write these FIRST, zero mocks needed):**
- `overlaps()` / `endOfDay()` — the same-day vs multi-day boundary matrix (Aug 1–5 vs
  Aug 5 same-day, back-to-back boundary dates)
- `computeDays()` / price aggregation — include the `KWD_TOLERANCE` floating-point case
- `canTransition()` — every valid AND invalid state-machine edge
- `resolveBrandFromPath()` / `getProductsBasePath()` — all three brands

**Tier 2 — API route integration tests (against a test DB):**
- POST /api/orders: overbooking rejection, price-mismatch rejection, multi-item orderId grouping
- Webhook: stale-timestamp rejection, duplicate-nonce path (P2002), invalid signature

**Tier 3 — One smoke e2e per critical path:**
- Home → product → add to cart → checkout → success, in BOTH locales (LTR + RTL)

Run Tier 1 in CI on every PR; Tiers 2–3 before releases. Every regression that reaches
production must produce a new Tier-1 test — that's how the suite grows from real bugs,
not imaginary ones.

---

*End of guide. This document is a living reference — update it as you encounter new
pitfalls. The goal is not perfection on the first try, but a systematic process that
converges on production-readiness through iterative analysis and verification.*
