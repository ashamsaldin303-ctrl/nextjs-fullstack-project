import { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { CSRF_COOKIE } from '@/lib/csrf'
import { logger } from '@/lib/logger'

// Next.js 16: proxy.ts replaces middleware.ts (see guide §1.3).
const intlMiddleware = createMiddleware(routing)

/* ------------------------------------------------------------------ */
/* CSRF double-submit token (F-S1-04 — gold-standard audit)            */
/* ------------------------------------------------------------------ */

/** 128 bits → 32 hex chars (Web Crypto: Edge AND Node compatible). */
function csrfToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * F-S1-06 (gold-standard audit, TRUST_PROXY hard requirement): loud
 * one-time warning when TRUST_PROXY is enabled — the operator MUST front
 * the app with an OVERWRITING reverse proxy (deploy/Caddyfile.example).
 * A misconfigured direct exposure makes XFF-derived rate-limit keys
 * attacker-choosable. (The leads route additionally validates the XFF
 * value shape via net.isIP — garbage collapses to the shared 'anonymous'
 * bucket.)
 */
let trustProxyWarned = false
function warnTrustProxy(req: NextRequest): void {
  if (trustProxyWarned || process.env.TRUST_PROXY !== 'true') return
  trustProxyWarned = true
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const xffEntries = xff === '' ? 0 : xff.split(',').length
  logger.warn(
    'proxy',
    'TRUST_PROXY=true — every direct hop to the app is now trusted as a proxy; an OVERWRITING reverse proxy must front this process (deploy/Caddyfile.example)',
    { multiHopXff: xffEntries > 1, xffEntries },
  )
}

export default function proxy(req: NextRequest) {
  warnTrustProxy(req)

  const res = intlMiddleware(req)

  // Issue/rotate the CSRF cookie on every document response the proxy
  // produces (redirects included — harmless, the final document response
  // re-sets it). ALWAYS overwriting (never set-if-absent) defeats token
  // FIXATION: an attacker-planted cookie value never survives the next
  // document load. The client reads the cookie fresh at SUBMIT time (see
  // lib/lead-http.ts), so rotation cannot desync an in-flight form.
  res.cookies.set(CSRF_COOKIE, csrfToken(), {
    path: '/',
    sameSite: 'lax',
    // Secure only in production: the sandbox/dev preview serves plain
    // HTTP, where a Secure cookie is silently dropped by the browser.
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  })

  return res
}

export const config = {
  // Skip API routes, Next internals, the root icon metadata route (its
  // content hash lives in the query string, not the path, so the `.*\\..*`
  // extension guard can't catch it), and any file with an extension.
  // `icon(?:$|/)` anchors the exclusion to the exact /icon route — a bare
  // `icon` prefix would also swallow real pages like /icons or /iconic.
  // `api(?:$|/)` anchors the same way (AUDIT-A1 NIT): a bare `api` prefix
  // would also exclude any FUTURE route starting with "api" (/apiview).
  // NOTE: the boundary group MUST stay non-capturing — Next validates
  // matcher sources through path-to-regexp, which rejects nested capturing
  // groups ("Capturing groups are not allowed").
  matcher: '/((?!api(?:$|/)|_next|_vercel|icon(?:$|/)|.*\\..*).*)',
}
