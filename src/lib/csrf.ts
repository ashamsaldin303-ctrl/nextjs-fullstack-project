/**
 * CSRF double-submit contract (F-S1-04 — gold-standard audit).
 *
 * Shared constants for the three parties:
 *   - src/proxy.ts      → issues/rotates the `elyra-csrf` cookie
 *   - lib/lead-http.ts  → client echo (reads the cookie, sends the header)
 *   - api/leads/route   → enforcement (cookie present → header must match)
 *
 * No logic lives here on purpose: proxy.ts runs on the Edge runtime, the
 * route on Node, the helper in the browser — constants are the only safe
 * shared surface.
 */
export const CSRF_COOKIE = 'elyra-csrf'
export const CSRF_HEADER = 'x-csrf-token'
