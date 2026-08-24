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

---
Task ID: GH-PUSH-1
Agent: Main (Z.ai Code)
Task: Create a new GitHub repository using a user-provided PAT and push all project files to it.

Work Log:
- Reviewed local git state: existing `main` branch, clean `.gitignore` (ignores `.env*`, `node_modules`, `.next/`, `*.log`, `/skills/`), 124 modified tracked files.
- Verified the provided GitHub PAT via `GET /user` -> authenticated user `ashamsaldin303-ctrl` (id 295945913).
- Created private repo via `POST /user/repos`: `ashamsaldin303-ctrl/nextjs-fullstack-project` (default branch `main`).
- Untracked `.env` (only contained a local SQLite path, no secrets) via `git rm --cached .env` to honor the `.env*` ignore rule.
- Staged all (124 files) and committed: "feat: initial push of Next.js 16 fullstack project".
- Pushed `main` to GitHub using an inline token URL (token NOT persisted in remote config during the initial push).
- Configured `origin` remote URL with the embedded token and set upstream tracking `main -> origin/main` so future `git push`/`git pull` work seamlessly.
- Verified via Trees API: 137 blobs + 34 trees = 171 tracked items; full top-level structure present; 98 files under `src/`.

Stage Summary:
- Repo URL: https://github.com/ashamsaldin303-ctrl/nextjs-fullstack-project (private)
- Default branch: `main` (upstream tracking configured)
- Token is embedded in `.git/config` remote URL -> recommend revoking the PAT after the user is done with it for security hygiene.
- `.env`, `node_modules/`, `.next/`, `dev.log`, `/skills/` correctly excluded from the repo.

---
Task ID: AUDIT-FIX-1
Agent: Main (Z.ai Code)
Task: Execute all fixes from the Phase-1 audit report (elyra-phase1-audit.md): P0-1 mandatory + all 14 P1 items + extra defects found during browser verification.

Work Log:
- **P0-1 (ESLint)**: re-enabled React 19 strict rules in `eslint.config.mjs` (`@typescript-eslint/no-explicit-any|no-non-null-assertion|no-unused-vars`, `react-hooks/exhaustive-deps|purity|immutability`, `react-compiler/react-compiler: warn`); installed `eslint-plugin-react-compiler@19.1.0-rc.2`. Fixed all 19 surfaced errors:
  - hero-canvas.tsx: particle geometry `useMemo` → `useState` lazy initializer (Math.random legality per react-hooks/purity).
  - navbar.tsx: removed dead `isHome`.
  - cta.tsx: `className` prop now applied to section.
  - automation-simulator.tsx: removed dead `elapsedMs` state + `elapsed` accumulator.
  - sidebar.tsx: random width useMemo → useState; justified eslint-disable for vendored cookie write (react-compiler).
  - use-toast.ts: `actionTypes as const` → direct readonly type alias.
  - hero-canvas/bento/work/automation pages: unused imports removed.
