# =============================================================================
# Elyra — production image (Phase 3, prompt §5.2)
#
# Multi-stage build for the Next.js standalone output. Mirrors the local
# build script (next build + static/public copies into .next/standalone).
#
# Build:
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://elyra.agency -t elyra .
#
# Run (HOSTNAME=0.0.0.0 — see README "Deployment" for the 127.0.0.1 trap):
#   docker run -p 3000:3000 \
#     -e DATABASE_URL=file:/app/db/custom.db \
#     -e N8N_WEBHOOK_URL=... -e N8N_WEBHOOK_SECRET=... \
#     -v elyra-db:/app/db elyra
#
# NOTE (untested in this sandbox): Docker is unavailable here — the file
# follows the documented Next.js standalone + Prisma pattern. Verify once
# in a Docker-capable environment before relying on it.
# =============================================================================

# --- Stage 1: dependencies --------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- Stage 2: build -----------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are INLINED at build time — canonical/SEO depend on it.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
# Prisma client generation (schema lives in the repo)
RUN bunx prisma generate
# package.json build script = next build + copy static/public into standalone
RUN bun run build

# Initialize an empty SQLite DB with the Lead schema so a fresh named
# volume seeds from the image (first lead insert would otherwise 500
# with P2021 — final-board R6). Prisma CLI is available in this stage.
# NOTE: the URL must be ABSOLUTE — the Prisma CLI resolves relative
# SQLite paths against prisma/schema.prisma, not the CWD (verified live:
# file:./db/custom.db would land at /app/prisma/db/custom.db).
RUN mkdir -p db && DATABASE_URL="file:/app/db/custom.db" bunx prisma db push --skip-generate

# --- Stage 3: runtime ---------------------------------------------------------
FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    # Self-default so a bare `docker run` (without -e DATABASE_URL) works:
    # the standalone server loads no .env, and prisma's env("DATABASE_URL")
    # has no literal fallback — without this, the container boots healthy
    # but every lead insert 500s (closing verification V-A-1). An operator
    # -e DATABASE_URL=... overrides this default.
    DATABASE_URL=file:/app/db/custom.db

# Standalone server + already-copied static assets & public dir
COPY --from=build /app/.next/standalone ./

# Prisma engines can be missed by Next's output file tracing — copy explicitly.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Initialized SQLite DB (schema pushed in the build stage) — a fresh named
# volume seeds its content from the image on first mount, so the first
# lead insert can't 500 with P2021 (final-board R6). Runs BEFORE the
# chown so the DB file ends up owned by bun.
COPY --from=build /app/db ./db

# SQLite storage directory (mount a volume here in production)
RUN mkdir -p /app/db

# Non-root runtime (audit P2-6): oven/bun ships the `bun` user. Own
# everything — including the db directory — so SQLite writes work
# without root. NOTE: this MUST run BEFORE the VOLUME declaration —
# Docker discards build-time changes made to a path after VOLUME is
# declared, which would leave the mount point root-owned (L2-A).
RUN chown -R bun:bun /app
VOLUME /app/db
USER bun

EXPOSE 3000

# Liveness probe without a curl dependency (audit P2-6): the standalone
# server listens on 127.0.0.1:3000 (HOSTNAME=0.0.0.0 in standalone mode).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "server.js"]
