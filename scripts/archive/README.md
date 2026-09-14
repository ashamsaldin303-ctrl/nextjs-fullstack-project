# Archived one-off scripts (F-S6-06, audit r2)

Superseded verification/tooling rolls from earlier project phases. Kept for
provenance (each documents a live verification pass recorded in the root
worklog), never referenced by CI or package.json. Safe to delete wholesale
if the repo is ever handed over without history.

- fetch-models-m3.mjs — MODEL-3 era asset fetch helper
- verify-models-m3.mjs / verify-models-m3-mobile.mjs — superseded by
  verify-models-m4*.mjs / verify-models-m7.mjs (kept one level up)
- verify-ref4.mjs — REF-4 one-shot verifier
- shoot-model4.mjs — one-time MODEL-4 screenshot roll
- diag-en-mirror.mjs — one-shot EN mirror diagnostic (the parity problem
  it diagnosed is now guarded by check-i18n-parity.js in CI)
- probe-mobile-feasibility.mjs — MOBILE-1 feasibility probe (findings
  shipped as MOBILE-2; conclusions live in the worklog)

Live scripts one level up: CI gates (check-*), verify-api / verify-performance
(CI dispatch jobs), verify-models-m4* / m7 + verify-sensory* (QA harnesses),
clean-leads.ts / resend-webhook.ts (operator tools), stitch.ts / _stitch.ts
(Stitch design workflow), _playwright.mjs (shared browser helper), plus
lighthouse-prod.sh + gen-sbom.mjs.
