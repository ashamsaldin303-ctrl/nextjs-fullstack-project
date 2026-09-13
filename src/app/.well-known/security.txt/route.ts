import { NextResponse } from 'next/server'

/**
 * /.well-known/security.txt (RFC 9116) — F-S1-08 (gold-standard audit).
 *
 * Vulnerability-disclosure contact point for security researchers: the
 * standard well-known location crawlers/scanners probe first. Served as a
 * plain-text GET route with no-store (the file is tiny; caching adds no
 * value and a stale Expires field is an RFC violation waiting to happen —
 * the date below must be bumped on review, see the header comment).
 *
 * NOTE (dot-directory support): Next.js App Router supports dotfolders
 * under app/ as plain route segments — verified live against the dev
 * server (200 + correct body). The next-intl proxy matcher excludes any
 * path containing a dot (`.*\\..*`), so this route is never locale-
 * redirected: it serves verbatim at the bare path in both locales.
 */

// Expires MUST be regenerated on review — max 1 year out, refreshed on
// every security-policy touch (RFC 9116 §4). Next touch: bump the year.
const EXPIRES = '2027-09-12T00:00:00.000Z'

const BODY = [
  `Contact: mailto:security@elyra.agency`,
  `Expires: ${EXPIRES}`,
  'Preferred-Languages: ar, en',
  'Canonical: https://elyra.agency/.well-known/security.txt',
  // No bounty program — good-faith research acknowledged in the hall of
  // fame. Policy link intentionally omitted until a dedicated page ships
  // (an RFC-valid file MAY omit Policy).
].join('\n')

export function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
