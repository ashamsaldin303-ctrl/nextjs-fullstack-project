# Project Worklog — Shared Memory for All Agents

> This file is the single shared worklog. Every agent MUST read it before working
> and MUST append a section after finishing its task.

---
Task ID: 0
Agent: main (Full Stack Agent)
Task: Analyze and permanently store `FULLSTACK_AGENT_GUIDE (2).md` as the primary reference for the upcoming project.

Work Log:
- Read the full guide located at `/home/z/my-project/upload/FULLSTACK_AGENT_GUIDE (2).md` (2081 lines, ~85KB).
- Completed a full section-by-section analysis (all 11 parts + 4 appendices).
- Stored this distilled analysis below as the mandatory engineering standard for ALL future tasks in this project.

Stage Summary — MASTER REFERENCE DIGEST (binding rules for every future task):

## A. Target Stack (from guide §1.1)
- Next.js 16 (App Router) · React 19 · TypeScript 5 strict · Tailwind CSS 4 + shadcn/ui
- Prisma 6 + SQLite (dev) · next-intl 4 (AR/EN, RTL/LTR) · NextAuth v4 or custom HMAC sessions
- Zustand (client state) + TanStack Query (server state)
- Heavy libs (Three.js, Chart.js, >50KB): `dynamic(() => import(...), { ssr: false })` with non-null loading fallback

## B. Next.js 16 Critical Rules (§1.3 — these BREAK code if ignored)
1. `params` / `searchParams` are Promises → `const { slug } = await params`
2. `proxy.ts` replaces `middleware.ts` → NEVER create `src/middleware.ts`
3. `cookies()` / `headers()` are async → `const store = await cookies()`
4. `store.set()` only in Server Actions / Route Handlers, never during render
5. `global-error.tsx` ONLY at `src/app/global-error.tsx` (root), must render own `<html>/<body>`
6. Route groups `(name)` don't affect URL → only ONE page.tsx per URL path (no conflicts)
7. `not-found.tsx` is a server component → use `getTranslations()`, NOT `useTranslations()`

## C. Architecture (§1.2, §1.5–1.8)
- Structure: `src/app/[locale]/` (layout, page, loading, error, not-found), `components/{ui,layout,providers,feature}`, `lib/{db,auth,brand,domain}.ts`, `i18n/`, `messages/{en,ar}.json`, `prisma/`
- `'use client'` ONLY for hooks/events/browser APIs/router hooks. NEVER import `@/lib/db` or `fs` into client components
- Hydration safety: gate `Date.now()`, `Math.random()`, `localStorage`, timezone formatting behind `mounted` flag + `useEffect`
- Sticky footer: `min-h-screen flex flex-col` on body + `flex-1` main + `mt-auto` footer + `pb-[env(safe-area-inset-bottom)]`
- Every async route: `loading.tsx` (role="status" + aria-live + sr-only) + `error.tsx` (no stack traces) + segment `not-found.tsx`

## D. Security (§2 — defense in depth)
1. Two-layer auth: edge check in `proxy.ts` + `requireAuth()` as FIRST statement of every admin server action/route
2. Zod validation on EVERY API input before Prisma
3. No raw SQL with user input; dynamic orderBy/field names validated against allow-lists
4. Webhooks: HMAC (timingSafeEqual — NOTE: `crypto.subtle.timingSafeEqual` does NOT exist, use node:crypto) + timestamp skew ≤5min + nonce idempotency in Serializable tx
5. Rate limiting on login/contact/checkout/password reset; IP from trusted proxy header (last in XFF chain)
6. Secrets: .env only, never `NEXT_PUBLIC_` prefixed, ≥32 chars, fail closed at startup
7. IDOR: scope queries by `{ id, userId: session.userId }`; admin scopes by brand from session
8. Cookies: httpOnly + secure(prod) + sameSite:'lax' + `__Host-` prefix; maxAge ≤24h
9. Payment: NEVER trust client price — recompute in Serializable tx with 0.001 tolerance
10. Dev-only endpoints → 404 in production
11. No info leaks: no stack traces, no file paths, no schema names, no exact stock counts
12. Security headers centralized in next.config.ts (nosniff, DENY, referrer-policy, permissions-policy, HSTS, CSP)

