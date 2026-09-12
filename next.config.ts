import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * F-S4-01 (gold-standard audit): build-time assertion — `next build` MUST
 * fail when NEXT_PUBLIC_SITE_URL is missing, because every canonical URL,
 * hreflang alternate, sitemap entry and OG card would silently point at
 * localhost (measurable SEO damage). Dev keeps working without it (the
 * sandbox .env sets it anyway) — the gate arms only for production builds,
 * where next.config is evaluated with NODE_ENV=production before the
 * compiler runs.
 */
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error(
    '[elyra:build] NEXT_PUBLIC_SITE_URL is not set — canonical/hreflang/sitemap/OG URLs would point at localhost. ' +
    'Set it in the build environment (see .env.example) and rebuild.',
  )
}

/**
 * CSP is a function of the environment (audit P1-6):
 * - DEV: Turbopack HMR needs 'unsafe-eval' + https:/wss: connect targets.
 * - PRODUCTION: tightened — but script-src KEEPS 'unsafe-inline' because
 *   statically-prerendered Next.js pages embed inline bootstrap scripts;
 *   nonce-based CSP is incompatible with static prerendering (F-S1-01:
 *   accepted residual risk, documented — the live XSS surface is small
 *   since all user-input echo paths are React-escaped).
 *   upgrade-insecure-requests rides the PROD branch only (the sandbox
 *   serves plain HTTP in dev, where it would break asset loading).
 */
function contentSecurityPolicy(): string {
  if (process.env.NODE_ENV !== 'production') {
    return [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
    ].join('; ')
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Cross-origin isolation (L1-A P2 fix): COOP cuts window.opener access
  // from cross-origin popups; CORP stops our resources from being embedded
  // by arbitrary cross-origin pages. Both are no-ops for the app's own
  // functionality (no popups, same-origin assets only).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    // F-S1-03 (gold-standard audit): preload directive added so the header
    // is submission-ready for hstspreload.org (the directive itself is inert
    // until the domain is actually submitted — includeSubDomains must stay
    // for preload acceptance). Submission is a post-launch, owner-side step
    // (~6 months of correct HTTPS first, per the audit's 60-day roadmap).
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy(),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  // P2-2 (audit): React Compiler — auto-memoization across the app.
  // Next.js 16 graduated this to a top-level option. The strict eslint
  // rule (`react-compiler/react-compiler: warn`) already runs with 0
  // findings; this enables the actual compiler pass.
  reactCompiler: true,
  allowedDevOrigins: [
    '*.space-z.ai',
    '*.chatglm.cn',
    // Local-network verification origins (agent-browser / curl probes hit
    // the dev server via the loopback + LAN addresses; Next 16 blocks
    // /_next/* (HMR) from unrecognized origins, which manifests as random
    // full-page reloads that unmount client scenes mid-interaction).
    'localhost',
    '127.0.0.1',
    '21.0.17.13',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
