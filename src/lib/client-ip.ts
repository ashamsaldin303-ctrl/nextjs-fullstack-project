/**
 * Rate-limit key derivation — shared by /api/leads and /api/vitals
 * (F-S2-07, gold-standard audit: the vitals route used to derive the IP
 * differently — raw XFF last element with no net.isIP validation and no
 * x-real-ip fallback — so the two routes disagreed on bucket identity
 * under the same proxy topology).
 *
 * Extracted VERBATIM from the leads route (the stricter implementation);
 * see that route's history for the original rationale, summarized here:
 *
 * X-Forwarded-For / X-Real-IP are trivially spoofable by any client that
 * reaches the app directly — trusting them unconditionally lets an attacker
 * rotate the header for a fresh bucket per request. They are honored ONLY
 * when TRUST_PROXY=true, i.e. behind a trusted reverse proxy that
 * OVERWRITES these headers with the real client address (the included
 * deploy/Caddyfile.example does). Otherwise fail closed: all callers share
 * the single 'anonymous' bucket.
 *
 * When X-Forwarded-For carries a LIST, the LAST element is used, never the
 * first: appending proxies grow the list rightward — spoofed
 * client-supplied entries first, the proxy's own trusted observation LAST —
 * so the first element is attacker-controlled and reading it would allow
 * rate-limit bucket rotation. Under an overwriting proxy the list holds a
 * single element, where first and last coincide. Appending proxies are not
 * supported at all with TRUST_PROXY=true (see .env.example).
 *
 * F-S1-06 (gold-standard audit): the extracted value is additionally
 * VALIDATED with net.isIP — under operator misconfiguration (direct
 * exposure with TRUST_PROXY=true) an attacker crafts arbitrary XFF strings
 * to mint unlimited distinct bucket keys; non-IP garbage collapses to the
 * shared 'anonymous' bucket instead of a free bucket printer.
 */

import { isIP } from 'node:net'
import type { NextRequest } from 'next/server'

/**
 * The rate-limit key for a request: the validated client IP when proxy
 * trust is enabled, otherwise the shared 'anonymous' bucket (fail-closed
 * default — F-S2-01 trade-off, see .env.example + deploy/OPERATIONS.md).
 */
export function clientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY !== 'true') return 'anonymous'
  const xff = req.headers.get('x-forwarded-for')
  const last = xff?.split(',').pop()?.trim()
  if (last && isIP(last) !== 0) return last
  const real = req.headers.get('x-real-ip')
  if (real && isIP(real) !== 0) return real
  return 'anonymous'
}
