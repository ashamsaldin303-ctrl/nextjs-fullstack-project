<!--
  F-S6-09 (audit r2): short single-maintainer PR checklist — the gates the
  CI workflow already runs locally, plus the two human checks automation
  cannot do (bilingual visual review at mobile width). Delete lines that
  do not apply to the change.
-->

## What & why

<!-- One paragraph: what changes, which finding/spec it resolves, the user-visible effect. -->

## Before opening

- [ ] `bunx tsc --noEmit` — 0 errors
- [ ] `bun run lint` — 0 errors/warnings
- [ ] `bun run check:i18n` (i18n parity) — pass; any NEW identical AR/EN pairs reviewed
- [ ] No secrets in the diff (`bun scripts/check-secrets.mjs` clean)
- [ ] Copy changes exist in BOTH messages/ar.json and messages/en.json

## Visual review (UI-touching PRs only)

- [ ] AR (RTL) checked at **390×844** — no overflow (`document.documentElement.scrollWidth ≤ 390`), no overlaps
- [ ] EN (LTR) mirror checked
- [ ] Screenshots or a short screen-recording attached (AR + EN)
- [ ] Motion changes: reduced-motion path checked (animations collapse, content intact)

## 3D / WebGL PRs

- [ ] Dev-server console free of NEW three.js warnings/errors
- [ ] Memory: no new listeners/contexts without teardown (dispose/forceContextLoss discipline)
- [ ] Mobile tier still gated (useMobileTier) — no unintended mobile mounts

## Money-path PRs (calculator / contact form / /api/leads)

- [ ] `bun scripts/verify-api.mjs` — 13/13 against a running server
- [ ] Zod schemas stay in sync with src/lib/lead-fields.ts (single source of truth)
