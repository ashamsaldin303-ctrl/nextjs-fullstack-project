import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Next.js 16: proxy.ts replaces middleware.ts (see guide §1.3).
export default createMiddleware(routing)

export const config = {
  // Skip API routes, Next internals and any file with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
}
