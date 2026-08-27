/**
 * In-memory sliding-window rate limiter (Phase 3, prompt §3.1).
 *
 * Two buckets per key (client IP), same 60s sliding window:
 *
 *   'lenient'  30 req/min — meters EVERY request that reaches the
 *              handler (valid or not). It only exists to blunt
 *              flood/abuse spam; a validation error must not lock a
 *              real visitor out of the strict quota (Batch 2 item 10 —
 *              the single 5/min bucket previously counted 400-rejected
 *              payloads, so a few typos triggered a 429).
 *   'strict'    5 req/min — burned ONLY by requests that made it all
 *              the way to a persisted write (the 201 path); the leads
 *              route checks it immediately before db.lead.create.
 *
 * Pure in-memory with a periodic sweep so the Map never grows
 * unbounded — this server runs as a single Node process (standalone
 * output), so process-local state is sufficient. A distributed
 * deployment would move this to Redis, which is explicitly out of
 * scope for this project.
 */

const WINDOW_MS = 60_000
const MAX_HITS_STRICT = 5
const MAX_HITS_LENIENT = 30
const SWEEP_INTERVAL_MS = 60_000
/** Hard cap on tracked keys — see evictOverCap() (audit P1-1). */
const MAX_KEYS = 5_000
/** How many oldest keys to drop once the cap is exceeded. */
const EVICT_BATCH = 1_000

/** Bucket selector — see the module doc above for the semantics. */
export type RateLimitBucket = 'strict' | 'lenient'

// Both buckets share one Map: keys are namespaced with a short prefix
// so the sweep/cap logic below stays a single code path.
const hits = new Map<string, number[]>()
let lastSweep = 0

/** Drops expired timestamps (and now-empty keys) — the time-based half. */
function sweepExpired(now: number): void {
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS)
    if (fresh.length === 0) hits.delete(key)
    else hits.set(key, fresh)
  }
}

/**
 * Hard cap against key-flooding (audit P1-1): a spoofed-header client
 * can mint unlimited distinct keys, so bound the Map's memory growth.
 * Map preserves insertion order — drop the oldest EVICT_BATCH entries
 * past cap.
 */
function evictOverCap(): void {
  if (hits.size > MAX_KEYS) {
    let toDelete = EVICT_BATCH
    for (const key of hits.keys()) {
      if (toDelete-- <= 0) break
      hits.delete(key)
    }
  }
}

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  sweepExpired(now)
  evictOverCap()
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the oldest hit leaves the window (for Retry-After). */
  retryAfterSec: number
}

/**
 * Check-and-record a hit in the given bucket (default 'strict' — the
 * historical single-bucket behavior, kept as the default so any future
 * caller gets the conservative quota).
 */
export function rateLimit(
  key: string,
  bucket: RateLimitBucket = 'strict',
  now = Date.now()
): RateLimitResult {
  sweep(now)
  const mapKey = bucket === 'strict' ? `s:${key}` : `l:${key}`
  const maxHits = bucket === 'strict' ? MAX_HITS_STRICT : MAX_HITS_LENIENT
  const existing = hits.get(mapKey)
  const windowHits = (existing ?? []).filter((t) => now - t < WINDOW_MS)

  if (windowHits.length >= maxHits) {
    const oldest = windowHits.at(0) ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfterSec }
  }

  // Inline size guard (L1-A P3 fix): the throttled sweep above can let
  // the Map grow for up to SWEEP_INTERVAL_MS between runs. If this hit
  // would INSERT a brand-new key while the Map is at/over the cap, run
  // the cleanup inline right now — the freshly-minted flood keys are the
  // oldest entries, so eviction here bounds the steady-state size
  // without waiting for the next sweep. (Worst case the Map overshoots
  // MAX_KEYS by one when it sits exactly at the cap — harmless.)
  if (existing === undefined && hits.size >= MAX_KEYS) {
    sweepExpired(now)
    evictOverCap()
  }

  windowHits.push(now)
  hits.set(mapKey, windowHits)
  return { allowed: true, retryAfterSec: 0 }
}

/**
 * Refunds the NEWEST hit recorded for `key` in `bucket` (L1-B P3 fix):
 * the leads route burns the strict slot BEFORE `db.lead.create`, so a
 * failed write would otherwise leave the visitor one submission poorer
 * out of only 5/min. Removes only the most recent timestamp — this
 * module is synchronous and the runtime single-threaded, so the newest
 * hit is exactly the one the caller just recorded unless a concurrent
 * same-key request interleaved (worst case: that request gets a free
 * slot — a bounded one-hit over-refund on a rare failure path).
 */
export function refundRateLimit(
  key: string,
  bucket: RateLimitBucket = 'strict',
  now = Date.now()
): void {
  const mapKey = bucket === 'strict' ? `s:${key}` : `l:${key}`
  const fresh = (hits.get(mapKey) ?? []).filter((t) => now - t < WINDOW_MS)
  fresh.pop()
  if (fresh.length === 0) hits.delete(mapKey)
  else hits.set(mapKey, fresh)
}
