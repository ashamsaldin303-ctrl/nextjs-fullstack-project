/**
 * In-memory sliding-window rate limiter (Phase 3, prompt §3.1).
 *
 * 5 requests / 60s / key (client IP). Pure in-memory with a periodic sweep
 * so the Map never grows unbounded — this server runs as a single Node
 * process (standalone output), so process-local state is sufficient.
 * A distributed deployment would move this to Redis, which is explicitly
 * out of scope for this project.
 */

const WINDOW_MS = 60_000
const MAX_HITS = 5
const SWEEP_INTERVAL_MS = 60_000

const hits = new Map<string, number[]>()
let lastSweep = 0

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS)
    if (fresh.length === 0) hits.delete(key)
    else hits.set(key, fresh)
  }
  // Hard cap against key-flooding (audit P1-1): a spoofed-header client
  // can mint unlimited distinct keys, so bound the Map's memory growth.
  // Map preserves insertion order — drop the oldest 1_000 entries past cap.
  if (hits.size > 5_000) {
    let toDelete = 1_000
    for (const key of hits.keys()) {
      if (toDelete-- <= 0) break
      hits.delete(key)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the oldest hit leaves the window (for Retry-After). */
  retryAfterSec: number
}

export function rateLimit(key: string, now = Date.now()): RateLimitResult {
  sweep(now)
  const windowHits = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)

  if (windowHits.length >= MAX_HITS) {
    const oldest = windowHits.at(0) ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfterSec }
  }

  windowHits.push(now)
  hits.set(key, windowHits)
  return { allowed: true, retryAfterSec: 0 }
}

/** Test hook — clears all tracked windows. */
export function resetRateLimiter(): void {
  hits.clear()
}