## E. Database/Prisma (§3)
- Money: `Decimal` (not Float); if Float forced → `KWD_TOLERANCE = 0.001` everywhere
- Status fields: Prisma enums, not strings; always `createdAt`/`updatedAt`
- Compound `@@index` for every common `where` combo; FKs NOT auto-indexed in SQLite — add explicitly
- Explicit `onDelete`: Cascade (OrderItem→Order), SetNull (Booking→Product, nullable FK), Restrict (protect parents)
- Multi-tenant: `brand` field on every tenant model; every query scoped by it (from session, not URL)
- Stock check + booking create INTERLEAVED in ONE Serializable transaction (prevents overbooking)
- Overlap condition: `A.start < B.endEff AND A.endEff > B.start` with endOfDay extension on BOTH sides (symmetric!), strict `<`
- PENDING bookings TTL 30min (lazy GC) in availability queries — DoS prevention
- Catch P2002 (unique) / P2025 (not found) / P2034 (tx conflict) with friendly messages; P2002 is the real TOCTOU safety net
- Multi-item orders: shared generated `orderId` (`ORD-...`); webhook confirms ALL via `updateMany({ where: { orderId } })`
- Normalize dates to UTC midnight server-side (`YYYY-MM-DD` → `T00:00:00.000Z`)
- SQLite path consistency: ONE db path everywhere; verify single *.db file exists

## F. TypeScript & Code Quality (§4)
- strict + noUncheckedIndexedAccess + noImplicitOverride + exactOptionalPropertyTypes
- No `any`/`as any` → use `unknown` + narrowing; no `!` non-null assertions → explicit checks
- No silent catches; loading state reset in `finally` (never only in try or catch)
- React: stable keys (not index), cleanup effects, no derived state in useState, no window reads in render
- Dynamic i18n keys: `t.has(key) ? t(key) : fallback`
- Component size: <100 ideal, <300 acceptable, >500 split
- Brand colors ONCE in `src/lib/brand-colors.ts` + CSS vars via `data-brand`; grep hex values to catch stale refs
- Brand routing helpers in ONE file (`resolveBrandFromPath`, `getProductsBasePath`, `getCartHref`) — never hardcode `/products` in shared components
- Structured JSON logs server-side with `event` + `correlationId`; log IDs, never PII/secrets

