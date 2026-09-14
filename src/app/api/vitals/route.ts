import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { logger } from '@/lib/logger'

/**
 * POST /api/vitals — web-vitals RUM collector (F-S3-06 / F-S4-02 /
 * F-S8-02 partial — gold-standard audit: "no production CWV measurements /
 * no RUM data"). The client beacon (components/layout/web-vitals.tsx)
 * reports LCP / INP / CLS / TTFB / FCP via useReportWebVitals.
 *
 * Contract:
 *   - Zero PII: metric name, value, rating, a random metric id, page path
 *     (path only — no query, no referrer), navigation type. The path is
 *     validated against a strict allowlist shape (leading slash, no
 *     protocol/host, length-capped) so the store cannot be poisoned with
 *     arbitrary strings.
 *   - POST: 204 always (body-less success keeps beacons cheap); errors are
 *     also body-less and silent — a RUM failure must never surface in UX.
 *     Lenient rate limit (30/min/IP). Storage is TWO-TIER (F-S4-03):
 *     (a) the in-memory ring (last 2,000 samples, per-process — kept
 *     exactly as before for cheap diagnostics) and (b) fire-and-forget
 *     SQLite persistence (Prisma `VitalSample`) so data survives restarts
 *     and feeds the GET summary. The 204 NEVER waits on the DB; a DB
 *     failure is silent by contract (the beacon response must not change).
 *     Retention: every 500th write fire-and-forget-prunes rows older than
 *     90 days.
 *   - GET — operator p75 summary (F-S4-03): `GET /api/vitals?token=…`
 *     where token must equal the VITALS_TOKEN env (timing-safe compare).
 *     Returns { generatedAt, window: '7d', routes: { [route]: { [metric]:
 *     { p75, samples, ratingAtP75 } } } } over the last 7 days (p75 via
 *     the nearest-rank method, computed in JS — volume is small).
 *     VITALS_TOKEN unset → 404 (feature dark — indistinguishable from a
 *     missing route); wrong token → 401. Same lenient rate-limit bucket +
 *     content-type gate style as POST; every response carries no-store
 *     (the token rides the query string — no shared cache may retain it).
 *   - Rate-limit IP derivation is the SHARED @/lib/client-ip module
 *     (F-S2-07 — identical TRUST_PROXY gate + net.isIP validation +
 *     x-real-ip fallback as /api/leads; previously this route read the raw
 *     XFF last element with no validation).
 */

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 2 * 1024
const RING_CAPACITY = 2_000

/** F-S4-03: retention — prune persisted samples older than 90 days. */
const RETENTION_DAYS = 90
/** F-S4-03: prune cadence — every 500th persisted write (module counter). */
const PRUNE_EVERY_WRITES = 500
/** GET summary window (days) — matches the `window: '7d'` response field. */
const SUMMARY_WINDOW_DAYS = 7

const METRIC_NAMES = new Set(['LCP', 'INP', 'CLS', 'TTFB', 'FCP'])
const RATINGS = new Set(['good', 'needs-improvement', 'poor'])
const NAV_TYPES = new Set([
  'navigate',
  'reload',
  'back-forward',
  'back_forward',
  'prerender',
  'restore',
  '',
])

const vitalSchema = z.strictObject({
  name: z.string().refine((v) => METRIC_NAMES.has(v)),
  value: z.number().finite().nonnegative(),
  rating: z.string().refine((v) => RATINGS.has(v)),
  id: z.string().min(1).max(64),
  navigationType: z.string().max(24).refine((v) => NAV_TYPES.has(v)),
})

const payloadSchema = z.strictObject({
  route: z
    .string()
    .min(1)
    .max(200)
    .refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.includes(':')),
  metrics: z.array(vitalSchema).min(1).max(10),
})

/** In-memory ring — single-process standalone server (same contract as the
 *  rate limiter). Newest wins; index wraps. */
type Sample = {
  name: string
  value: number
  rating: string
  route: string
  nav: string
  at: string
}
const ring: Sample[] = []
let ringIndex = 0

function record(sample: Sample): void {
  if (ring.length < RING_CAPACITY) {
    ring.push(sample)
  } else {
    ring[ringIndex] = sample
    ringIndex = (ringIndex + 1) % RING_CAPACITY
  }
}

/* ------------------------------------------------------------------ */
/* Persistence (F-S4-03)                                               */
/* ------------------------------------------------------------------ */

/** Module-level write counter — drives the every-500th-write retention
 *  prune. Process-local by design (same single-process contract as the
 *  ring + rate limiter; see deploy/OPERATIONS.md). */
let persistWrites = 0

/**
 * Fire-and-forget SQLite persistence. NEVER awaited on the beacon path,
 * NEVER allowed to change the 204: a DB failure is swallowed whole
 * (silent by contract — a RUM outage must not surface in UX, and the ring
 * + log lines still carry the signal).
 */
function persist(
  m: { name: string; value: number; rating: string; navigationType: string },
  route: string
): void {
  void (async () => {
    try {
      await db.vitalSample.create({
        data: {
          name: m.name,
          value: m.value,
          rating: m.rating,
          route,
          nav: m.navigationType,
        },
      })
    } catch {
      /* silent by contract */
    }
  })()
  if (++persistWrites % PRUNE_EVERY_WRITES === 0) {
    // Retention prune — also fire-and-forget, off the response path.
    void (async () => {
      try {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000)
        await db.vitalSample.deleteMany({ where: { at: { lt: cutoff } } })
      } catch {
        /* silent by contract */
      }
    })()
  }
}

/* ------------------------------------------------------------------ */
/* GET — operator p75 summary (F-S4-03)                                */
/* ------------------------------------------------------------------ */

