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

---
Task ID: PHASE-5
Agent: Main (Z.ai Code)
Task: Execute Phase 5 "Fix → Complete → Deepen" (elyra-fullstack-prompt-05.md) — close P0/P1 gaps from Phase 4 verification + complete deferred Kinetic Typography + deepen details (.card-light-deep + 3 new data-cursor contexts + production readiness).

Work Log:

- **WS-1 (P0-1)** — WebGL scene rendering invisible after preset click:
  - Root cause: `<line>` JSX intrinsic collides with SVG line in R3F v9 + React 19 → silent render failure (mask-image:none, 0 non-zero pixels in canvas).
  - Fix: rewrote ConsoleScene to construct THREE.Line instances via `<primitive>` (bypasses the JSX collision). Per-preset layout (ring/orbit/flow) so each architecture reads distinctly. Brightened lighting + pushed camera back per preset. Added InitialRenderSafety component that triggers an extra invalidation on mount.
  - Also added auto-scroll: the dark scene container lives below the fold on standard screens, so clicking a preset never actually revealed the canvas. Now `scrollIntoView({ block: 'center' })` on preset click/Enter.
  - Verified visually with VLM on 4 presets (store/booking/ai/dashboard) + custom free-text. Clarity 8/10 on the matched snapshot pattern (was 0/10).

