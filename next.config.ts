import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/**
 * CSP is a function of the environment (audit P1-6):
 * - DEV: Turbopack HMR needs 'unsafe-eval' + https:/wss: connect targets.
 * - PRODUCTION: tightened — but script-src KEEPS 'unsafe-inline' because
 *   statically-prerendered Next.js pages embed inline bootstrap scripts;
 *   nonce-based CSP is incompatible with static prerendering.
 *   (No upgrade-insecure-requests: the sandbox serves plain HTTP.)
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
    // No preload: submit to hstspreload.org first (preload is hard to undo).
    value: 'max-age=63072000; includeSubDomains',
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
    'preview-*.space-z.ai',
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