/**
 * Timing-safe token compare over equal-length buffers (hygiene, matching
 * the CSRF/webhook standards in this repo): a plain !== short-circuits at
 * the first differing byte. Length mismatch is a plain reject —
 * timingSafeEqual throws on unequal lengths, and the length itself is not
 * secret.
 */
function tokenEquals(provided: string | null, expected: string): boolean {
  if (provided === null) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/**
 * p75 via the nearest-rank method: the smallest value whose cumulative
 * share reaches 75% — rank = ceil(0.75·n), 1-based. Null for an empty
 * bucket (no entry emitted — a route with no samples for a metric is
 * simply absent from the summary).
 */
function p75Of(
  samples: { value: number; rating: string }[]
): { p75: number; samples: number; ratingAtP75: string } | null {
  if (samples.length === 0) return null
  const sorted = [...samples].sort((x, y) => x.value - y.value)
  const rank = Math.max(1, Math.ceil(0.75 * sorted.length))
  const at = sorted[rank - 1]
  if (at === undefined) return null
  return {
    p75: Math.round(at.value * 1000) / 1000,
    samples: sorted.length,
    ratingAtP75: at.rating,
  }
}

export async function GET(req: NextRequest) {
  // Feature-dark when VITALS_TOKEN is unset: 404, indistinguishable from
  // a missing route (operators opt in by setting the env).
  const expected = process.env.VITALS_TOKEN
  if (!expected) {
    return new NextResponse(null, {
      status: 404,
      headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' },
    })
  }

  // Same contract style as POST: content-type gate (a GET carries no
  // Content-Type by default — anything present must still be JSON), then
  // the lenient bucket. Metering BEFORE the token compare also blunts
  // token brute-force (30 guesses/min/IP max).
  const mediaType =
    (req.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (mediaType !== '' && mediaType !== 'application/json') {
    return new NextResponse(null, {
      status: 415,
      headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' },
    })
  }
  const rl = rateLimit(clientIp(req), 'lenient')
  if (!rl.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: {
        Allow: 'POST, GET, OPTIONS',
        'Cache-Control': 'no-store',
        'Retry-After': String(rl.retryAfterSec),
      },
    })
  }

  if (!tokenEquals(req.nextUrl.searchParams.get('token'), expected)) {
    return new NextResponse(null, {
      status: 401,
      headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' },
    })
  }

  try {
    const since = new Date(Date.now() - SUMMARY_WINDOW_DAYS * 86_400_000)
    const rows = await db.vitalSample.findMany({
      where: { at: { gte: since } },
      select: { name: true, value: true, rating: true, route: true },
    })

    // route → metric → samples. Volume is small (beacons ≤5/metric/
    // pageload) — plain JS grouping beats any SQL pivot here.
    const routes = new Map<string, Map<string, { value: number; rating: string }[]>>()
    for (const row of rows) {
      let metrics = routes.get(row.route)
      if (metrics === undefined) {
        metrics = new Map()
        routes.set(row.route, metrics)
      }
      const list = metrics.get(row.name)
      if (list === undefined) {
        metrics.set(row.name, [{ value: row.value, rating: row.rating }])
      } else {
        list.push({ value: row.value, rating: row.rating })
      }
    }

    const summary: Record<
      string,
      Record<string, { p75: number; samples: number; ratingAtP75: string }>
    > = {}
    for (const [route, metrics] of routes) {
      const perMetric: Record<
        string,
        { p75: number; samples: number; ratingAtP75: string }
      > = {}
      for (const [name, list] of metrics) {
        const r = p75Of(list)
        if (r !== null) perMetric[name] = r
      }
      summary[route] = perMetric
    }

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), window: '7d', routes: summary },
      { headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    // Operator-facing endpoint (unlike the beacon): report the failure,
    // keep the body generic.
    logger.error('vitals', 'summary query failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return new NextResponse(null, {
      status: 500,
      headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' },
    })
  }
}

/* ------------------------------------------------------------------ */
/* POST — the beacon (unchanged contract + persistence)                */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  // Cheap gates mirror the leads route: size, media type.
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413, headers: { 'Cache-Control': 'no-store' } })
  }
  const mediaType =
    (req.headers.get('content-type') ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
  if (mediaType !== 'application/json') {
    return new NextResponse(null, { status: 415, headers: { 'Cache-Control': 'no-store' } })
  }

  // Same-origin beacons only (Sec-Fetch-Site gate; header-less tools pass
  // as everywhere else — validation still caps what they can store).
  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') {
    return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }

  // F-S2-07: shared derivation — identical to /api/leads (TRUST_PROXY
  // gate + net.isIP validation + x-real-ip fallback).
  const rl = rateLimit(clientIp(req), 'lenient')
  if (!rl.allowed) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rl.retryAfterSec) },
    })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return new NextResponse(null, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) {
    return new NextResponse(null, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const at = new Date().toISOString()
  for (const m of parsed.data.metrics) {
    record({ name: m.name, value: m.value, rating: m.rating, route: parsed.data.route, nav: m.navigationType, at })
    // F-S4-03: persisted copy (PARSED values — the route string already
    // passed the strict allowlist shape above). Fire-and-forget.
    persist(m, parsed.data.route)
    if (m.rating === 'poor') {
      logger.warn('vitals', 'poor rating received', {
        metric: m.name,
        value: Math.round(m.value * 100) / 100,
        route: parsed.data.route,
        nav: m.navigationType || 'unknown',
      })
    }
  }

  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, GET, OPTIONS', 'Cache-Control': 'no-store' },
  })
}
