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

# --- Stage 3: runtime ---------------------------------------------------------
FROM oven/bun:1 AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# Standalone server + already-copied static assets & public dir
COPY --from=build /app/.next/standalone ./

# Prisma engines can be missed by Next's output file tracing — copy explicitly.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# SQLite storage directory (mount a volume here in production)
RUN mkdir -p /app/db
VOLUME /app/db

EXPOSE 3000
CMD ["bun", "server.js"]
