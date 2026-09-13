import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
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
 *   - 204 always (body-less success keeps beacons cheap); errors are
 *     also body-less and silent — a RUM failure must never surface in UX.
 *   - Lenient rate limit (30/min/IP) — beacons are tiny and few (≤5 per
 *     pageload, sent once per metric via sendBeacon).
 *   - Storage: in-memory ring buffer (last 2,000 samples) + structured
 *     log lines for 'poor' ratings (the drain owns aggregation). The
 *     audit's 90-day roadmap can later point a scraper at a drain or a
 *     summary endpoint behind an operator token — the collection surface
 *     exists from day one either way.
 */

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 2 * 1024
const RING_CAPACITY = 2_000

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

  const ip =
    process.env.TRUST_PROXY === 'true'
      ? req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'anonymous'
      : 'anonymous'
  const rl = rateLimit(ip, 'lenient')
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

export async function GET() {
  // Method contract mirrors the leads route: explicit 405 + Allow.
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' },
  })
}