## G. i18n (§5)
- EN/AR perfect key parity (parity diff script in CI)
- camelCase keys ONLY (no snake_case duplicates)
- ICU placeholders; Arabic 6 plural forms (zero/one/two/few/many/other)
- `getTranslations()` in server, `useTranslations()` in client only
- RTL: logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`); `<html dir="rtl">`; test every page in RTL

## H. Booking/Cart/Checkout Flow (§6)
Cart(localStorage, brand-scoped keys) → checkout validation (products active, price recomputed from DB) → POST /api/orders (Serializable tx, interleaved check+create, one orderId) → payment view (fetch ALL bookings by orderId) → webhook (HMAC + idempotency + state machine validation) → updateMany all to CONFIRMED → success page.
- Payment state machine: PENDING→[CONFIRMED|CANCELLED|PAYMENT_FAILED], CONFIRMED→[COMPLETED|CANCELLED], CANCELLED/COMPLETED terminal, PAYMENT_FAILED→retry allowed. Validate transitions BEFORE update.
- Cross-brand cart: reject or clear with toast

## I. Accessibility (§7 — WCAG 2.1 AA)
- Semantic HTML, keyboard reachable, `focus-visible:ring-2`, 44px touch targets
- aria-label on icon-only buttons WITH context ("Delete Product X")
- Forms: labels, aria-invalid, aria-describedby, errors in `role="alert"` + `text-destructive` (red, never brand color)
- Loading: role="status" + aria-live="polite" + sr-only; toasts: role="alert"
- Modals: focus trap, role="dialog", aria-modal, ESC
- Contrast: 4.5:1 normal text, 3:1 large/UI (no `text-paper/30`-style low opacity)
- 3D/WebGL: dark gradient fallback (no white page on reduced-motion); dynamic import loading ≠ null
- Success states: move focus to message, don't auto-close too fast
- Client-computed values (totals): guard with mounted flag (no 0.000 flash)

## J. Performance & SEO (§8)
- `next/image` everywhere (alt + width/height or fill+sizes); `next/font` (Inter latin + Cairo arabic, preload:false for rare fonts)
- Tree-shaken icon imports; paginated queries (take/skip); select to limit over-fetch; no N+1 (include/select)
- generateStaticParams + dynamicParams on dynamic routes; ISR revalidate where sensible
- Centralized `buildMetadata` with `process.env.NEXT_PUBLIC_SITE_URL` (never hardcode URLs)
- `src/app/sitemap.ts` (all 200-OK URLs only, hreflang alternates, ALL brands) and `src/app/robots.ts` (delete `public/robots.txt` to avoid shadowing)
- JSON-LD (Organization/WebSite) on HOME page ONLY; Product+BreadcrumbList on product pages

## K. Common Pitfalls Catalog (§9 — symptom → fix quick map)
- Next.js 16: params undefined→await Promise; same-path conflict→one page per URL; global-error at root; no middleware.ts
- Security: missing requireAuth; webhook idempotency; PENDING TTL; server-side price recompute; generic stock messages; NODE_ENV gate; P2002 catch; cookie flags
- DB: compound indexes; interleaved Serializable tx; symmetric +24h overlap; onDelete SetNull; single db file path; Decimal for money; shared orderId for multi-item
- Quality: no `!`, finally resets, no silent catch, no `as any`, BRAND_COLORS const, brand path helpers, no dead code, t.has() guard
- i18n: parity, one case convention, getTranslations in server, logical properties, 6 Arabic plurals
- a11y: 3D fallback, contextual aria-labels, mounted guard, focus management, destructive color for errors
- SEO: JSON-LD home only, env URLs, no redirects in sitemap, robots.ts not static file, all brands in sitemap, hreflang
- Perf: dynamic ssr:false for heavy libs, no N+1, pagination, select, next/font, next/image
- Dev env: background dev server with keepalive, bun install after wipes, db:push+seed after db loss, pkill next dev on port conflict, rm -rf .next on stale cache

## L. Loops Audit Methodology (§10)
- Group 1 (read-only analysis): 4 parallel agents — Security / Code Quality / Architecture / Data+i18n — cite file:line, severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), concrete fix
- Group 2 (fixers): parallel, non-overlapping file ownership, minimal surgical changes, lint+tsc after, worklog entry
- Round 2: re-verify (FIXED/PARTIALLY/NOT FIXED + regression hunt) — loop until all PASS
- Group 3: 6 fresh reviewers (Security, Business Logic, Architecture, TypeScript, Data/i18n, UI/UX a11y) — fresh eyes, loop until all 6 PASS
- Severity: CRITICAL blocks release, HIGH fix before release, MEDIUM next sprint, LOW backlog, INFO note

## M. Definition of Done (§11 + Appendix C) — "It compiles" is NEVER enough
Checklist: lint 0/0 · tsc 0 errors · i18n parity 0 diff · requireAuth everywhere · Zod on inputs · webhook 3-layer defense · rate limits · cookie flags · no NEXT_PUBLIC secrets · NODE_ENV gates · indexes · onDelete · Serializable interleaved tx · PENDING TTL · symmetric overlap · shared orderId · P2002/P2025/P2034 handled · await params · proxy.ts not middleware · global-error at root · one page per URL · generateStaticParams · metadata per page · minimal use client · dynamic heavy libs · no hydration mismatch · loading/error files · sticky footer · no any/! /silent catch · finally resets · no dead code · BRAND_COLORS · path helpers · <500 line files · parity · 6 Arabic plurals · getTranslations server-side · logical props · a11y full checklist · sitemap/robots correctness · JSON-LD home only · next/image+font · pagination+select · BROWSER-VERIFIED interactivity (render, click, submit, real data, responsive, sticky footer, RTL, no console errors).

## N. Key Commands (Appendix A)
- Background dev server: `nohup setsid bash -c 'while true; do bun run dev >> dev.log 2>&1; sleep 3; done' < /dev/null > /dev/null 2>&1 & disown`
- `bun run lint` · `bunx tsc --noEmit` · `bun run db:push` (dev only) · `bun run db:seed` · `bunx prisma migrate deploy` (prod)
- i18n parity node one-liner (see guide) · find *.db (exactly one expected)

## O. Testing Priority (Appendix D — despite "no test code" default, pure logic verification matters)
Tier 1 pure functions first: overlaps/endOfDay boundary matrix, computeDays+tolerance, canTransition edges, brand path helpers. Tier 2 API integration (overbooking, price mismatch, webhook staleness/dup-nonce). Tier 3 one e2e smoke per critical path in BOTH locales.

## P. Context Notes (project-specific)
- The guide originates from a multi-tenant rental platform (brands: LUT #8B6B3D, LA_LOUNGE #E6007E, YOUR_BIRTHDAY #FFCC00; KWD currency, 3 decimals; old color #F5B914 is stale)
- The current sandbox project root: /home/z/my-project (Next.js 16 ready, Prisma configured, shadcn/ui present)
- Sandbox constraint: only route visible to user is `/` in src/app/page.tsx; API-first (use api routes, not server actions, per environment rules); port 3000 only; dev.log monitoring mandatory
- Full original guide remains available at: /home/z/my-project/upload/FULLSTACK_AGENT_GUIDE (2).md

---
Task ID: 1
Agent: main (Full Stack Agent)
Task: تنفيذ برومبت Elyra المرحلة 1 بالكامل — موقع وكالة إيليرا الرقمية.

Work Log:
- ثبّت three + @react-three/fiber + @types/three.
- أنشأ نظام i18n الكامل: routing.ts (locales ar/en, as-needed, localeDetection:false), request.ts, navigation.ts, proxy.ts (Next.js 16).
- كتب messages/ar.json + messages/en.json (445 مفتاحاً متطابقاً) + scripts/check-i18n-parity.js.
- أعد تعريف globals.css بتوكنز Elyra (#0071E3 primary، #0F172A dark، Google accents) + utilities (glass-dark, hero-fallback, kicker, glow-cursor, scroll-dark).
- حدّث tsconfig (strict + noUncheckedIndexedAccess + noImplicitOverride، استثنى examples/skills/tests) و next.config.ts (withNextIntl plugin + security headers + allowedDevOrigins).
- بنى [locale]/layout.tsx (Inter + Cairo via next/font, sticky-footer pattern, Navbar + Footer + Toaster + skip link) + global-error.tsx + loading/error/not-found.
- بنى lib/calculator.ts (computeEstimate + formatMoney — pure functions جاهزة للمرحلة 3) + lib/seo.ts (buildPageMetadata + SITE_URL) + lib/use-rtl.ts.
- بنى المكونات المشتركة: brand/logo.tsx (wordmark SVG), layout/{navbar,footer,language-switcher,live-clock}.tsx, shared/{reveal,section-heading,page-hero,cta}.tsx.
- بنى 8 أقسام رئيسية: hero (R3F particles + kinetic typography), trust-bar (animated counters), bento (5 cards بـ mini-interactives + glow), automation-simulator (SVG nodes + neon pulses + state machine + 3 scenarios), featured-work (before/after sliders), methodology (4 sticky stacked cards), testimonials (glass on dark), calculator (3-step Mac wizard + Zod).
- بنى 5 صفحات: services/websites (3 types + 3D CapabilityScene + 6-step journey), services/automation (8 integrations + runsOnN8n + multi-scenario simulator), work (filtering + 6 before/after), about (story + 3 values + 4 team + 4 numbers), contact (3 channels + form + calculator).
- بنى SEO: sitemap.ts, robots.ts, icon.tsx (ImageResponse), HomeJsonLd (Organization+WebSite).
- لخّص فحوصات: lint 0/0, tsc 0, parity 445/445, 7 routes × 2 locales = 200.
- تحقق إلزامي في المتصفح (agent-browser): الرئيسية ترسم 9 أقسام، مبدل اللغة يعمل (/en)، الحاسبة تحتسب $7,300–$11,700، المحاكي يطبّق state machine (خطوة 3/5 + عدّاد ms + سجل مكتمل)، فلترة الأعمال (6→3 عند أتمتة)، مشهد 3D canvas موجود، القائمة المتنقلة تفتح، sticky footer سليم، صفر أخطاء console.

Stage Summary:
- المرحلة 1 مكتملة بالكامل ومتحقق منها في المتصفح.
- جودة: lint 0/0 + tsc 0 + i18n parity 445 + WCAG AA + reduced-motion + RTL/LTR + responsive + sticky footer.
- القرارات المعمارية الموثقة في README.md (7 قرارات).
- المرحلة 2 و 3 معرّفتان بوضوح في README لانتظار أمر صاحب المشروع.