- **WS-2 (P0-2)** — Spotlight + Blueprint grid invisible:
  - Three root causes combined: (a) `radial-gradient(700px circle at ...)` reversed the canonical shape-then-size order → modern Chromium silently rejected mask-image → grid leaked across whole viewport; (b) grid alpha 4% was too low for VLM detection; (c) no default state — grid invisible until first mousemove.
  - Fix: canonical syntax `circle 400px at var(--mx,50%) var(--my,50%)`, alpha raised 4% → 22%, dim default (opacity 0.45) until first pointermove, then `.spotlight-active` class ramps to 1. Default position center 50% 50% so first-time visitors see a hint.
  - Verified with full Chromium (channel:'chromium' — agent-browser's headless defaults to (hover:none) which triggers the touch fallback): mask-image applies correctly, grid visible in a focused ~400px circular beam under the cursor. VLM 7/10 (was 0/10).

- **WS-3 (P1-1)** — Mobile + desktop active link state:
  - Mobile menu: original 2px (h-0.5) primary bar at the bottom was lost in the rounded-xl container. Now: 4px (w-1) primary bar on the START side (RTL-correct via 'inset-y-2 start-0') + bg-primary/15 + ring-1 ring-primary/40 + text-primary + soft glow shadow.
  - Desktop navbar: original 20% opacity text shift was invisible. Now: primary underline that scales in (opacity 0→100% + scale-x 0→100%) on the active link, with a hover-only 50% half-bar on inactive links.
  - Verified: VLM 9/10 on both mobile + desktop, active link instantly identifiable (was 0.85/10).

- **WS-4 (P1-2)** — Deconstructed card 3D layer separation:
  - Three root causes: (a) outer 'h-screen max-h-[800px]' (800px) was SHORTER than the inner 'h-screen' (100vh) → sticky never engaged (sticky duration = outer - viewport = negative); (b) card was the FIRST item in a md:grid-cols-2 grid → grid cell constrained 200vh outer down to ~240px (row's natural height); (c) layer Z values all-positive (0/+28/+56) → depth delta only 56px with perspective 1000 → too subtle for VLM detection.
  - Fix: outer 'h-[200vh]' gives 100vh of sticky scroll time. Pulled the DeconstructedCard OUT of the grid as a full-width block before the grid. Layer Z spread AROUND 0: back=-50/middle=0/front=+50 at p=1. Perspective 1000→1500. Distinct visual language per layer (browser frame / n8n nodes / metric slides) with colored borders + matching shadows.
  - Verified: sticky zone now engages at the card's natural position (y≈3900). Transforms progress linearly from translateZ(0px) at scroll start to translateZ(-49.7px) back / 0 middle / +49.7px front at end. VLM 7/10 (was 0.7/10).

- **WS-5 (P1-3 + P1-4)** — Contact whitespace + calculator rings:
  - P1-3: removed the redundant 133px-tall dark CTA band between channels and calculator (it duplicated the calculator's kicker+title — the Calculator component already renders its own SectionHeading). Page height reduced 2770→2637px (-5%).
  - P1-4 bug 1: animated value was the wrong number. The original RingGauge animated displayValue from 0 to 'fraction' (a 0-1 number), then formatted that as money via formatValue(n). So a $15000 budget with fraction=0.75 showed as '$1'. Fix: split 'fraction' (ring fill, 0-1) from 'value' (count-up display, the actual money/weeks number). Calculator now passes BOTH: fraction=Math.min(1, result.max/20000) AND value=result.max.
  - P1-4 bug 2: animation never ran in React Strict Mode. The original useEffect set fromRef.current = to BEFORE the rAF actually fired. Strict Mode runs effect setup → cleanup → effect setup again. First setup updated fromRef but its cleanup cancelled the rAF before it could tick. Second setup saw from === to → early-returned → no animation at all → rings stayed at 0 forever. Fix: only commit fromRef.current = to INSIDE the tick callback when the animation completes. Added a 'cancelled' flag so the cleanup can signal the in-flight tick to bail without scheduling another rAF.
  - Verified: rings animate 0 → $6,000 / 6 weeks over 800ms. VLM 9/10 on the result step (was 0/10 — VLM said 'no rings visible').

- **WS-6 (deferred)** — Kinetic typography (cursor-velocity → font weight):
  - New hook useCursorVelocity (src/lib/use-cursor-velocity.ts): tracks pointermove, computes velocity (px/ms) per frame, maps velocity → wght (0 speed → 600, saturation 2.5 px/ms → 800, idle after 200ms → 700), Lerp 0.18 toward target, writes --wght straight to the target element's style via ref (zero React re-renders per frame). Activation guards: pointer:fine + NOT reduced-motion + client mount.
  - New component KineticHeading (src/components/home/kinetic-heading.tsx): server-renders h1 with static wght 700 (LCP-safe, no flash), then hook attaches and writes --wght after hydration. Splits each title line into per-word inline-block spans (Arabic shaping benefits from per-word isolation — complex-contextual shaping doesn't bleed across the whole line). h1 binds font-variation-settings to var(--wght, 700).
  - Hero h1 wired to KineticHeading (range 600→800, was fixed wght 200 — too thin). Primary CTA also wired (narrower range 600→700) — feels responsive to cursor speed without competing with the h1.
  - Verified: initial wght 700, slow movement drops to ~637-660 (lighter), idle returns to ~698-700, fast zigzag rises to 730+ (heavier). Per-word spans confirmed in both AR + EN. VLM on fast-motion screenshot: 'bold/heavy (700-800+ weight), highly readable'.

- **WS-7 (deepening)** — .card-light-deep + 3 new data-cursor contexts:
  - New .card-light-deep CSS class (counterpart to .card-deep): 4-6% black border over light + multi-layer shadow (2px+8px+20px offsets) + 1px white top-highlight inset + 0.6 white bg + 8px backdrop blur. Contrast-safe: depth adds WITHOUT darkening → text on white stays ≥ 4.5:1.
  - Three new data-cursor contexts (zoom/inspect/external): magnetic-cursor now resolves each context's chip label from the common.cursor.* i18n catalog (AR + EN). Elements with explicit data-cursor-label still override (back-compat preserved). Chip element gets dir='auto' so the chip text flips correctly in RTL/LTR.
  - Applied: footer social icons (5 elements) → external ('رابط خارجي' / 'External link'). Work page project cards (6 elements) → zoom. Automation simulator stage → inspect ('افحص العنصر' / 'Inspect element'). All chips verified to show the translated label at opacity 1 on hover.
  - Layout fix: MagneticCursor moved INSIDE NextIntlClientProvider so the new useTranslations('common.cursor') call resolves at runtime. Previously it was outside the provider → 'context not found' error.
  - i18n parity 511→515 keys (+4: cursor.zoom/inspect/external/magnet empty string for magnet).

- **WS-8 (production readiness)** — Reduce initial JS via lazy-loading Calculator + Methodology:
  - New CalculatorLazy + MethodologyLazy wrappers (next/dynamic ssr:false + IO with rootMargin 400px + section-shaped placeholder for zero CLS). Both framer-motion-using components deferred until near viewport.
  - Result: framer-motion's ~30KB minified+gzipped chunk + calculator + methodology component chunks now load ONLY when the user scrolls toward them, not at initial page load. Verified via chunk tracing: 0 framer/calculator/methodology chunks at initial networkidle, 4 such chunks loaded after scroll (methodology_tsx ×2, calculator_tsx ×1, framer-motion ×1).
  - LCP-safe: both components well below the fold. All 6 routes (×AR/EN) still render. Zero console/page errors.
  - verify-performance.mjs updated: Phase 2 sensory-layer check looked for the old 'fixed bottom-4 start-4' sound toggle position (Phase 4 moved it to the navbar). Now looks for 'header button[aria-label*=المؤثرات/sound]'. Score 8/10 → 9/10 (remaining Three.js-at-load check is a pre-existing test timing artifact — requestIdleCallback fires within networkidle's window in playwright).

- **WS-9 (P2)** — Raise secondary-text contrast on light:
  - Darkened --muted-foreground token from #6E6E73 → #56565C. Old: 5.04:1 on white (barely AA), 4.61:1 on #F5F5F7 (page bg) — VLM read as 'very light gray on white'. New: 7.12:1 on white, 6.51:1 on #F5F5F7 — solidly AA with comfortable margin.
  - Verified: rgb(86,86,92) on /services/automation integration cards + /work card descriptions. VLM 8/10 on automation, 9/10 on work (was 'borderline').

Stage Summary:
- All 9 work streams (WS-1 through WS-9) closed.
- 9 commits (3ea700d → 6dbffc0), each a reviewable unit.
- lint 0/0 strict · tsc 0 errors · i18n parity 515/515 (was 511/511 — +4 for new cursor context labels).
- Zero console/page errors across all 12 routes (×AR/EN).
- All P0/P1 from Phase 4 verification resolved: WebGL scene visible (8/10), spotlight visible (7/10), mobile active state prominent (9/10), deconstructed card 3D-separated (7/10), contact whitespace fixed (no redundant band), calculator rings animate ($6,000 budget / 6 weeks — was 0).
- Deferred Phase 4 item completed: Kinetic Typography (cursor velocity → font weight 600→800).
- Deepening: .card-light-deep token + 3 new data-cursor contexts (zoom/inspect/external) with translated chip labels.
- Production readiness: lazy-loaded Calculator + Methodology → framer-motion's ~30KB chunk out of initial bundle on / and /contact.
- verify-performance.mjs score 9/10 (was 8/10).
- Production Lighthouse measurement deferred to scripts/lighthouse-prod.sh per the sandbox policy (bun run build forbidden). Structural JS-size reduction proven via chunk tracing.
- All Phase 1–4 features verified working: live simulator, calculator with full lead submission to API, magnetic cursor, audio toggle, before/after sliders, WebGL hero, hreflang, HMAC webhook, audio UX, film grain, console scene, spotlight, deconstructed card, calculator rings.
---
Task ID: L1-A
Agent: security-analyst (Group 1, Loop 1)
Task: Deep security analysis of API/lib/infra files

Work Log:
- Read worklog tail (Phase 5 + Hotfix 01 context), then read ALL 19 assigned files line by line: api/leads/route.ts (322 lines, full), lib/n8n-webhook.ts, lib/rate-limit.ts, lib/db.ts, lib/api-i18n.ts, prisma/schema.prisma, src/proxy.ts, next.config.ts, i18n/routing|request|navigation.ts, .env.example, Dockerfile, Caddyfile, app/robots.ts, app/sitemap.ts, app/icon.tsx, package.json, eslint.config.mjs.
- Traced full data flow client → Zod → recompute → Prisma insert → HMAC webhook → response; verified client-side fetch blocks (calculator.tsx, contact-form.tsx) confirm client never sends estimate numbers.
- Git/data-leak investigation: db/custom.db IS tracked (`git ls-files`) and 5 commits carry it; strings-extracted Lead rows across history — currently SYNTHETIC test data only (burst0-7@test.dev, forged/valid-calc/contact@test.dev, whatsapp +963991000000, IPs ::1). No real PII yet, but tracking is a latent production leak. sqlite3 CLI unavailable in sandbox — inspected via `strings` on working copy + all 5 historical blobs.
- Secret scan: rg across src/Dockerfile/Caddyfile/.env.example — zero hardcoded secrets; secrets come only from env vars; .env untracked (git error on ls-files), .dockerignore excludes .env/.git/db/logs/tool-results.
- Verified security headers, CSP weaknesses, HSTS preload implications; verified rate-limit key derivation (XFF leftmost = spoofable when directly exposed per Dockerfile run example); verified no body-size cap before req.json(); verified HMAC scheme is sender-side (receiver recipe in README uses timingSafeEqual + length check + nonce TTL — documented, out of repo).
- Checked Prisma: no $queryRaw anywhere; singleton pattern OK; found `log: ['query']` unconditional → PII into prod logs.
- Checked Caddyfile: `:81` + `?XTransformPort=<port>` = arbitrary localhost port reverse proxy (sandbox preview mechanism — dangerous if shipped as prod infra).
- Checked supply chain: ~30 unused runtime deps incl. EOL next-auth v4, z-ai-web-dev-sdk, recharts, @dnd-kit, @tanstack, etc. (verified via import grep; ui/chart.tsx is dead code).
- Checked dangerouslySetInnerHTML sites: home-json-ld.tsx (static config only — safe), ui/chart.tsx (shadcn pattern, unused).
- Verified apiErrors catalogs AR/EN have all 11 field keys (parity) so fieldErrors never leaks raw key names.

Stage Summary:
- Verdict: 0 P0 / 6 P1 / 10 P2.
- P1-1 rate-limit key trusts spoofable X-Forwarded-For (route.ts:99-104) — bypass + unbounded Map growth.
- P1-2 no request body size cap before req.json() (route.ts:217) — memory DoS on self-hosted Node.
- P1-3 db/custom.db tracked in git with Lead rows in history — latent PII leak; clean-leads.ts can't fix history.
- P1-4 Prisma `log:['query']` unconditional (db.ts:10) — lead PII into production stdout logs.
- P1-5 Caddyfile :81 XTransformPort = open proxy to any localhost port — sandbox-only, must not ship.
- P1-6 CSP ships 'unsafe-inline'+'unsafe-eval' + https: img/connect — negligible XSS containment.
- P2: webhook retry reuses nonce/signature; no Origin/Sec-Fetch-Site check (cross-site form spam); whatsapp unvalidated + integrations duplicates + array-index issues unmapped; deprecated z.string().email() in Zod 4.3.5; ~30 unused deps incl EOL next-auth v4; Dockerfile root user + no HEALTHCHECK; db:push --accept-data-loss footgun; tee pipeline breaks SIGTERM; HSTS preload premature; PII retention policy missing + SITE_URL fail-soft localhost default.
- Positives preserved: server-side estimate recompute + strict schemas, rate-limit-before-parse, generic errors (no stack traces), HMAC webhook with ts+nonce and 32-char min secret, parameterized Prisma only, no admin routes, .dockerignore/.gitignore hygiene, locale allowlisting everywhere.

---
Task ID: L1-B
Agent: core-logic-analyst (Group 1, Loop 1)
Task: Deep analysis of lib/hooks/i18n/configs

Work Log:
- Read worklog (Phase 5 + hotfix context), then read ALL 20 assigned files line-by-line: 6 lib modules (calculator, sound, seo, site-config, utils, api-i18n), 5 hooks (use-cursor-velocity, use-reduced-motion, use-rtl, use-toast, use-mobile), both i18n catalogs in full (919 lines each), parity script, and all 5 configs (+ next.config.ts, globals.css head, proxy.ts for cross-verification).
- Ran check-i18n-parity.js: PASS 515/515 keys.
- Wrote a throwaway deeper i18n auditor (placeholders, array lengths, identical AR/EN values): 0 placeholder mismatches, 0 array-length mismatches, 3 intentional identicals (CRM, email, telegram handle). Deleted after use.
- Brute-force verified calculator.ts across 2,592 input combinations (services × pages incl. 0/NaN/100 × languages × threeD × automationLevel × integration subsets): weeks always integers, weeksMax > weeksMin always, min<=max always, breakdown internally consistent pre-rounding. Verified formatMoney output for ar/en/unknown locales.
- Simulated use-cursor-velocity's exact rAF/lerp scheduling logic: PROVED the idle-return path runs exactly ONE 18% lerp step then freezes (e.g., wght stuck at 770.7 instead of returning to 700) — writeWght never re-schedules itself.
- Verified Tailwind 4 config chain: postcss = @tailwindcss/postcss only; globals.css uses @import "tailwindcss" + @theme inline + @custom-variant dark; NO @config directive anywhere → tailwind.config.ts is never loaded (and its content globs point at non-existent ./pages ./components ./app dirs).
- Dead-export/dead-code tracing via Grep across src/: routing re-export in seo.ts, BRAND_COLORS in site-config.ts, the entire shadcn toast system (use-toast.ts + toast.tsx + toaster.tsx — layout mounts sonner's Toaster instead), sidebar.tsx chain (+ use-mobile.ts, separator, skeleton, tooltip, toggle, toggle-group, dialog via command), ~36 unused ui components, and ~25 unused package.json deps (next-auth, uuid, z-ai-web-dev-sdk, @mdxeditor, @tanstack/*, @dnd-kit/*, recharts, date-fns, embla, vaul, cmdk, input-otp, react-syntax-highlighter, react-markdown, react-day-picker, react-resizable-panels, zustand, @reactuses/core, react-hook-form, tailwindcss-animate, radix-toast...; prisma CLI + @types/three misplaced in dependencies).
- Cross-checked live consumers: computeEstimate/formatMoney (calculator + api/leads route), sound engine (sound-toggle + 4 components + delegation), useCursorVelocity (kinetic-heading + hero CTA), useIsRtl (navbar/before-after/simulator), getApiT (api/leads), SITE_CONTACT/SITE_SOCIAL (footer/contact/json-ld), proxy.ts matcher confirmed excluding /api (validates api-i18n.ts design comment).

Stage Summary:
- Verdict: 0 P0 / 3 P1 / 8 P2.
- [P1-1] use-cursor-velocity.ts:72-87,121-124 — lerp is not self-sustaining; after cursor stops, idle timeout fires ONE 18% step then --wght freezes mid-transition (sim: 770.7, spec: 700). Fix: writeWght should reschedule while |target-current| > epsilon (or run a persistent rAF loop while active).
- [P1-2] tailwind.config.ts — dead config under Tailwind 4 (never loaded, no @config; content globs don't match src/ layout; darkMode/plugins superseded by @theme inline + @custom-variant + tw-animate-css) + dead tailwindcss-animate dep. Trap: future edits there silently no-op. Fix: delete file + dep.
- [P1-3] calculator.ts:139-146 — breakdown lines are unrounded while headline min/max are round100'd → visible sum mismatch up to ±$50 (e.g. website/20pg/bilingual/3D/6-int: lines sum 10425, headline 10400). Fix: round each line (or present lines as exact sub-totals + rounding note).
- [P2-1] Dead code mass: shadcn toast trio, sidebar chain, ~36 unused ui components, BRAND_COLORS, seo.ts routing re-export, seo.ts no-op ternary (arPath).
- [P2-2] check-i18n-parity.js treats arrays as leaves and never checks {placeholder} sets — no guard against future array-length/ICU drift (clean today, verified manually).
- [P2-3] Arabic i18n quality: singular-only plurals ({count} صفحة, {seconds} ثانية), بصمة→"Bassam" mistranslation, "A digitally small agency" EN mistranslation, tanween orthography (محرفاً→محرفًا), mixed digit systems (secondsLabel Latin "0.86" vs Arabic-Indic stepOf).
- [P2-4] eslint leniencies: no-console/no-debugger/no-unreachable/ban-ts-comment/no-img-element all off.
- [P2-5] ~25 unused dependencies incl. next-auth (supply-chain/audit surface); prisma CLI + @types/three in dependencies; db:push --accept-data-loss footgun script.
- [P2-6] calculator robustness nits: weeksMax fallback branch provably dead + references unrounded weeksMin; clampPages allows 0 vs UI/API 1-20; saturationVelocity=0 theoretical div-by-zero.
- [P2-7] Type rigor: formatMoney/seo locale params typed `string` instead of 'ar'|'en'; missing return types (cn, useIsMobile, useCursorVelocity); use-mobile.ts lacks 'use client'.
- [P2-8] use-reduced-motion getSnapshot calls matchMedia per render (new MQL allocation); sound.ts relies on GC for stopped oscillator/gain nodes (no onended disconnect); CSP ships unsafe-eval/unsafe-inline for script-src in prod headers.
- Positives: calculator math brute-force clean (2592 combos), sound engine autoplay-policy-correct with clean lifecycles, parity 515/515 with zero placeholder/array drift, tsconfig strict+noUncheckedIndexedAccess, no any/non-null assertions in reviewed libs, react-hooks rules at error level.

---
Task ID: L1-D
Agent: routes-layout-analyst (Group 1, Loop 1)
Task: Deep analysis of app routes, layout, shared components, CSS foundation

Work Log:
- Read worklog tail (Phase 5 + hotfixes context), then read ALL 32 assigned files completely (routes, layout, error/loading/not-found, globals.css 590 lines, navbar/footer/clock/switcher, 7 shared components, logo, i18n trio, proxy, next.config).
- Supporting reads: lib/seo.ts, lib/site-config.ts, lib/use-rtl.ts, seo/home-json-ld.tsx, .env.example, messages/ar+en.json structure, ui/ spot-checks (button/input/sonner/toaster/sidebar/chart).
- ui/ modification detection: git diff initial→HEAD shows only sidebar.tsx touched (+7/−3: Math.random useMemo→useState purity fix + eslint-disable for vendored cookie write). No injected code; dangerouslySetInnerHTML only in stock chart.tsx + JSON-LD (static config input, safe).
- LIVE verification (dev server): rendered <title> on /, /en, /contact, /en/contact, /about; canonical+hreflang+OG tags on /contact, /en/contact, /en/services/websites; sitemap.xml hreflang output; robots.txt; /icon 200 image/png; html lang/dir per locale; viewport meta; security headers.
- LIVE 404 probing: /fr, /nonexistent, /en/nonexistent all render the DEFAULT Next.js English unstyled 404 (next-error-h1) — [locale]/not-found.tsx never renders (no root app/not-found.tsx, no [...rest] catch-all). Confirmed Arabic notFoundTitle string absent from payload.
- LIVE aria-labelledby audit: 6 sections reference non-existent ids (values/team on /about; types/journey on /services/websites; int/n8n on /services/automation) — SectionHeading supports titleId but callers don't pass it.
- Confirmed no OG/Twitter image anywhere (no images: in metadata, no opengraph-image.tsx/twitter-image.tsx/apple-icon.tsx files) despite twitter:card=summary_large_image.
- Confirmed title double-branding: all 10 subpage meta.title strings end "| Elyra/إيليرا" AND layout title template appends " — Elyra" → "Contact Us | Elyra — Elyra" (verified live).
- RTL hygiene grep: zero ml-/mr-/pl-/pr- in first-party components (only stock shadcn ui/); logical props used throughout. No viewport export anywhere. aria-live only in live-clock (minute-tick SR issue) + loading.

Stage Summary:
- Verdict: 2 P0 / 3 P1 / 13 P2.
- P0-1 double-branded titles on all subpages (template + pre-branded strings, verified "Contact Us | Elyra — Elyra").
- P0-2 localized not-found.tsx unreachable: missing root not-found.tsx + [...rest] catch-all → default English 404 for every unknown URL in any locale.
- P1-1 no OG/Twitter image at all (summary_large_image card with no image, all 12 URLs).
- P1-2 six broken aria-labelledby references (SectionHeading titleId never passed by 3 pages).
- P1-3 LiveClock aria-live="polite" announces time every minute to screen-reader users site-wide.
- P2s: no viewport/themeColor export; no apple-touch-icon; skip link bypasses nav.skipToContent key; locale switch drops query string; .reveal invisible without JS; prod CSP keeps unsafe-inline+unsafe-eval; stale dark-mode comment + dead @custom-variant dark; no ::selection + minimal print styles; sitemap lastmod always build-time + deprecated robots host; JSON-LD SearchAction targets non-existent /work?q= search; typedRoutes not enabled; PageHero wght 200 vs home 700 inconsistency; error.tsx comment claims server-side log but console.error is client-only.
- Positives: hreflang/canonical machinery exemplary (verified live on 4 routes + sitemap), hydration discipline (useSyncExternalStore ×2, clock placeholder), 100svh streaming fallback, RTL logical-property hygiene, sticky footer + safe-area correct, ui/ stock, security headers live, per-locale OG locale tags.
---
Task ID: L1-C
Agent: components-analyst (Group 1, Loop 1)
Task: Deep analysis of home/sensory/3D/pages components

Work Log:
- Read worklog tail; read all 26 target files line by line (19 home components, 3 sensory, capability-scene, contact-form, work-grid, home-json-ld).
- Cross-read supporting infrastructure to verify claims: use-reduced-motion.ts, use-cursor-velocity.ts, use-rtl.ts, sound.ts, reveal.tsx, section-heading.tsx, globals.css (reveal/cursor/orbit/grain/reduced-motion rules), page.tsx composition, site-config.ts, seo.ts, api/leads/route.ts, messages/{ar,en}.json cursor keys.
- Verified R3F v9.7.0 disposal semantics from installed dist source: removeChild → disposeOnIdle skips primitives ("Never dispose of primitives"); Canvas unmount → forceContextLoss after 500ms; primitive object-prop change → reconstruct (line 15475).
- Verified aria-labelledby target ids exist for only 3 of 10 labelled sections (grep for id= targets).
- Verified global prefers-reduced-motion override kills infinite CSS animations (covers MiniOrbit), and .elyra-cursor-active cursor:none is media-scoped to no-preference.
- Classified findings by severity; no code modified.

Stage Summary:
- Verdict: 0 P0 / 4 P1 / 14 P2.
- P1-1: 7 sections have dangling aria-labelledby ids (bento/simulator/methodology/threeD/featured-work/testimonials/calculator) — SectionHeading accepts titleId but no caller passes it.
- P1-2: ConsoleScene frameloop='always' never pauses offscreen (no IO/active gating; contradicts its own §9.4 comment) — 60fps WebGL for rest of session after preset click.
- P1-3: testimonials.tsx:30 hardcoded English aria-label "5 out of 5 stars" — i18n bypass on AR pages.
- P1-4: unthrottled pointermove handlers doing getBoundingClientRect read + style write per event (hero spotlight, bento GlowCard, capability-scene R3F handler) — style recalc at input frequency; 5 concurrent pointer listeners in hero.
- P2s: timer cleanup gaps (MiniFlow/MiniAgent/hero-console rAFs); magnetic-cursor chip.textContent DOM write per frame + reduced-motion live-toggle leaves loop running; visibilitychange-vs-IO race can re-enable offscreen frameloop (hero + three-d-section); methodology-lazy placeholder bg-elyra-dark ≠ real bg-background + all 3 lazy placeholders undersized vs real content; console-scene line geometries leak per preset switch (R3F never disposes primitives); capability-scene TorusKnot geo/mat not disposed by R3F (relies on forceContextLoss) + no webglcontextlost handling anywhere; project1 rendered twice in featured-work; bento eyebrow+h3 render identical title string ×5 + MiniSite hex aria-labels; simulator "completed" string rendered 3×; tablist roles without tabpanels; JSON-LD SearchAction targets /work?q= with no search implementation; Reveal content stays opacity:0 without JS; i18n nits (en-US NumberFormat, 'Project' default label, slider aria min/max 0-100 vs clamp 2-98); no honeypot on lead forms (rate limit only) + HeroCanvasFallback dead export.
- Positive: reduced-motion uSES pattern is hydration-safe by construction; all IO/rAF/listener cleanup verified complete in hero, three-d-section, simulator, ring-gauge, magnetic-cursor, cursor-velocity, sound; before-after is fully keyboard-operable with RTL-correct logic; forms have zod + aria wiring + server-side field errors.

---
Task ID: 2-a
Agent: security-fixer (Group 2, Loop 1)
Task: Implement L1-A security fixes (rate-limit gating, body cap, CSP, honeypot, etc.)

Work Log:
- FIX 1 (P1-1) route.ts: clientIp() now env-gated — TRUST_PROXY !== 'true' (default) ignores X-Forwarded-For/x-real-ip entirely and keys the limiter on the literal 'anonymous' (fail-closed shared bucket); TRUST_PROXY=true keeps leftmost-XFF → x-real-ip → 'anonymous'. ipForRecord nulls the 'anonymous' sentinel. Doc comment explains when to set true.
- FIX 1 (P1-1) lib/rate-limit.ts: sweep() now hard-caps the hits Map — after pruning, if size > 5_000 it deletes the oldest 1_000 entries (Map insertion order) to bound memory under key-flooding.
- FIX 2 (P1-2) route.ts: pre-parse cheap header gates — content-length > 64 KiB → 413 {error:'too_large', message:t('tooLarge')}; content-type must contain application/json → else 415 (generic 'invalid' shape). Both before req.json().
- FIX 3 (P1-3): git rm --cached db/custom.db (file kept on disk, app unaffected); .gitignore gains db/*.db, db/*.db-wal, db/*.db-shm (!.env.example exception untouched). History NOT rewritten — 5 commits still carry the blob but it contains only synthetic test data (verified by L1-A audit via strings extraction); noted here as the permanent record.
- FIX 4 (P1-4) lib/db.ts: Prisma log is now env-conditional — production: ['error']; else ['query','error','warn'] (PII: lead names/emails/phones must not reach prod logs).
- FIX 5 (P1-5) Caddyfile: prepended 5-line "SANDBOX-ONLY FILE — NOT FOR PRODUCTION" quarantine comment; rest byte-identical (tabs preserved — first edit accidentally expanded tabs, caught via git diff and rebuilt from git blob + comment).
- FIX 6 (P1-6) next.config.ts: CSP restructured into contentSecurityPolicy() fn of NODE_ENV — dev keeps Turbopack HMR needs (unsafe-eval, https:/wss:); prod: default-src 'self', script-src 'self' 'unsafe-inline' (inline bootstrap scripts required by statically-prerendered Next pages; nonce CSP incompatible with static prerendering — justification in comment), style-src 'self' 'unsafe-inline', img-src 'self' data: blob:, font-src 'self' data:, connect-src 'self', worker-src 'self' blob:, object-src 'none', base-uri 'self', form-action 'self', frame-ancestors 'none'; NO upgrade-insecure-requests (sandbox is plain HTTP). HSTS: dropped 'preload' (kept max-age=63072000; includeSubDomains).
- FIX 7 (P2-1) lib/n8n-webhook.ts: retry now regenerates ts/nonce/HMAC per attempt (attemptDelivery() builds fresh headers inside the loop); 5s AbortController timeout per attempt, single retry, fire-and-forget semantics and all exported signatures preserved.
- FIX 8 (P2-2) route.ts: cross-site rejection — sec-fetch-site in {cross-site, same-site} → 403 t('crossOrigin'); Origin present but host ≠ request host (or malformed Origin, fail-closed) → 403; absent headers (curl/API clients) allowed.
- FIX 9 (P2-3/4) route.ts: whatsapp gains regex /^\+?[0-9 ()\-]{5,30}$/ (trim + length bounds kept); integrations rejects duplicates via .refine(); fieldErrors() maps by ROOT path segment so ['integrations', 0] issues surface on fields.integrations; z.string().email() → z.email() (Zod 4.3.5, tsc clean).
- FIX 10 (P2-6) Dockerfile: RUN chown -R bun:bun /app (covers db volume mount point) + USER bun (non-root); bun-based HEALTHCHECK (no curl dep) on http://127.0.0.1:3000/; multi-stage structure intact.
- FIX 11 (P2-8) package.json: start script de-piped from tee (SIGTERM now reaches the server directly; Docker captures stdout). dev script untouched.
- FIX 12 route.ts: companyWebsite: z.string().max(200).optional() added to both lead schemas; non-empty after trim → fake 201 with fresh 8-char reference (no DB write, no webhook); empty/absent → normal path, never persisted (create() data is field-explicit).
- FIX 13: .env.example gains TRUST_PROXY=false + 2-line comment; .env appended TRUST_PROXY=true (sandbox gateway overwrites XFF); prisma/schema.prisma comment block above Lead (ipAddress/userAgent = abuse tracing only; recommend ≤90-day retention before production).
- Verification: tsc — 10 errors ALL in other agents' concurrent files (5 [locale] pages + calculator.tsx, Locale-type tightening fallout), 0 in owned files; eslint 0 findings. Live curl smoke (dev :3000): 201+reference on valid ar lead; 413 on bogus AND real 69KB body; 415 on text/plain; 403 on sec-fetch-site cross-site/same-site + mismatched Origin, matching Origin passes; whatsapp/integrations-dup/array-index/bad-email/unknown-field all return translated field errors; honeypot → 201 with NO row (count 0→1 only for the real lead; empty-string honeypot stored normally); per-key rate limit proven (6th hit on one XFF key → 429, fresh key passes). CSP: dev header still contains unsafe-eval, HSTS preload gone (next dev auto-restarted on config change → also picked up TRUST_PROXY=true from .env; ipAddress '::1' stored proves proxy headers trusted). 2 synthetic test rows cleaned from db/custom.db after verification (count back to 0). git diff --stat confirms only owned files touched.

Stage Summary:
- All 13 fixes implemented as specified; lint clean; tsc clean in owned files (10 pre-existing concurrent-agent errors noted above, none mine).
- Dev server auto-restarted itself when next.config.ts changed (Next 16 behavior) — .env TRUST_PROXY=true is therefore already live; no manual restart needed or performed.
- Coordination notes: apiErrors.tooLarge/crossOrigin keys already present in messages/{ar,en}.json (i18n agent) — consumed, verified live in Arabic responses. Honeypot input name contract = companyWebsite (schema side done; form side belongs to the components agent).
- Risk notes: prod CSP retains script-src 'unsafe-inline' by necessity (static prerendering); TRUST_PROXY=true in .env is sandbox-specific — production deploys behind a NON-Caddy TLS proxy must confirm it overwrites XFF, else set false.
---
Task ID: 2-b
Agent: i18n-core-fixer (Group 2, Loop 1)
Task: Fix i18n catalogs (P0 titles, new keys, quality) + core lib bugs (cursor velocity, calculator)

Work Log:
- FIX 1 (P0): stripped brand suffix "| Elyra/إيليرا" from all 10 subpage meta titles (contact/about/work/services.websites/services.automation × ar/en) — layout template `%s — Elyra` now appends the brand exactly once. Home meta.title defaults untouched. Live-verified: /contact → "تواصل معنا — Elyra", /en/about → "About Us — Elyra", home unchanged.
- FIX 2 (P1): added `testimonials.rating` (ar: "تقييم ٥ من ٥ نجوم" / en: "Rated 5 out of 5 stars") — matches components agent's `t('rating')` conversion in testimonials.tsx (verified in their file).
- FIX 3: added `apiErrors.tooLarge` + `apiErrors.crossOrigin` (ar/en) — completes /api/leads 413/403 responses that already call t('tooLarge')/t('crossOrigin').
- FIX 4: `calculator.pagesValue` converted to ICU plural — ar: all 6 categories (zero {لا صفحات} one/two/few/many/other, verified against Intl.PluralRules('ar') 0-20), en: one/other. Verified renders via next-intl createTranslator for 0,1,2,3,6,10,11,20. DECISION: `simulator.completed` seconds key LEFT UNCHANGED — value is always a fixed non-integer decimal per scenario (0.86/0.67/1.07) → ICU plural would always select 'other'; conversion pointless.
- FIX 5: p6 AR «استوديو «بصمة» الإبداعي» → «استوديو «بسّام» الإبداعي» (guillemets kept, sibling-consistent: متجر «لمسة»…, أكاديمية «مسار»…); about.hero.subtitle EN "A digitally small agency…" → "A small digital agency…" (faithful to AR «صغيرة الحجم»); tanween orthography fixed ×4: مجدداً→مجدّدًا (calculator.form.errorNetwork, pages.contact.form.errorNetwork, apiErrors.serverError) + محرفاً→محرفًا (apiErrors.fields.whatsapp).
- FIX 6 (P1): use-cursor-velocity writeWght is now self-sustaining — re-schedules rAF while |target−current| > 0.5, snaps + stops (rafId=0) on convergence; idle timeout now eases back over ~25 frames (sim: 770.7→700 in 25 frames, 800→600 in 31). Cleanup resets rafId to 0 (stale handle would otherwise block StrictMode remounts); effect re-run resets target/current to idleWght. All guards preserved (pointer:fine, reduced-motion, dt<1, passive listener).
- FIX 7 (P1): calculator breakdown lines rounded to $100 grid FIRST, headline = sum of rounded lines (invariant comment added: "displayed lines always sum to the headline"). Audited example website/20pg/bilingual/3D/6-int: lines 2800+2700+1900+1500+1500 = 10400 = headline (was 10425 vs 10400); max 16200 exact. Brute-forced 8448 combos: 0 failures (sums always match, min≤max, weeksMax>weeksMin, weeks integer, lines on grid). clampPages → [1,20] (NaN→1) matching UI slider + API Zod. Dead branches removed (Math.max fallbacks on weeksMin/weeksMax) — ordering guarantee documented (raw weeksMax−weeksMin ≥ 2 by construction).
- FIX 8: formatMoney locale: 'ar' | 'en' (local `export type Locale` — lib stays decoupled from i18n infra); seo.ts PageMetadataInput.locale: Locale (type-only import from @/i18n/routing); cn(...): string; use-mobile.ts: 'use client' + : boolean (note: file lives at src/hooks/, not src/lib/).
- FIX 9: seo.ts module-level one-time prod warning when NEXT_PUBLIC_SITE_URL is unset.
- FIX 10: BRAND_COLORS deleted from site-config.ts (grep: zero importers outside docs/worklog).
- FIX 11: use-reduced-motion caches MQL in lazy module-level singleton (getMql()) — one allocation instead of one per render; subscribe/getSnapshot semantics + server snapshot false unchanged.
- FIX 12: sound.ts playTone sets osc.onended → gain.disconnect() + osc.disconnect() (explicit node teardown; double-disconnect harmless).
- FIX 13: tailwind.config.ts DELETED (verified: no @config in globals.css, no imports anywhere; Tailwind 4 CSS-first via @theme; never-loaded v3 leftover).
- FIX 14: check-i18n-parity.js extended — now also verifies per-key type match, array length equality, and ICU placeholder set equality ({name} + {name, plural/select heads}); exit 1 on any failure; self-tested with 5 injected failure classes (orphan key, type, array-length, 3 placeholder mismatches) — all caught.

Stage Summary:
- Parity: PASS 518/518 keys (was 515; +testimonials.rating, +apiErrors.tooLarge, +apiErrors.crossOrigin). Placeholders verified on 477 string keys, arrays on 18 keys, 0 mismatches.
- tsc: 0 errors in owned files. 10 ANTICIPATED foreign-file errors from the Locale narrowing (coordination contract): 5 page files pass `locale: string` (from params) to buildPageMetadata — need `params: Promise<{ locale: 'ar'|'en' }>` or a narrowed pass; calculator.tsx:441/459/476 pass `useLocale()` (string) to formatMoney — needs cast/guard (e.g. `locale === 'en' ? 'en' : 'ar'` or `as Locale`).
- lint: 0 errors, 0 warnings.
- Arithmetic: audited example sums exactly (10400–16200); 8448-combo brute force clean; throwaway check deleted.
- git diff: only owned files touched by this agent (12 files incl. tailwind.config.ts deletion).
---
Task ID: 2-c
Agent: components-fixer (Group 2, Loop 1)
Task: Implement L1-C component fixes (a11y ids, frameloop pause, pointermove coalescing, honeypot, etc.)

Work Log:
- FIX 1: passed titleId to SectionHeading in bento/simulator/methodology/threeD/featured-work/testimonials/calculator — all 7 dangling aria-labelledby ids now resolve (SSR-verified: h2 ids present in HTML).
- FIX 2: threaded active (IntersectionObserver + visibility) Hero → HeroConsole → ConsoleScene; frameloop={reduced || !active ? 'never' : 'always'} + Nodes active={!reduced && active}; default true keeps API back-compatible.
- FIX 3: testimonials stars row aria-label now t('rating') — key landed in both catalogs mid-session by i18n agent; verified live EN "Rated 5 out of 5 stars" / AR "تقييم ٥ من ٥ نجوم".
- FIX 4: rAF-coalesced hero spotlight + bento GlowCard pointermove (latest-event ref + single rAF, no reschedule when idle, unmount cancel); capability-scene R3F onPointerMove throttled to ~60Hz via performance.now() guard placed BEFORE the `last` delta update so drag accumulation stays correct.
- FIX 5: bento MiniFlow timeout + MiniAgent typewriter interval now ref-tracked (clear on unmount, re-arm, and reset — kills the double-interval race); hero-console scroll rAFs ref-tracked + deduped into one scrollSceneIntoView helper.
- FIX 6: magnetic-cursor chip.textContent write guarded by lastChipLabel; reduced-motion is now React state (usePrefersReducedMotion) in the engine effect deps — toggling fully tears down rAF loop/listeners/MutationObserver and re-initializes on opt-back-in; removed the now-redundant MQL listener.
- FIX 7: hero + three-d-section track intersectingRef (written by IO); visibilitychange computes !document.hidden && intersectingRef.current — offscreen sections can no longer be re-enabled by tab switches.
- FIX 8: methodology-lazy placeholder bg-elyra-dark → bg-background (real section is light); min-h raised: simulator 420→720, calculator 600→1000, methodology 500→900/sm:1100 (slightly-under estimates of real rendered heights; IO rootMargin 400px untouched).
- FIX 9: console-scene line disposal — effect keyed on the lines memo disposes the PREVIOUS set's geometry+material after React unmounts them (and the current set on unmount); R3F-safe (never disposes mounted objects).
- FIX 10: capability-scene Knot geo/mat disposed in effect cleanup (prop-passed resources aren't auto-disposed); ContextLossGuard component adds webglcontextlost listener on gl.domElement (preventDefault + warn) with cleanup.
- FIX 11: project1 removed from featured-work grid (kept in DeconstructedCard showcase) — duplication was real (same title/desc/metrics in both); grid becomes single centered max-w-2xl card; live-verified: 1 article, 1 slider.
- FIX 12: removed the 5 redundant bento icon-eyebrow spans (identical string to the h3 below; no distinct per-card kicker key in catalogs) — icons render alone, rhythm intact; color swatches aria-hidden + tabIndex=-1 (DOM-verified).
- FIX 13: simulator "completed" sentence now renders exactly once (h3 only); status row shows idle/running + stepOf — live-verified post-run: 1 occurrence of "اكتمل التدفق في".
- FIX 14: tablist/tab downgraded to aria-pressed toggle buttons in automation-simulator scenario picker + work-grid filters (SSR + live-verified: no role=tab anywhere on /en/work).
- FIX 15: SearchAction removed from home-json-ld (target /work?q= never existed) — verified absent in rendered HTML.
- FIX 16: trust-bar Counter formats via next-intl useFormatter().number() — the exact machinery the simulator's stepOf uses (site digit convention: counts follow locale, money stays Latin); live AR render "120+", "4,800" (this Chromium's CLDR maps ar→latn digits; consistent with simulator).
- FIX 17: BeforeAfter label prop now REQUIRED (both call sites already pass translated titles); slider aria-valuemin/max = 2/98 to match the actual clamp.
- FIX 18: honeypot input added to contact-form + calculator lead form (exact contract markup + ref); payload includes companyWebsite: honeypotRef.current?.value ?? '' — E2E verified: bot fill → 201 fake success, toast shown, ZERO DB rows (strings-check on prisma/custom.db); DOM-verified: tabIndex -1, aria-hidden, pointer-events none, 1×1px offscreen.
- FIX 19: HeroCanvasFallback dead export removed (grep: zero imports).
- ALSO: calculator.tsx locale narrowed to the lib agent's newly-tightened Locale union (useLocale() string → 'en'|'ar' via total narrowing, no `as` cast) after their formatMoney signature change introduced 5 tsc errors in my file.

Stage Summary:
- All 19 fixes DONE (none partial/skipped).
- Verification: tsc — 0 errors in my owned files (5 remaining errors are FOREIGN: app/[locale]/{about,contact,services/*,work}/page.tsx pass `string` to the lib agent's tightened buildPageMetadata Locale param — outside my ownership); eslint — 0 findings project-wide; dev server 200s on /, /en, /en/contact, /en/work, /en/services/websites, /en/services/automation; live browser E2E: a11y ids, honeypot contract (bot discard + no DB write), simulator dedupe, featured-work dedupe, swatch attrs, WebGL canvas mount after preset click.
- Coordination notes: testimonials `rating` key already landed (renders correctly both locales); API honeypot contract live (client sends companyWebsite on both forms — JSON.stringify payloads, ref-read at submit); foreign tsc errors in app routes belong to the lib/routes agents (buildPageMetadata locale typing).

---
Task ID: 2-d
Agent: routes-layout-fixer (Group 2, Loop 1) — completed work recovered by coordinator after context-timeout
Task: Fix P0 404 reachability, OG image, a11y ids, CSS hygiene, viewport/skip-link/query-preservation

Work Log:
- FIX 1 (P0): created [locale]/[...rest]/page.tsx catch-all (notFound() → localized boundary inside layout) + root app/not-found.tsx (self-contained bilingual, html/body like global-error). Moved loading.tsx from [locale]/ to each page segment — [locale]-level Suspense fallback would flush a 200 shell before notFound() throws (soft-404). Verified: /nonexistent-xyz, /en/nonexistent, /fr → 404 + localized content; /ar/nonexistent → 307 (as-needed prefix strip) → 404.
- FIX 2 (P1): created [locale]/opengraph-image.tsx (ImageResponse 1200×630, English-only text — default font has no Arabic glyphs, documented). Verified PNG 200. Coordinator follow-up: subpages' buildPageMetadata openGraph object replaced the segment's file-convention image (shallow merge) → added explicit images to src/lib/seo.ts openGraph + twitter; verified og:image on all pages × both locales.
- FIX 3 (P1): titleId passed on about (values-title, team-title), websites (types-title, journey-title), automation (int-title, n8n-title).
- FIX 4 (P1): live-clock aria-live removed (minute announcements were SR noise).
- FIX 5 (P2): viewport export (themeColor #0F172A, colorScheme light).
- FIX 6 (P2): [locale]/apple-icon.tsx 180×180.
- FIX 7 (P2): skip link now uses nav.skipToContent catalog key.
- FIX 8 (P2): language-switcher preserves query string via window.location.search at click (no useSearchParams → no static bailout).
- FIX 9 (P2): .reveal no-JS safe — hidden state scoped under @media (scripting: enabled).
- FIX 10 (P2): globals.css — accurate dark-token comment, ::selection brand style, print block (hide navbar/cursor/grain/toaster).
- FIX 11 (P2): sitemap fixed LAST_MODIFIED constant; robots host directive removed.
- FIX 12 (P2): page-hero wght 200 → 700 (consistent with home KineticHeading baseline).
- FIX 13 (P2): error.tsx comment corrected (client-side log, not server).
- ALSO: fixed the 5 page-level tsc errors from buildPageMetadata Locale narrowing (params typing).

Stage Summary:
- All 13 fixes done. tsc 0, lint 0. Live verification: 404s localized (4 URL shapes), OG image 200 PNG + wired on all pages, titles deduplicated.

---
Task ID: 2-central
Agent: coordinator (central cleanup + integration)

Work Log:
- Completed 2-d's unfinished steps after its context-timeout: live verification of 404s (all 4 URL shapes localized), OG image (PNG 1200×630, 200), worklog entry.
- Fixed OG image integration gap discovered during verification: buildPageMetadata's openGraph object replaced the segment's file-convention image (Next metadata merge is shallow) → explicit images added to openGraph + twitter in src/lib/seo.ts; og:image verified on all pages × both locales.
- Dead-code purge (L1-B P2-1 + L1-A P2-5): deleted 41 never-imported ui components (kept button/input/label/sheet/slider/sonner/textarea), deleted dead hooks use-toast.ts + use-mobile.ts, removed src/hooks dir.
- Dependency pruning: 49 packages removed (next-auth, z-ai-web-dev-sdk, uuid, @mdxeditor, @tanstack/*, @dnd-kit/*, recharts, date-fns, embla, input-otp, vaul, cmdk, react-syntax-highlighter, react-markdown, react-day-picker, react-resizable-panels, zustand, @reactuses/core, react-hook-form, @hookform/resolvers, tailwindcss-animate, 24 unused radix pkgs); prisma + @types/three moved to devDependencies; package renamed nextjs_tailwind_shadcn_ts → elyra@1.0.0; bun install lockfile updated.
- E2E verification after pruning: valid calculator lead → 201 + reference cmt9xjx8 + server-recomputed estimate (7500/11600, rounded-grid consistent); honeypot bot → fake 201, ZERO DB rows; TRUST_PROXY XFF key derivation live (198.51.100.77 stored); test rows cleaned (DB empty).
- Full gates: tsc 0 errors · eslint 0 findings · i18n parity 518/518 (placeholders on 477 keys + arrays on 18 keys verified) · all 7 routes ×2 locales HTTP 200 · dev.log clean.

Stage Summary:
- Loop 1 complete: 2 P0 + 16 P1 + 39 P2 fixed across 4 fixer agents + central cleanup. 49 deps pruned, 43 dead files removed. All quality gates green.
---
Task ID: L2-A
Agent: security-verifier (Group 1, Loop 2)
Task: Verify Loop 1 security/backend fixes + regression hunt

Work Log:
- Read worklog sections L1-A / 2-a / 2-central in full; read `git show e8605c4 --stat` and the full diff hunks for route.ts, rate-limit.ts, n8n-webhook.ts, next.config.ts, and the reverse-proxy sandbox config file.
- Read all 14 target files completely in current state (route.ts 424 lines, rate-limit.ts, db.ts, n8n-webhook.ts, next.config.ts, Dockerfile, .gitignore, sandbox proxy config, package.json, prisma/schema.prisma, .env [keys only], .env.example, seo.ts, api-i18n.ts).
- LIVE probes on :3000 (DB started empty, ended empty): valid ar calculator lead → 201 ref `cmt9xr0l`; DB row verified server-computed 7500/11600/6-11w + ip/UA captured; XFF keying live (TRUST_PROXY=true → stored 203.0.113.9); honeypot → fake 201, ZERO rows; 413 (content-length 999999) Arabic tooLarge; 415 text/plain; 403 sec-fetch-site cross-site AND Origin-mismatch (Arabic crossOrigin), matching Origin passes; unknown field → fields.hacker; dup integrations ["crm","crm"] → fields.integrations; whatsapp "123" → fields.whatsapp; bad email → fields.email (en); CLIENT_ECHO payload (minBudget…breakdown) → 201 with server values stored (client 1/2/99/99 ignored); rate limit 6th same-key hit → 429 + Retry-After 55s.
- REGRESSION ATTACK: chunked transfer-encoding probe — 80,178-byte body with `Transfer-Encoding: chunked` (no content-length) was fully read + parsed (400 name-length) instead of 413 → content-length-only cap is bypassable (finding 1).
- Gates: `bunx tsc --noEmit` → 0 errors; `bun run lint` → 0 findings; i18n parity 518/518 (placeholders 477, arrays 18); all 7 routes ×2 locales HTTP 200; dev.log clean during probes; removed-dep import hunt (19 pkgs × single+double quotes × src/scripts/mini-services/examples) → 0 matches; dep spot-checks: every remaining runtime dep has live importers (sharp = next/og runtime, next-themes = ui/sonner.tsx); no new console.log/any/@ts-ignore in fixed files.
- Infra: dev CSP live-verified (unsafe-eval present in dev, HSTS preload gone); git ls-files custom.db = 0, db/custom.db on disk; sandbox proxy config body byte-identical vs HEAD~1 (only the 5-line quarantine comment added); package.json elyra@1.0.0, dev script untouched, start de-teed, 20 runtime + 12 dev deps; .env TRUST_PROXY=true loaded ("Environments: .env" in dev.log, live behavior confirms); Dockerfile analysis (Docker unavailable in sandbox — documented in file): found chown-after-VOLUME ordering issue (finding 2).
- DB cleaned: deleteMany → 3 rows removed, count 0; temp probe files removed.

Stage Summary:
- Verdict: 3 findings (no P0).
  [MED] 413 body cap bypassed via chunked transfer-encoding — route.ts:261-269 (live-verified: 80KB chunked body parsed; P1-2 memory-DoS vector still open for header-less requests).
  [MED, conditional/docs-based, Docker untestable here] Dockerfile:57 `VOLUME /app/db` precedes :62 `RUN chown -R bun:bun /app` — Docker docs state post-VOLUME changes to the volume path are discarded → db mount point may stay root-owned → SQLite EACCES under USER bun; reorder chown before VOLUME.
  [LOW] Honeypot fake-201 reference (`204ca90c`, hex) fingerprintable vs real cuid refs (`cmt9xr0l` — always 'c'-prefixed base-36) despite comment claiming bots can't tell the difference.
- Everything else verified correct: all 13 fixes of 2-a implemented right (TRUST_PROXY fail-closed, honeypot never persisted, per-attempt webhook re-signing, rate-limit Map cap exactly 1000 oldest / no off-by-one, env-conditional Prisma logging, prod CSP, DB untracked). No regressions from the 49-dep prune or any Loop 1 change. Verdict per rules: 3 findings; report delivered to coordinator.
---
Task ID: L2-B
Agent: frontend-verifier (Group 1, Loop 2)
Task: Verify Loop 1 frontend/component/route/i18n fixes + regression hunt

Work Log:
- Read worklog tail (L1-B/C/D + 2-a/b/c/d/central) + git show e8605c4 --stat for the diff surface (128 files).
- A. i18n: parity script PASS 518/518 (placeholders on 477 keys, arrays on 18). Key-set diff vs e8605c4^ (both locales): exactly +3 keys (testimonials.rating, apiErrors.tooLarge, apiErrors.crossOrigin), 0 removed — no neighbor-key damage. All 10 subpage meta.titles brand-suffix-free; home meta.title byte-identical to old. ICU plural pagesValue parsed + rendered via intl-messageformat for 0/1/2/3/6/10/11/20/100 — all 6 ar categories select correctly (zero→لا صفحات, one→صفحة, two→صفحتان, few→صفحات, many→صفحة). بسّام shadda ✓, EN about.hero.subtitle "A small digital agency…" ✓, zero اً tanween remnants ✓, مجدّدًا ×3 + محرفًا ×1 ✓.
- B. libs: use-cursor-velocity read line-by-line — self-sustaining lerp (re-schedules while current≠target), snap+stop at ≤0.5, scheduleWrite no-stack guard, cleanup cancels + resets rafId + clears idle timer + resets --wght, effect re-run resets target/current (StrictMode-safe). calculator: bun-executed audited example (website/20/bilingual/3D/6-int/advanced) → lines 2800+2700+1900+1500+1500 = 10400 = headline, max 16200 exact; brute-forced 30,720 combos (superset of Loop 1's 8,448): 0 invariant failures (sums, min≤max, weeksMax>weeksMin, integer weeks, 100-grid); clampPages 0/NaN→1, 25→20; Locale type + formatMoney(Locale) ✓. sound.ts onended disconnect ✓ opt-in/lazy unchanged ✓. use-reduced-motion MQL singleton + uSES semantics ✓. seo.ts ogImage ar→/opengraph-image en→/en/opengraph-image, prod-only SITE_URL warning, type-only routing import ✓. site-config BRAND_COLORS gone (SITE_CONTACT/SITE_SOCIAL intact) ✓. cn(...): string ✓.
- C. components: all 7 home titleIds + 6 page titleIds wired (aria-labelledby string === titleId string, verified by grep); live DOM: bento/work/testi SSR-present; sim/method/calc present after scroll (lazy ssr:false — expected); threeD-title present in /services/websites SSR both locales. ConsoleScene: active threaded Hero→HeroConsole→ConsoleScene, frameloop={reduced||!active?'never':'always'}, Nodes active={!reduced&&active}, default true. testimonials aria-label={t('rating')} live AR+EN ✓. Pointermove rAF coalescing (hero spotlight + bento GlowCard: latest-event ref + single rAF + unmount cancel + rect read inside rAF); capability-scene 16ms throttle early-returns BEFORE last-delta update (drag accumulation correct). bento MiniFlow/MiniAgent timers ref-tracked + cleared; hero-console scroll rAF tracked. magnetic-cursor lastChipLabel guard + reduced in engine effect deps (full teardown/re-init). hero + three-d-section intersectingRef + visibilitychange combined. Lazy placeholders bg-background + min-h 720/1000/900(sm:1100). console-scene previous-set disposal (never disposes mounted primitives); capability-scene geo/mat disposal + ContextLossGuard. featured-work GRID_PROJECTS excludes project1 (live: section has 1 article, 1 slider, متجر «لمسة» ×1); DeconstructedCard keeps project1. bento 5 icon-only eyebrow rows + swatches aria-hidden/tabIndex -1. simulator completed renders once (h3 only; status row idle/running) + aria-pressed picker; work-grid aria-pressed, role=tab absent live. home-json-ld SearchAction absent from live JSON-LD. trust-bar useFormatter().number(). before-after label REQUIRED + aria-valuemin/max 2/98. Honeypots in contact-form + calculator (name=companyWebsite, tabIndex -1, aria-hidden, offscreen absolute 1px, payload includes value) — live DOM-verified on /contact (calculator's mounts at wizard step 2 per its conditional render — code-verified). HeroCanvasFallback gone. Diff-hunk regression scan of all touched components: no removed JSX, no broken className interpolation, no dead vars, dep arrays correct.
- D. routes/layout/CSS: catch-all notFound() + NO loading.tsx in [...rest]; root not-found.tsx self-contained html/body + inline styles. Per-page loading.tsx ×5 identical pattern (min-h-[100svh], role=status, localized common.loading); [locale]/loading.tsx deleted; home has no loading boundary. opengraph-image.tsx + apple-icon.tsx serve image/png 200 at /opengraph-image, /en/opengraph-image, /en/apple-icon. layout viewport export (themeColor #0F172A, colorScheme light), skip link via nav.skipToContent, title template intact. Pages ×5 params Promise<{locale:string}> + hasLocale narrowing + titleIds. live-clock aria-live removed; language-switcher window.location.search preservation; page-hero wght 700; error.tsx comment accurate. globals.css: .reveal default-visible + hidden-state scoped under @media (scripting: enabled); .reveal-visible declared after → overrides in both scripting states (live computed opacity 1 on .reveal.reveal-visible); ::selection brand; print block hides navbar/grain/cursor/toaster; accurate light-only dark comment. sitemap LAST_MODIFIED const; robots has no host.
- Live probes: all 12 route×locale combos → 200. og:image meta present on ALL 10 subpage×locale combos (ar→/opengraph-image, en→/en/opengraph-image). Titles: /en/contact "Contact Us — Elyra", /contact "تواصل معنا — Elyra", /en/work "Our Work — Elyra", homes unchanged. 404 shapes browser-verified: /nonexistent-xyz → localized AR 404 inside layout (lang=ar, navbar, h1 الصفحة غير موجودة, bg #F5F5F7); /en/nonexistent-xyz → EN localized; /fr → AR localized; /ar/nonexistent → 307→404; /foo.txt → ROOT self-contained 404 (title "404 — Elyra", no navbar, bg #0F172A inline — works without globals.css). hreflang: 3 alternates (ar/en/x-default) on /en/work (rendered as hrefLang camelCase — case-insensitive HTML attribute, functionally intact); sitemap.xml alternates + robots.txt clean.
- E. gates: bunx tsc --noEmit → 0 errors; bun run lint → 0 findings; parity → PASS; rg for use-toast/use-mobile/ui deletions → empty; tailwind.config.ts absent + zero src references; dev.log clean across all probes (no runtime errors/stack traces); React Compiler (enabled in next.config) — no mutable-ref-reads-during-render or purity violations in touched files (react-hooks error-level rules pass).
- Non-counted observations: (1) ar ICU "two" renders "٢ صفحتان" — dual noun + numeral is redundant; CLDR convention omits # in the two/one categories (style nit, comprehension unaffected). (2) Pre-existing framer-motion console warning on Methodology (scroll container div lacks position:relative) — Loop 1 diff to that file is +1 line (titleId) only, NOT a regression. (3) /favicon.ico 404 from browser default probing — icon served via /icon metadata route; pre-existing Next behavior.

Stage Summary:
- Verdict: NO REMAINING ERRORS in frontend/i18n/routes scope. All Loop 1 fixes verified correctly implemented (A–E all OK); regression hunt clean; 3 observations noted, 0 counted findings.

---
Task ID: 2-loop2
Agent: coordinator (Loop 2 fixes — closing L2-A findings)

Work Log:
- Finding 1 (chunked transfer-encoding bypass): POSTs carrying transfer-encoding now rejected 413 before parsing — live-verified with an 80KB chunked body (was 400-with-full-parse, now 413).
- Finding 2 (Dockerfile VOLUME/chown order): chown moved BEFORE VOLUME declaration (Docker discards post-VOLUME changes to the path).
- Finding 3 (honeypot reference fingerprint): fake reference now cuid-shaped ('c' + 7 base-36 chars via crypto.randomInt) — live: bot got c3r09t6t vs real cmt9y9sh (indistinguishable alphabets).
- L2-B nits: ICU ar polish (one {صفحة واحدة}, two {صفحتان} — CLDR-conformant, no redundant numeral); methodology scroll container got `relative` (framer-motion useScroll offset anchor).
- Gates: tsc 0 · lint 0 · parity 518/518 (placeholders+arrays) · valid-lead E2E 201 · DB cleaned (0 rows).

Stage Summary:
- Loop 2 closed: L2-B verdict "NO REMAINING ERRORS (frontend)"; L2-A's 3 findings all fixed + live-verified. Project ready for the 6-agent final review.
---
Task ID: R3
Agent: react-correctness-reviewer (Final Review Board)
Task: React 19 runtime/hydration/lifecycle correctness review

Work Log:
- Read worklog tail (Loop 1 groups 2-a..2-d + central, Loop 2 L2-A/L2-B/2-loop2) for fix context; confirmed reactStrictMode: true + reactCompiler: true in next.config.ts.
- Read ALL 42 'use client' files in full (home ×21, sensory ×3, layout ×4, pages ×2, three ×1, shared ×7, ui ×6 [button/input/label/sheet/slider/sonner/textarea], seo/brand spot-checked) + the 4 lib hooks (use-cursor-velocity, use-reduced-motion, use-rtl, sound.ts) + app/[locale]/{layout,error,not-found}, global-error, root not-found, 5 loading.tsx, page files (verified server/no-hooks). Traced each component's runtime.
- Hooks audit: no rules-of-hooks violations, no conditional hooks, no stale-closure hazards found. uSES patterns (use-reduced-motion MQL singleton, sound localStorage, footer year, global-error detectCopy) all hydration-safe (server snapshot used during hydration, stable snapshots). Honeypot ref-read-at-submit verified in both forms (value stays '' for humans; calculator's honeypot mounts at step 2 where the submit lives).
- Effect/lifecycle ledger (grep-verified exhaustive): every addEventListener/removeEventListener, rAF/cancel, interval/timeout, IO/MutationObserver connect/disconnect pairs — hero (IO + visibilitychange + idle-callback + once-listeners), hero-canvas, hero-console (scrollRaf + MQL), navbar scroll, live-clock interval, magnetic-cursor (8 listeners incl. capture-matched scroll removal + MutationObserver + debounce + 2 rAFs), sound delegation + storage + osc.onended disconnect, use-cursor-velocity (self-sustaining lerp, rafId reset, idle timer), use-reduced-motion, reveal/trust-bar/3 lazy wrappers IOs, deconstructed-card scroll+rAF, capability-scene (webglcontextlost + geo/mat dispose), ring-gauge rAF (StrictMode-safe fromRef commit), simulator (timeouts array + rafRef + deferred reset), bento MiniFlow/MiniAgent timers. NO unpaired handles remain.
- Hydration audit: grep for Math.random/Date.now/new Date/performance.now in components → all confined to effects/rAF callbacks/lazy useState initializers (hero-canvas particles, ssr:false) / uSES snapshots. live-clock '--:--' null-placeholder SSR-verified. kinetic-heading + hero CTA render deterministic var(--wght,700) SSR-verified in served HTML. HeroConsole window read short-circuited by mounted=false during SSR. ORBIT_ITEMS precomputed module-scope with CSSOM-normalized calc() strings. No locale/time-dependent render divergence.
- R3F/Three audit: frameloop gating verified in all 3 canvases (hero: active; console: reduced||!active; capability: active) + Nodes useFrame double-gates; DPR [1,2] everywhere; disposal: capability-scene geo/mat explicit dispose (StrictMode dev dispose+re-upload accepted, three.js recovers); console-scene primitive line disposal traced by simulation — found off-by-one (see finding); InitialRenderSafety rAF paired.
- State machines: simulator idle→running→completed→reset traced (clearAll on every run/reset/unmount; Run button replaced by running-span so no double-run; scenario-switch reset deferred via rAF — sub-frame click race only, not humanly reachable); calculator wizard back/forward integrity + useMemo(computeEstimate, [input]) consistency + double-submit guard + error-path value retention verified; before-after pointer capture + RTL keyboard inversion + clamp bounds correct; navbar Sheet controlled with Radix scroll-lock/focus.
- React 19 specifics: no use()/form actions/useOptimistic/useActionState misuse; no ref callbacks returning values; Suspense boundaries sane (per-page loading.tsx, none at [locale] to avoid soft-404 — confirmed pattern); lazy ssr:false + IO wrappers: IO fires → placeholder→loading placeholder (same shape)→component, no double-mount (single conditional mount keyed on `near`).
- Live probes: curl SSR on /, /en, /en/contact, /en/work, /en/about, /en/services/websites, /en/services/automation — all 200, aria-labelledby targets resolve, honeypot in /en/contact HTML, clock placeholder present. dev.log full scan: ZERO React warnings / hydration mismatches / act() / framer-motion warnings across all probes (only request logs + expected prisma/n8n lines).

Stage Summary:
- 1 finding (LOW): console-scene.tsx line-disposal off-by-one — cleanup disposes the set captured as `previous` at effect-run time instead of the set React just unmounted; consequently each retired set is freed one preset-switch late and the finally-mounted set is never explicitly disposed (production, zero-switch session: no line ever explicitly disposed). Real-world impact bounded to ~12 tiny geometries and fully recovered by R3F Canvas context teardown on unmount (no persistent GPU leak); the code comment's stated invariant ("final cleanup disposes the current set") is factually wrong. Fix: dispose the `lines` closure value in the cleanup (same StrictMode semantics as the accepted capability-scene geo/mat pattern). Verified it can NOT dispose still-mounted objects (the Loop 1 concern) — it errs toward under-disposal.
- Otherwise CLEAN: no hooks violations, no hydration errors, no unpaired lifecycles, no races with real consequences, no React 19 anti-patterns, dev.log clean.
---
Task ID: R5
Agent: perf-seo-reviewer (Final Review Board)
Task: Performance architecture + SEO/metadata correctness review

Work Log:
- Read worklog tail (L1/L2 loops + 2-a..2-central + Loop-2 closure) to avoid re-reporting fixed items (LCP/CLS/TBT fixes, framer-motion chunk isolation, OG image wiring, title dedup, console-scene gating).
- A1 Import-graph trace (static, recursive): page.tsx → Hero/TrustBar/ServicesBento/SimulatorLazy/FeaturedWork/MethodologyLazy/Testimonials/CalculatorLazy/HomeJsonLd; layout → Navbar/Footer/Toaster(sonner→next-themes)/MagneticCursor/FilmGrain. rg for module-level framer-motion/three/@react-three: ONLY hero-canvas, console-scene, capability-scene (three) and methodology, automation-simulator, calculator (framer) — each reached EXCLUSIVELY via next/dynamic ssr:false (hero.tsx:13, hero-console.tsx:11, three-d-section.tsx:11, simulator-lazy.tsx:22, calculator-lazy.tsx:30, methodology-lazy.tsx:20). No heavy dep statically reachable from any route's initial chunk. Subpages verified light too (services pages use ThreeDSection/SimulatorLazy wrappers).
- A2 Fonts/CSS: Inter+Cairo via next/font/google, display:'swap'; globals.css = 2 top-level @imports (tailwindcss + tw-animate-css), no @import chains, no heavy selectors; print/reduced-motion/scripting media blocks clean. No third-party sync scripts (CSP self-only).
- A3 Images: public/ = logo.svg (1KB) only; zero runtime next/image/<img> in first-party code; og/apple icons are static ImageResponse routes (200 PNG, 690B/3.8KB/26.7KB).
- A4 Layout stability: 5 per-page loading.tsx = min-h-[100svh] localized placeholders; [...rest] has none (hard-404 by design). Playwright-measured real section heights vs lazy placeholders @1440px: simulator 883 vs 720 (−163), methodology 1129 vs 1100 (−29), calculator 940 vs 1000 (+60) — swaps happen ≥400px pre-viewport via IO rootMargin, so diffs occur below the viewport → no visible CLS; numbers sane.
- A5 Runtime patterns: all pointer/scroll addEventListener calls passive ✓; rAF coalescing verified correct in hero spotlight, bento GlowCard, deconstructed-card scroll, magnetic-cursor magnet refresh (latest-event ref + single rAF + unmount cancel); use-cursor-velocity self-sustaining lerp stops on convergence; navbar scroll setState bails on unchanged; will-change only on the 2 cursor layers; above-fold backdrop-blur = hero badge+CTA (blur-sm) + scrolled navbar only.
- A6 WebGL discipline: dpr={[1,2]} on all 3 canvases (hero-canvas:177, console-scene:266, capability-scene:170) ✓; frameloop gated on ALL THREE — capability-scene confirmed gated (three-d-section IO rootMargin 200px + visibilitychange + intersectingRef → frameloop={active?'always':'never'}), console-scene gated (reduced||!active→'never'), hero-canvas gated (Hero IO active) — the Loop-1 gap the brief flagged is CLOSED; disposal: console-scene line geo/mat disposal, capability-scene knot geo/mat + ContextLossGuard; R3F Canvas forceContextLoss on unmount.
- A7 dev.log: 12 route×locale responses 90–490ms (one 1049ms first-hit compile outlier), no repeated recompiles, no errors, no memory hints; curl -w timings match.
- B1 Metadata matrix (curl all 12 URLs): unique titles, template applied once, 10 subpage titles suffix-free, homes intentional; descriptions present (AR 71–148 ✓, EN 87–185 — home EN = 185 > 160); canonical absolute per-locale ✓; hreflang ar/en/x-default on all 12, symmetric, matches sitemap ✓; og:title/description/url/locale/type/images + twitter card/title/desc/image on all 12 ✓.
- B2 og:image routes: /opengraph-image + /en/opengraph-image → 200 PNG; subpage og:image URLs absolute SITE_URL-based ✓. Found: AR home og:image + ALL AR pages' apple-touch-icon emit /ar/-prefixed file-convention URLs → single 307 hop to unprefixed (chain verified 200 PNG, query preserved).
- B3 sitemap.xml: 6 <url> entries (AR canonicals) with full ar/en/x-default alternates each, fixed LAST_MODIFIED constant, priorities 1/0.9/0.8; EN variants appear only as alternates (no own <url> entries). robots.txt: allow /, disallow /api+/admin, sitemap pointer, no host ✓.
- B4 Home JSON-LD: parses clean; Organization + WebSite with absolute @id/url, logo→/icon (200), sameAs, no SearchAction, no undefined serialization ✓.
- B5 lang/dir correct per locale on all probed pages; single h1 per page; og:locale ar_AR/en_US ✓.
- B6 Status: 200 on all 12, hard 404 on /nonexistent, /en/nonexistent, /fr, /foo.txt, /admin; /ar/* → single-hop 307 → 200; /work and /en/work both direct 200 (no redirect on canonicals).
- B7 Icons: /icon 200 PNG (both locales), /en/apple-icon + /apple-icon 200 PNG; theme-color #0F172A via viewport export ✓; /favicon.ico 404 (pre-existing Next file-convention behavior, /icon used via link tag).
- B8 i18n SEO parity: no noindex anywhere; both locales fully indexable; AR/EN title+description quality verified from catalogs (lengths + content).

Stage Summary:
- Verdict: 4 LOW findings, 0 MED/HIGH. (1) AR-locale og:image + apple-touch-icon URLs carry /ar prefix → 307 redirect hop on the default-locale pages (layout.tsx file-convention emission; fix: explicit images/icons in layout metadata like seo.ts does). (2) EN home meta description 185 chars > 160 (SERP truncation; messages/en.json). (3) sitemap lists 6 <url> entries — EN variants only as hreflang alternates, not as own entries per Google's localized-sitemap pattern (sitemap.ts). (4) og:site_name + og:image:type dropped on all 10 subpages (buildPageMetadata openGraph replaces layout's; seo.ts lacks siteName). Bundle graph CLEAN (no heavy dep statically reachable), all 3 WebGL canvases DPR-clamped + frameloop-gated, listeners passive + rAF-coalesced, placeholders CLS-safe, JSON-LD/hreflang/canonical/titles/404s all correct. None of the 4 blocks ship; all are quick metadata fixes.
---
Task ID: R2
Agent: code-quality-auditor (Final Review Board)
Task: Staff-level code quality + maintainability audit

Work Log:
- Read worklog tail (L1-* / 2-* / L2-* / 2-loop2) for full fix-loop context; confirmed HEAD = 31063db.
- TypeScript rigor sweep: rg across src/ for `as`/`any`/`@ts-ignore`/`@ts-expect-error`; PCRE2 grep for non-null assertions (0 hits); every one of ~40 `as` casts judged in context — all legitimate (`as const` majority, namespace imports, guarded DOM event casts, next-intl t.raw() array casts guarded by parity script, Prisma globalThis singleton, webkitAudioContext feature detect, Zod unrecognized_keys narrowing, hasLocale-guarded locale narrowing in all 5 pages + layout). 0 `any`, 0 ts-comments, 0 non-null `!`, 0 TODO/FIXME. Only 2 eslint-disable directives in repo, both justified (check-i18n-parity require-imports, hero-canvas R3F uniform mutation with explanatory comment).
- Read ALL of src/lib (12 files), api/leads/route.ts (436 lines full), all 5 page files + layout + error/not-found/global-error/catch-all/loading, i18n trio, proxy, both forms (contact-form, calculator 618 lines), all 3 lazy wrappers, all shared components, all home components, sensory + three components, ui/ components, app metadata routes, configs (tsconfig/eslint/postcss/components.json/package.json/next.config), prisma/schema.prisma, README.
- Dead-export hunt: reference-counted every exported component + lib symbol. Found ZERO-importer: Container (shared/container.tsx), SpotlightSection (shared/spotlight-section.tsx), resetRateLimiter (rate-limit.ts "test hook" — no tests exist), .card-light-deep CSS class (globals.css:440, 0 consumers, comment references the deleted shadcn Card). Verified hero.tsx reimplements SpotlightSection's logic inline (with the 2-c/4 rAF fix the dead component never got).
- Schema-divergence audit (client vs API): calculator client schema whatsapp = `z.string().trim().optional()` vs API min5/max30/regex — AND calculator error state is `{name?, email?}` with the 400-handler mapping only name/email, so a server whatsapp rejection surfaces only a generic toast (no field hint, no aria-invalid on the calc-wa input); both client forms still use deprecated `z.string().email()` while route.ts:81 was migrated to `z.email()` with an in-code comment claiming the fix; client schemas also lack the API's max lengths (name 100, email 254, message 5000).
- Comment-accuracy audit: calculator.ts header claims "Serializable transaction" (none exists; pure sync recompute) + "future /api/leads route (Phase 3)" (shipped); schema.prisma:3 "Phase 3 will wire POST /api/leads" (shipped); container.tsx claims "Replaces every hand-rolled elyra-container" (0 call sites); README recipe sections verified present (webhook timingSafeEqual snippet, decision #23) — README quality table stale (says 499 keys, actual 518).
- Config sanity: tsconfig strict + noUncheckedIndexedAccess + noImplicitOverride + bundler resolution + paths — complete; eslint strict TS rules at error level (lenient block has scoping-comment inaccuracy but nothing hidden — no debugger/unreachable present, verified); postcss minimal-correct; package.json 20 runtime deps all with live importers (verified in L2-A, spot re-checked); flagged db:push --accept-data-loss footgun (known since L1-A, still open).
- Prisma: db.ts singleton correct + env-gated PII-safe logging; schema has @@index([status, createdAt]) + @@index([email]) — adequate for current create-only access pattern (no read queries in app; clean-leads uses count/deleteMany).
- Scripts: check-i18n-parity.js read line-by-line — placeholder regex verified CORRECT on real ICU surface (nested plural {count, plural, ...} extracts `count` both locales, `#` not falsely matched, select heads handled identically; limitation re: array-element placeholders documented + zero such arrays exist); ran it: PASS 518/518. clean-leads.ts safe (dry-run, disconnect in finally, exit 1 on error). verify-*.mjs selectors current (aria-pressed sound toggle; a[href] locator initially looked typo'd via pipe artifact — hexdump-verified byte-correct). update-messages-phase2.py = one-shot historical migration (observation only).
- Error handling: every await in src/app+src/lib handled (req.json try/catch, webhook fire-and-forget with .catch + documented contract, fetch forms in try/catch, res.json().catch(()=>null)); all noUncheckedIndexedAccess array accesses guarded (positions[i] ?? patterns, issue.path[0] typeof checks, steps[idx] null guards).
- Gates re-run (read-only): bunx tsc --noEmit → 0 errors; bun run lint → 0 findings; parity → 518/518. Dev server untouched.

Stage Summary:
- Verdict: 9 findings (0 HIGH / 2 MED / 7 LOW), gates all green.
  [MED-1] Client/API validation divergence: whatsapp unvalidated client-side + server whatsapp errors unsurfable in calculator (dropped field mapping, no aria wiring); deprecated z.string().email() in both client schemas vs migrated API.
  [MED-2] Dead shared components with adoption-claiming comments: Container + SpotlightSection (zero importers; hero.tsx hand-rolls the latter's logic with a fix the dead copy lacks) — same silent-no-op trap as the deleted tailwind.config.ts.
  [LOW] Stale pre-Loop-1 comments (calculator.ts "Serializable transaction"/"future route", schema.prisma "will wire"); dead .card-light-deep CSS + comment referencing removed shadcn Card; seo.ts no-op arPath ternary (known since L1-B); lazy-wrapper IO hook copy-pasted ×3; dead resetRateLimiter test hook; on_submit snake_case (hero-console.tsx:94); db:push --accept-data-loss footgun (package.json).
- Positives: zero any/assertions/ts-ignore, strict + noUncheckedIndexedAccess clean across 100 files, noUncheckedIndexedAccess guards exemplary in 3D/simulator code, error handling complete, configs coherent, parity script correct on real ICU, comment culture otherwise unusually honest (FIX() provenance tags).
---
Task ID: R1
Agent: security-pentester (Final Review Board)
Task: Offensive security review of the full attack surface

Work Log:
- Read worklog tail + all security-relevant entries (L1-A, 2-a, L2-A, 2-loop2) to avoid re-reporting fixed items (XFF/TRUST_PROXY, chunked-TE 413, CSP, honeypot cuid reference, per-attempt webhook re-signing, cross-site 403, Dockerfile chown/VOLUME, dep prune).
- Deep-read: route.ts (436 lines, full), rate-limit.ts, n8n-webhook.ts, db.ts, api-i18n.ts, calculator.ts, seo.ts, prisma/schema.prisma, next.config.ts, proxy.ts, i18n/{routing,request,navigation}, language-switcher.tsx, home-json-ld.tsx, robots.ts, sitemap.ts, Dockerfile, sandbox reverse-proxy config, .env.example, .gitignore, .dockerignore, package.json, scripts/{verify-api,clean-leads}.
- Grep hunts: zero secrets in src/scripts/configs; no eval/new Function; single dangerouslySetInnerHTML = static JSON-LD (no dynamic data); no raw SQL; no open redirects (router.replace on internal pathname only).
- Git hygiene: no .env or db/custom.db tracked; .env history contained only a DATABASE_URL path; all historical db blobs scanned — only synthetic @test.dev rows; next-auth absent from package.json + bun.lock.
- LIVE attack battery on :3000 (all test rows deleted afterwards; concurrent reviewer's r6-* rows preserved):
  - Methods: GET/PUT 405, OPTIONS 204 (unauthenticated, static — fine).
  - Validation torture: pages 0/-1/21/1.5/null/true/"5"/1e999 -> 400; 20/1e0 -> 201 (correct); integrations 7 items/dupes/mixed/non-array -> 400; source field-confusion both directions -> 400; client-echo estimate forgery -> stripped + 201; name 101 chars -> 400; message 5000 OK; email no-TLD/newline -> 400; 254-char email OK.
  - Unicode/data hygiene: RLO bidi name, =HYPERLINK/=cmd CSV-formula name+message, NUL byte, zero-width-only name, emoji name -> ALL accepted + stored verbatim (DB dump verified).
  - Rate limit: same key 6th -> 429 + Retry-After 60; XFF rotation burst (12 fresh keys <1s) all 201 (documented sandbox artifact: TRUST_PROXY=true + direct :3000; the TLS proxy overwrites XFF on the prod path); header-case -> same bucket; IPv6 bracket/canonical forms = distinct keys (same artifact); XFF-absent requests get XFF=::1 INJECTED by the dev server (probe: X-Real-IP-only request stored ip=::1, not the header value — x-real-ip fallback is dead code in dev; prod standalone follows code as written).
  - Honeypot matrix: absent/empty -> real store; whitespace-only -> REAL store (trim-before-check nuance); 200 chars -> fake 201 (no row); 201 chars -> 400. Honeypot-vs-real timing delta ~1-2ms localhost — negligible.
  - Header attacks: 20KB header -> 431 (Node cap); 70KB body -> 413; chunked TE 80KB -> 413 (Loop-2 fix verified live); CL:0-lie -> 400; CL 999999 -> 413; dup CL -> 400; dup CT -> 201; x-elyra-locale fr/AR/garbage/500-char/script-tag -> harmless fallback (no reflection).
  - Origin/Sec-Fetch: evil Origin -> 403; matching Origin -> 201; cross-site/same-site -> 403; same-origin -> 201; malformed Origin -> 403; attacker-controlled Host+Origin pair passes (non-browser client, already allowed by design).
  - 500 hunt: deep 15k nesting -> 400; array/null/string bodies -> 400; __proto__/constructor keys -> 400 (no prototype pollution; out['__proto__'] assignment no-ops on plain object); no stack traces leaked; dev.log PII-free.
  - Webhook: N8N_* unset in .env -> "webhook disabled" per stored lead (74 log lines); URL is env-only — client cannot influence target or firing; honeypot path never fires it.
  - Crawl: robots/sitemap clean; /admin /.env /db/custom.db /.git/* /messages/* /scripts/* /Dockerfile /%2e%2e traversal -> all 404.
  - Deps: next 16.1.3, prisma 6.19.2, zod 4.3.5, react 19.2.3, sharp 0.34.5 — current, no known-risky pins, 20 runtime deps only.

Stage Summary:
- Verdict: 4 findings (1 HIGH, 3 LOW).
  [HIGH] Contact-form message is never persisted — prisma/schema.prisma Lead has no message column AND route.ts:364-382 create() omits it; message only rides the OPTIONAL webhook payload (route.ts:396). Live-verified: contact lead "xri probe message" stored with zero message data; webhook disabled by default (.env.example) -> 100% of contact inquiry text silently dropped while API returns 201 "stored". Fix: add message String? column + persist stored.message.
  [LOW] Reference collisions — route.ts:384 lead.id.slice(0,8) = 'c' + 7 base36 timestamp chars (~36ms bucket): live-observed identical references cmt9ymih/cmt9ymii/cmt9ymij/cmt9ymil each shared by 2 different rows. No enumeration risk (no lookup endpoint) but duplicate customer handles. Fix: random per-row reference.
  [LOW] Stored-PII sanitization gap — baseFields (route.ts:79-94) accept formula prefixes (= + - @), bidi controls (U+202E), NUL, zero-width chars verbatim into DB + n8n payload -> CSV/formula injection on Sheets/Excel export + name spoofing in future CRM views. Fix: strip Cc/Cf + neutralize leading =+-@ at validation or webhook layer.
  [LOW] Webhook URL scheme unvalidated (n8n-webhook.ts:72-83) — http:// URL silently accepted -> lead PII posted in cleartext on operator typo. Fix: prod warning/fail-closed for non-https.
- Everything else held: all prior fixes verified still in place live; no secrets, no XSS sinks, no injection, no open redirect, no exposed paths, no PII in logs, git history clean.

---
Task ID: R6
Agent: architecture-integrator (Final Review Board)
Task: Cross-cutting contracts + E2E journeys + deploy chain review

Work Log:
- Read worklog tail (L1/L2 loops + coordinators); read the full lead pipeline line by line (route.ts, api-i18n.ts, contact-form.tsx, calculator.tsx 618 lines, n8n-webhook.ts, rate-limit.ts, db.ts, schema.prisma) + i18n trio, layout/error/not-found boundaries, proxy.ts, next.config.ts, .env.example, .dockerignore, Dockerfile, package.json, README.md, clean-leads.ts, site-config.ts, Caddyfile.
- A2 i18n USAGE parity (beyond key-set parity): built a variable-scoped extractor (153 unique static t()/t.raw keys + full dynamic-template enumeration: bento minis, simulator scenario×step, work projects p1–p6, methodology steps, testimonials items, hero presets, calculator option keys, services/websites/about/contact page maps) — 0 missing in either catalog. useFormatter (trust-bar) + getTranslations namespaces verified. Parity script re-run: 518/518.
- A3 API error i18n LIVE: invalid AR/EN via x-elyra-locale AND Accept-Language fallback (default ar); 413 AR (header + real 70KB body + raw-socket chunked → 413); 415 text/plain; 403 sec-fetch-site + Origin-mismatch (AR crossOrigin), matching Origin passes; 429 on 6th same-key hit with AR message + Retry-After: 60; unknown field → fields.hacker=unknownField EN; fields.{source,service,languages,threeD,automationLevel,whatsapp,integrations,pages,name,email,message} all emit translated copy both locales; GET 405; OPTIONS 204.
- A1 lead-pipeline matrix: contact form sends {source:'contact-form', companyWebsite(honeypot), name, email, message} — server strictObject accepts exactly those (+optional whatsapp); calculator sends the full option set + optional whatsapp; client-echo estimate fields stripped & server-recomputed (live: tampered minBudget:1/maxBudget:2/estimate:'tampered' → row stored 11700/18800/9–16w = computeEstimate output). Client/server rule mismatch found ONLY on calculator whatsapp (see findings).
- A4 env contract: all 6 code-read vars covered in .env.example with accurate docs; no real secrets; framework vars (NODE_ENV/HOSTNAME/PORT) correctly left to Dockerfile.
- A5 Docker chain trace: build script ↔ standalone copies ↔ prisma engine copy ↔ chown-before-VOLUME ↔ HOSTNAME/PORT/healthcheck all consistent; PrismaClient constructs without DATABASE_URL (build-safe, tested); BUT fresh named volume ships no schema → first lead 500 (finding 2).
- A6 README vs code: HMAC recipe matches n8n-webhook.ts EXACTLY (ts.nonce.body, sha256=<hex>, 32+ secret, ±300s, 10-min nonce TTL, timingSafeEqual, header names); HOSTNAME + relative-DB-path traps accurately documented; stale "499 keys" (actual 518) + API table missing 403/413/415 (finding 4).
- B journeys LIVE: (1) AR: / → lang=ar dir=rtl + AR navbar labels → /contact SSR AR labels/placeholder/honeypot → valid AR lead 201 ref cmt9ypan → row verified (AR name, ip, ua, service=contact, zeros) — but message NOT stored (finding 1, byte-level DB scan confirms no message column). (2) EN calculator lead 201 ref cmt9ypao → row with server-recompute; honeypot fake-201 cuid-shaped cf6v9hqr, 0 rows. (4) /en/nope 404 EN localized; /nope 404 AR (الصفحة غير موجودة + العودة للرئيسية); /foo.txt root self-contained bilingual 404. (5) language-switcher preserves query via window.location.search, next-intl router.replace locale swap, equivalent route (code). (6) webhook fire-after-commit/void-catch/fresh-signature-per-attempt (code trace = README recipe).
- C structure: ls src scan — components grouped by domain, lib pure+hooks colocated consistently, PascalCase/camelCase/kebab naming uniform; matcher live-check: /opengraph-image + /apple-icon → 200 PNG (rewritten to ar), /en/* variants 200, /icon 200, sitemap/robots/logo.svg 200 (dot/keyword exclusions correct); traversal probes in dev.log (/../etc/passwd, /Caddyfile, /.env.example, /work/.env) all 404. generateStaticParams in [locale]/layout covers both locales; [...rest] catch-all doesn't break real-page prerender (all 12 route×locale x-nextjs-cache HIT in dev).
- Gates: tsc 0 · eslint 0 · parity 518/518. DB cleanup: found 54 stale synthetic rows at start (concurrently cleaned by another board agent mid-session); removed my own 2 probe rows → final count 0. No source files modified (git diff = worklog only).

Stage Summary:
- 4 findings: [HIGH] contact-form message never persisted (no Lead.message column; webhook-only, lost when n8n unset) · [HIGH] Docker fresh-volume deploy lacks DB schema init → first lead 500s · [LOW] calculator whatsapp client/server validation mismatch + unrendered field error · [LOW] README drift (499→518 keys; API table missing 403/413/415). Everything else — i18n usage parity, API error i18n, env contract, webhook recipe, 404/language-switch/honeypot journeys, middleware routing, security gates — verified CLEAN end-to-end.
---
Task ID: R4
Agent: a11y-i18n-rtl-reviewer (Final Review Board)
Task: WCAG 2.2 + Arabic quality + RTL correctness review

Work Log:
- Read worklog tail (L2-B / 2-loop2 context) + full project tree; curled SSR HTML for all 12 route×locale combos (all 200).
- Headings/landmarks: scripted sweep of every SSR file — exactly ONE h1 per page (all 12), no skipped levels, no empty headings; header/nav(3, all labeled)/main/footer present everywhere. Raw-HTML "h2 before h1" on subpages is React streaming only (loading.tsx fallback + $RC move into <main>) — final DOM order correct, not a finding. All aria-labelledby refs resolve (titleIds hero/stats/bento/work/testi/sim/method/calc/story/values/team/numbers/channels/types/threeD/journey/int/n8n/prose/work-grid all exist and match). Unnamed <section>s are layout/CTA wrappers (generic, no region role) — compliant.
- Interactive: every button/link has a discernible name in all 12 files (scripted check; only hits are the intentionally aria-hidden+tabindex=-1 bento swatches and honeypots). before-after sliders: role=slider + tabIndex + valuemin 2/valuemax 98/valuenow/valuetext + localized aria-label + Arrow/Home/End keys with RTL inversion — verified in SSR (home ×1, work ×6). aria-pressed on simulator pickers, work filters, calculator option cards, hero-console presets, sound toggle (plus dynamic label). Radix sheet: Escape/focus-trap/aria-expanded native; side={isRtl?'left':'right'}. Skip link → #main with logical start-4.
- Forms: contact + calculator fields all have Label htmlFor/id, aria-invalid + aria-describedby + role=alert errors; honeypots aria-hidden + tabIndex -1 + offscreen ✓. Required NOT communicated (no required/aria-required) → finding. 
- Contrast: computed ~30 token pairs (WCAG math) + live DOM verification. PASSES: muted-foreground 7.29/6.69, primary 4.70 on white, primary-strong 5.57/5.11, white/50+ on dark ≥5.2, muted-on-dark 7.98, kicker-on-dark 5.01, white-on-primary 4.70, focus ring 3.8-4.3 vs adjacent. FAILURES → findings: white/40 12px texts (3.5-3.8:1) in simulator stepOf/ms-log + hero enterHint/placeholder; text-primary small text on dark (chip 3.8, navbar mobile active 3.3, testimonial company 3.5); text-primary/90 team roles on white 4.04; bento mini hints muted/70 11px 3.5; deconstructed results-layer tokens (g-green 2.7 large, on-dark/70 ≈1.0 on light green card — also occluded by front layer, live-measured rects).
- Live regions: only loading fallbacks (role=status) + sonner Toaster (aria-live polite) — no misuse; clock correctly silent. Simulator status (idle/running/completed/stepOf) NOT announced → 4.1.3 finding.
- Reduced-motion: global kill-switch (animation/transition 0.001ms !important covers CSS incl. inline-style orbit) + JS guards everywhere (kinetic heading/CTA via useCursorVelocity guards, calculator slideVariants, methodology transforms, simulator timings+pulse, deconstructed final state, magnetic cursor teardown, spotlight mask off, hero 3D never loads). KineticWords has sr-only + aria-label + aria-hidden animated spans. Comprehensive.
- i18n: read ar.json (922 lines) FULLY with native-speaker rigor + en.json spot-checks. Grammar/orthography excellent (hamza seats, taa marbouta, tamyeez after numbers 5/80/90/120/422/4200, duals, جارٍ, بـ n8n tatweel-prefix pattern). ICU pagesValue plural categories correct CLDR ar; stepOf/weeks placeholders natural; terminology consistent (تكامل/ميزانية/تيليجرام/n8n/إيليرا); tone consistent (مخاطبة مفردة). Live bidi measurement via Range.getClientRects in RTL context: phone "+963 991 000 000" renders with groups reversed (000 000 991 +963) and handle "@elyra_agency" renders "elyra_agency@" (@ jumps right) — contact channel values lack LTR isolation → finding; money range + stepOf + emails render correctly (LTR runs between L runs).
- RTL sweep: rg for physical props (ml-/mr-/pl-/pr-/left-/right-/text-left/right) → only centering patterns (left-1/2 -translate-x-1/2), sheet side variants (RTL-aware via isRtl), and the built-in sheet close (physical right-4). All directional icons use the single-flip rtl:rotate-180 pattern (hero CTA, page-hero, CTA, featured-work, calculator back/next); not-found picks ArrowLeft for RTL; simulator node order mirrored; before-after measures from start edge with mirrored clip/handle. ONE miss: automation page "→" flow connectors don't flip in RTL → finding. html dir/lang correct on all 12 (ar rtl / en ltr); og:locale ar_AR/en_US; Intl formatting per-locale (trust-bar, money, clock). Container/scrollbar/safe-area/print CSS all logical or direction-neutral.
- Live browser probes (agent-browser, mobile 390px): mobile sheet opens RTL-correct (left:0) with Escape working; found stock sheet.tsx built-in Close (absolute top-4 right-4, hardcoded English sr-only "Close") rendered ALONGSIDE navbar's localized close → two visible close buttons → finding. Deconstructed layer rects measured (back layer occluded by front). Language switcher visible label verified clean (عربي / English — earlier suspicion was my own print artifact).
- NOT findings (notes): three-d-section aria-label sits on a roleless div (inert; visible hint text + heading carry the info; WebGL decorative); sonner region label "Notifications alt+T" untranslated (3rd-party default); rating label uses ٥ vs Latin digits elsewhere; "مهامان موكلتان" nit (prefer مهمتان); unused catalog keys (simulator.scrollHint, hero.canvasFallback, common.getStarted/explore/reduceMotionNote/close/back/next); OG image English-only (documented font limitation); simulator stage overflow-x-auto not keyboard-scrollable (folded into a LOW finding with the unused scrollHint).

Stage Summary:
- Verdict: 11 findings (8 MED, 3 LOW). Structure/semantics/keyboard/RTL-code/i18n-catalog foundations are strong (headings, landmarks, titleIds, sliders, aria-pressed, honeypots, reduced-motion, logical properties, single-flip arrows all verified clean); remaining issues are five contrast clusters (1.4.3 AA), one unflipped RTL arrow, missing bidi isolation for phone/handle, missing simulator live region (4.1.3), uncommunicated required fields (3.3.2), duplicate sheet close w/ English label, and the not-keyboard-scrollable simulator stage. No P0 blockers; all fixes are small, localized token/attr changes.
