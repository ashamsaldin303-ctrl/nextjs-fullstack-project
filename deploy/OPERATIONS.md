# Elyra — Operations Runbook (deploy/)

Terse, factual. Companion files here: `Caddyfile.example` (production
reverse proxy), `leads-purge.service` + `leads-purge.timer` (PII retention
systemd units). Audit refs: F-S1-04, F-S2-01, F-S2-05, F-S4-03.

## 1. Deployment checklist (hard steps, in order)

1. **Env vars in the production `.env`** (copy from `.env.example`):
   - `DATABASE_URL` — ABSOLUTE SQLite path (relative paths break writes in
     the standalone server; see `.env.example` H-3 note).
   - `NEXT_PUBLIC_SITE_URL` — required at BUILD time (canonical/SEO;
     `next build` hard-fails without it).
   - `NEXT_PUBLIC_CONTACT_*` — the REAL email / WhatsApp / Telegram values
     (the WhatsApp code default is the placeholder — audit F-S5-01/D26;
     `STRICT_CONTACT=1 node scripts/check-site-contact.mjs` fails on it).
   - `N8N_WEBHOOK_URL` + `N8N_WEBHOOK_SECRET` (32+ chars, `openssl rand -hex 32`)
     — optional; the webhook is silently disabled when unset.
   - `VITALS_TOKEN` — optional; enables `GET /api/vitals?token=…` (p75 RUM
     summary). Unset = feature dark (404).
   - `TRUST_PROXY=true` — see step 3; MUST stay `false` for direct exposure.
2. **Build & run the container** (see Dockerfile header):
   `docker run -p 127.0.0.1:3000:3000 …` — bind loopback ONLY.
3. **Front it with the overwriting reverse proxy**: copy
   `deploy/Caddyfile.example` to `/etc/caddy/Caddyfile`, edit the site
   address, `caddy reload`. THEN pass `-e TRUST_PROXY=true` to the app —
   the proxy OVERWRITES `X-Forwarded-For` / `X-Real-IP` with the real
   client address, which is the only topology where proxy-trust is safe.
   The container HEALTHCHECK prints a stderr warning on every probe while
   `TRUST_PROXY != true` (one global rate-limit bucket — F-S2-01); it
   never fails the deploy unless `TRUST_PROXY_STRICT=1` is set.
4. **Enable the leads purge timer** (section 2 below) — PII retention is
   a scheduled job, NOT an operator memory task (F-S1-04).
5. **Verify**: `curl -fsS https://<site>/` and submit a test lead; check
   `docker logs` for the `api/leads` completion line.

## 2. Leads purge — systemd timer (audit P2-8 / F-S1-04)

`scripts/clean-leads.ts` flags (exact behavior — see its header):

```bash
bun scripts/clean-leads.ts --purge-days=90          # delete Lead rows older than 90 days
bun scripts/clean-leads.ts --purge-days=90 --dry-run # count only
bun scripts/clean-leads.ts --all                     # full wipe (explicit flag REQUIRED —
                                                     # a bare run prints usage and exits 1)
```

Ship + enable the units (paths assume `/opt/elyra`; adjust to taste):

```bash
cp deploy/leads-purge.service deploy/leads-purge.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now leads-purge.timer     # daily, Persistent=true (catches up after downtime)
systemctl list-timers leads-purge.timer      # confirm next run
journalctl -u leads-purge.service -n 5       # "purged N lead(s) older than 90 day(s)"
```

The unit runs `bun scripts/clean-leads.ts --purge-days=90` as the app user
from the app directory (bun auto-loads its `.env` → `DATABASE_URL`).

## 3. Single-process design note (F-S2-05)

The standalone server is ONE Node process by design. All volatile state is
in-memory and per-process:

- **Rate limits** (`src/lib/rate-limit.ts`) — sliding-window Map, strict
  5/min/IP + lenient 30/min/IP buckets.
- **RUM ring** (`src/app/api/vitals/route.ts`) — last 2,000 samples.

Multi-instance (replicas, load balancing) would need a shared store
(Redis-backed limiter + a ring drain) — explicitly out of scope. The RUM
*persistence* added for F-S4-03 (SQLite `VitalSample`) and the leads table
themselves ARE shared state and survive restarts.

## 4. Operator tooling quick reference

- **Failed-webhook replay** (F-S2-04):
  `bun scripts/resend-webhook.ts [--limit=25] [--dry-run]` — re-sends the
  HMAC-signed n8n webhook for leads with `webhookStatus='failed'`.
- **RUM p75 summary** (F-S4-03):
  `curl 'https://<site>/api/vitals?token=<VITALS_TOKEN>'` — p75 per
  route/metric over 7 days. 401 = wrong token; 404 = `VITALS_TOKEN` unset.
- **CVE scan** (F-S1-03): `node scripts/check-osv.mjs` (warn-only;
  `STRICT=1` exits 1 on high/critical with a fix available).