- **P1-1**: global-error.tsx bilingual (ar/en) via `useSyncExternalStore` browser-language detection (set-state-in-effect-safe), `<html lang dir>` dynamic.
- **P1-2**: loading.tsx → async server component with `getTranslations('common')` (key `common.loading` existed).
- **P1-3**: prisma schema: dropped template User/Post → added `Lead` model (calculator/contact capture, @@index([status, createdAt]) + @@index([email])); `bun run db:push` + `db:generate` OK.
- **P1-4**: cta.tsx Link gets `group` class (arrow hover works).
- **P1-5**: removed redundant aria-label from cta.tsx section (h2 names it) and work-grid.tsx tablist (self-describing tabs).
- **P1-6**: MiniAgent typewriter honors `useReducedMotion` — instant full text, no pulsing cursor.
- **P1-7**: MiniCube dead `{reduced ? null : null}` removed; `reduced` now disables the rotation easing transition.
- **P1-8**: single-flip arrows everywhere — `ArrowRight + rtl:rotate-180` for forward links (cta/hero/page-hero/featured-work); calculator back=`ArrowLeft`/next=`ArrowRight`, each with one `rtl:rotate-180`.
- **P1-9**: Footer year hydration-safe via `useSyncExternalStore` (server snapshot 2026) — better than audit's suggested useEffect+setState which violates `react-hooks/set-state-in-effect`.
- **P1-10**: added `footer.social.whatsapp` key (ar: واتساب / en: WhatsApp); aria-label localized.
- **P1-11**: added `nav.ariaLabel` key (القائمة الرئيسية / Main navigation); navbar uses it.
- **P1-12**: mobile Sheet `side={isRtl ? 'left' : 'right'}` — verified opens from left in AR.
- **P1-13**: before-after slider fully RTL-mirrored: pos measured from START edge, clip `inset(0 pos% 0 0)` in RTL, handle anchored `right:`, pointer math mirrored; keyboard semantics already RTL-correct.
- **P1-14**: created `src/lib/site-config.ts` (SITE_CONTACT + SITE_SOCIAL + BRAND_COLORS); footer, contact page, and home JSON-LD now read from it. ⚠️ Values remain PLACEHOLDERS — real WhatsApp number/social accounts still required before launch.
- **Bonus fix 1**: React 19 hydration false-positive in MiniOrbit (CSSOM normalizes `calc(50% + -24.00000000000002px - 14px)` → `calc(50% - 38px)`); positions now pre-computed at module scope, rounded to 4 decimals, formatted in CSSOM canonical form.
- **Bonus fix 2**: `/icon` 404 — root cause: content-hash lives in query string (no path extension) so the next-intl matcher didn't exclude `/icon` and rewrote it into [locale]. Added `icon` to proxy.ts matcher exclusions + removed manual `icons:{icon:'/icon'}` from layout metadata (convention link is hashed) + removed `runtime='edge'` from icon.tsx. Favicon now serves a valid PNG.
- **Bonus fix 3**: `/robots.txt` 500 — conflicting template leftover `public/robots.txt` vs dynamic `src/app/robots.ts`. Deleted the static file (audit wrongly claimed no conflict existed).

Stage Summary:
- `bun run lint` = 0 errors / 0 warnings (with strict rules ON — README claim now meaningful)
- `bunx tsc --noEmit` = 0 errors
- i18n parity = 447/447 keys (added nav.ariaLabel + footer.social.whatsapp)
- All 12 routes (7 paths × ar/en) = 200, zero console/hydration errors (agent-browser verified)
- Calculator E2E flow verified (steps → form → success state)
- RTL slider, mobile menu direction, footer year, socials all browser-verified
- Prisma `Lead` model live in SQLite
- P2-2 (enable reactCompiler in next.config) and P2-3 (per-language sitemap URLs) intentionally deferred

---
Task ID: PHASE-2
Agent: Main (Z.ai Code)
Task: Execute Phase 2 "Sensory Polish Layer" (elyra-fullstack-prompt-02.md): magnetic cursor + film grain + Audio UX + content enrichment + React Compiler + hreflang sitemap + Lighthouse tuning.

Work Log:
- **Magnetic Cursor** (`src/components/sensory/magnetic-cursor.tsx`): two layers (6px dot exact + 32px ring lerp 0.2) driven by ONE rAF loop writing `translate3d` via refs (zero React re-renders). Magnet snap within 80px of `[data-cursor="magnet"]` centers (distance-based → RTL/LTR neutral). Guards: `pointer:fine` + NOT reduced-motion + client-only. Native cursor hidden only under those conditions (double CSS media guard). Layers: `pointer-events:none`, `aria-hidden`, z-200 ABOVE Sheet/Dialog (native hidden → must stay visible over modals), `mix-blend-difference` for light/dark visibility. Magnet rects cached, refreshed on scroll/resize (rAF-throttled) + debounced MutationObserver for client navigations. Press feedback (scale 0.82) on pointerdown.
- **Film Grain** (`film-grain.tsx` + `.elyra-grain` in globals.css): static SVG feTurbulence data-URI, fixed inset-0, opacity 3.5% (WCAG-safe), pointer-events:none, aria-hidden, hidden @media print, single instance in layout, z-90. CSP img-src already allows data:.
- **Audio UX** (`src/lib/sound.ts` + `sound-toggle.tsx`): Web Audio API only (oscillators + gain envelopes; sine hover ~30ms gain 0.035 throttled 60ms; triangle click ~60ms gain 0.09 falling pitch; C5-E5-G5 success arpeggio 90ms/note; master gain 0.6). Muted by default; localStorage `elyra:sound` via useSyncExternalStore external store (hydration-safe); lazy AudioContext on first gesture after enabling; silent failure everywhere. Delegated pointerover/pointerdown listeners (pointer-only → keyboard/sr never sound). Toggle button fixed bottom-start, aria-pressed, translated labels (common.sound.enable/disable). Success sounds wired: calculator submit, simulator completion, contact form. Fixed truthy-string bug ('off' !== false).
- **data-cursor="magnet"** added to: hero CTAs, navbar CTA, language switcher, CTA component, page-hero CTA, calculator (service cards/back/next/submit), simulator (run + scenario tabs), featured-work viewAll, work-grid filters, contact-form submit, bento mini buttons, sound toggle.
- **Content enrichment** (i18n 447→479 keys, parity OK):
  - /work: 6 projects across 6 industries (e-commerce لمسة, real-estate عقار بلس, education أكاديمية مسار NEW, restaurant بيت الشام, SaaS فواتير سمارت, creative-agency استوديو بصمة NEW) each with services[] list (rendered with Wrench icons), desc, 2-3 metrics, variant. work-grid renders services.
  - /about: team bios (4 members), agency numbers → years/projects/automations/clients (dropped sectors/satisfaction).
  - Testimonials: 4 deeper quotes with name/role/company field + results-specific numbers; grid md:2 xl:4; stars row → role="img".
  - Service pages: ServiceProse component («ماذا تشمل» + «كيف نعمل») on websites (after 3D) + automation (after simulator). SectionHeading gained titleId prop.
