import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Next.js 16: proxy.ts replaces middleware.ts (see guide §1.3).
export default createMiddleware(routing)

export const config = {
  // Skip API routes, Next internals, the root icon metadata route (its
  // content hash lives in the query string, not the path, so the `.*\\..*`
  // extension guard can't catch it), and any file with an extension.
  // `icon(?:$|/)` anchors the exclusion to the exact /icon route — a bare
  // `icon` prefix would also swallow real pages like /icons or /iconic.
  // NOTE: the boundary group MUST stay non-capturing — Next validates
  // matcher sources through path-to-regexp, which rejects nested capturing
  // groups ("Capturing groups are not allowed").
  matcher: '/((?!api|_next|_vercel|icon(?:$|/)|.*\\..*).*)',
}