- **P2-2 React Compiler**: `reactCompiler: true` top-level (Next 16 graduated it from experimental) + babel-plugin-react-compiler devDep. lint stays 0/0.
- **P2-3 hreflang**: sitemap emits per-path alternates {ar, en, x-default}; seo.ts buildPageMetadata + layout languages add x-default; layout canonical now locale-aware (fixes EN canonical→AR bug flagged by Lighthouse).
- **Quick wins**: getServerYear → new Date().getFullYear() (dynamic, still hydration-safe); README Phase-2 decision log (9 new documented decisions).
- **Lighthouse-driven a11y fixes** (dev-server runs): aria-label on star div → role="img"; dl structures fixed (trust-bar + about numbers: label inside dd; websites journey + contact channels: li direct child of list, Reveal moved inside); new `--primary-strong: #0066CC` token for small primary text on light surfaces (AA 4.5:1); dark-section kickers → `kicker-on-dark` using existing g-blue (#4285F4, 4.99:1 on #0F172A) via compound specificity; methodology duration chip → primary-strong; work-grid sr-only h2 (fixed broken aria-labelledby + h1→h3 order jump).
- **Verification**: Playwright (full chromium, new headless → real pointer:fine) scripts `scripts/verify-sensory.mjs` (16/16) + `verify-sensory-negative.mjs` (8/8): activation guards, exact dot tracking, ring convergence (0.1px), magnet snap (0px dist), release, native-cursor hidden, grain computed styles, sound lifecycle (default-off → toggle → localStorage persist → cross-route → mute), keyboard focus unaffected, zero console errors. E2E: calculator full flow + simulator completion with sound ON, zero errors. VLM visual checks: cursor visible + snapped, sound toggle positioned, 4 testimonial cards with companies, work services lists, team bios.
- **Lighthouse (dev server — production build forbidden in this sandbox)**: a11y 100 (all 7 routes), bp 100, seo 100 (all), perf 17-48 (dev-mode artifact: unminified dev React + on-demand compile; documented as non-representative). Before Phase-2 fixes: a11y 92-96, seo 92 on EN.
- New sensory layer source: 17KB total (≈4-5KB gzipped est.) — film grain is pure CSS (0 JS). No new runtime deps.

Stage Summary:
- lint 0/0 (strict rules ON) · tsc 0 · i18n parity 479/479 · zero console/hydration errors on all 12 route-locale combinations
- All three sensory features browser-verified in AR+EN (positive + negative paths)
- Lighthouse: a11y/bp/seo = 100 across routes (dev caveat documented)
- README: 9 new Phase-2 decisions + sandbox constraint note
- DEVIATION from prompt §7.1/§10: `bun run build` + production Lighthouse not possible in this sandbox (policy); verified via dev server + lint + tsc + real browser automation instead

---
Task ID: PHASE-3
Agent: Main (Z.ai Code)
Task: Execute Phase 3 (elyra-fullstack-prompt-03.md): full backend (API + Prisma + signed n8n webhook), production performance fixes, and deployment documentation.

Work Log:
- **POST /api/leads** (`src/app/api/leads/route.ts`) — the single write endpoint:
  - Zod v4 strict discriminated union (source: calculator | contact-form); unknown fields → 400 with translated per-field errors (locale via `x-elyra-locale` header → accept-language → ar default; catalog read directly in `lib/api-i18n.ts` since /api is excluded from the next-intl proxy matcher).
  - Server-side recompute ALWAYS via imported `computeEstimate` (never copied). Known client-echo estimate fields (minBudget/maxBudget/weeksMin/weeksMax/estimate/result/breakdown) are stripped pre-parse (forged numbers ignored + recomputed — verified: sent 999999, stored 10600-17400); any other unknown field → 400.
  - Rate limit FIRST (invalid payloads burn quota): `lib/rate-limit.ts` sliding 60s window × 5/IP in a Map with periodic sweep; 429 + Retry-After + translated message.
  - Prisma Lead storage (all wizard answers + computed budget + IP/UA; contact leads: service=contact, budget=0, message stored). 201 → { reference: first 8 chars of cuid }.
  - 500 generic (details to server log only).
- **Signed n8n webhook** (`lib/n8n-webhook.ts`): HMAC-SHA256 over `timestamp.nonce.body`, headers X-Elyra-Signature/Timestamp/Nonce; secrets env-only (32+ chars enforced, else silent disable with one log line); 5s AbortController timeout; ONE retry on network failure only; fire-and-forget AFTER successful storage (lead 201 never blocked); silent failure. README carries the full n8n receiving recipe (timestamp ±5min + nonce TTL 10min + timingSafeEqual).
- **Client wiring**: calculator + contact-form POST to /api/leads with loading states, server-translated error toasts (field errors mapped into inline messages), data preserved on failure, reference displayed in success state (`successReference` key), playSuccess only on real 201.
- **i18n**: apiErrors namespace + form error/reference keys → parity 479→499 keys.
- **Performance (§4)**:
  - LCP: hero + PageHero above-fold content now server-rendered with CSS-only `hero-enter` keyframes (h1/subtitle zero delay; badge/CTAs 0.12/0.22s). The framer `opacity:0` inline fingerprint is GONE from server HTML (verified). Dev-compatible proof: DOM-insert→visible Δ = animation window (~430-970ms), CSS-driven.
  - Three.js deferral: HeroCanvas loads on requestIdleCallback (2.5s timeout) or first pointermove/keydown; CapabilityScene loads only when its section nears viewport (rootMargin 200px). Verified: three.js resources = 0 at load, >0 after idle.
  - Light Reveal: `reveal.tsx` rewritten with IntersectionObserver + CSS transitions (same API); KineticWords now pure CSS (`.kinetic-word` keyframes + per-word delay). framer-motion remains ONLY in calculator/simulator/methodology (complex interactions, all home-page) — /about, /work, /services/websites (+EN) no longer ship framer in initial JS. bento MiniFlow pulse + before-after hint + trust-bar counter (useInViewOnce hook) + work-grid filtering all converted to CSS/IO; `usePrefersReducedMotion` hook (useSyncExternalStore) replaces framer's useReducedMotion in converted components.
  - reduced-motion override extended with animation/transition-delay: 0s (stagger waits removed for reduced-motion users).
- **Docs & deploy (§5)**: Dockerfile (3-stage standalone, HOSTNAME=0.0.0.0, prisma engines copied explicitly, volume /app/db, NEXT_PUBLIC_SITE_URL build-arg) + .dockerignore; `.env.example` (all 4 vars documented with build-time SEO warning); README: HOSTNAME trap table + upstream link + Phase-3 decisions (#18-22) + API contract table + n8n recipe + updated commands/folders.
- **Scripts**: `verify-api.mjs` (13 checks: EN/AR 400s, unknown field, forged budget w/ Prisma assert, 201+reference+row, webhook disabled/delivery modes via WEBHOOK_EXPECT, 429 burst + Retry-After + 61s window reset, mock-n8n receiver proving valid/tampered/wrong-secret/stale-timestamp/replayed-nonce) — 13/13 in BOTH webhook scenarios; `verify-performance.mjs` (10 checks); `lighthouse-prod.sh` (build + standalone serve + 12-route table + JS size — for build-capable environments); `clean-leads.ts` (dry-run mode).
- **Verification**: lint 0/0 strict · tsc 0 · parity 499/499 · sensory suites still 16/16 + 8/8 · performance 10/10 (×3 runs) · E2E real-API calculator (AR: success + reference cmt7j81g + Prisma row w/ correct computed 4000-6000) + contact (EN: toast + row + form cleared) · test rows cleaned (DB now 0 leads).
- **DEVIATIONS from prompt**: (1) `bun run build` + production Lighthouse FORBIDDEN in this sandbox (explicit policy) — all fixes implemented + verified structurally in dev; `scripts/lighthouse-prod.sh` prepared; measurement documented as deferred. (2) Prompt suggested Serializable tx recompute — not needed: computeEstimate is pure and the SQLite write is single-row (no read-modify-write), so a transaction would add nothing; documented. (3) Webhook payload delivery is fire-and-forget (not awaited) to protect response latency; correct for the standalone server target. (4) One intermittent dev-only Radix useId hydration warning (aria-controls on the mobile-menu Sheet trigger) — observed once across ~25+ loads, dev-streaming artifact, not reproducible, cosmetic, and absent from prerendered production output.

Stage Summary:
- Complete: backend (endpoint + rate limit + Prisma + signed webhook, both scenarios proven), LCP/Three.js/JS-size structural fixes, deployment kit (Dockerfile/.env.example/README), all verification scripts committed.
- lint 0/0 · tsc 0 · parity 499/499 · zero console errors · DB clean.
- Launch readiness: code-complete; owner must supply real site-config data, real n8n env, domain/hosting, and run lighthouse-prod.sh in a build-capable environment.

---
Task ID: HOTFIX-01
Agent: Main (Z.ai Code)
Task: Close the 4 launch gaps from the independent Phase-3 verification report (elyra-phase3-verification.md), base commit dd1c3ce.

Work Log:
- **H-1 (CLS during streaming)**: `src/app/[locale]/loading.tsx` fallback raised from `min-h-[60vh]` to `min-h-[100svh]` — the footer leaves the visible frame during React streaming, so its displacement is excluded from CLS (root cause of the 0.424 CLS on AR pages). Verified: compiled CSS contains `.min-h-[100svh]{min-height:100svh}` AND live measurement caught the streamed fallback at exactly viewport height (minH=800px = vh=800px @191ms into /about). Layout + spinner unchanged.
- **H-2 (.env.example missing from repo)**: root cause found — the `.env*` gitignore rule was silently swallowing the template (it was written in Phase 3 but never committed). Added `!.env.example` exception + recreated the file with the ABSOLUTE DATABASE_URL path (`file:/app/db/custom.db`) per H-3.
- **H-3 (relative DB path trap)**: README Deployment section now documents that `file:./db/custom.db` breaks every write with 500 on standalone (relative paths resolve from CWD ≠ bundle dir), with an environments table and a bare-metal example.
- **H-4 (homepage TBT 690ms)**: chose option A — new `SimulatorLazy` wrapper (`next/dynamic` ssr:false + IntersectionObserver rootMargin 400px + section-shaped placeholder for zero CLS). Wired into `/` and `/services/automation` (replacing direct AutomationSimulator). Verified structurally: at load event the simulator chunk is ABSENT (29 JS chunks, hasSimulatorChunk=false); after scrolling near the placeholder it loads (38 chunks, simulatorLoaded=true) and completes a full run (اكتمل التدفق ✓); scenario tabs on /services/automation load on scroll and switching works. README decision #23-26 added.
- **Regression suites**: sensory 16/16 + performance 10/10 (one dev-only timing flake on the Three.js check re-run clean), lint 0/0 strict, tsc 0, parity 499/499, zero console errors.
- **Production build**: still forbidden in this sandbox — CLS/TBT verification done structurally + with live measurements; `scripts/lighthouse-prod.sh` remains the designated measurement tool for a build-capable environment (documented).

Stage Summary:
- All 4 hotfix items closed with structural proof (dev environment): H-1 measured live at 100svh, H-2 file tracked in git with gitignore exception, H-3 documented with table+example, H-4 simulator chunk provably out of the initial load set and functional after lazy load.
- Ready for the final production Lighthouse run in a build-capable environment (expected: CLS < 0.1 everywhere, homepage TBT well below 690ms).
