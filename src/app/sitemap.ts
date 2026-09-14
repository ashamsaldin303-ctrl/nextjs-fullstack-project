import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { SITE_URL } from '@/lib/seo'

const STATIC_PATHS = [
  '',
  '/services/websites',
  '/services/automation',
  '/work',
  '/about',
  '/contact',
]

// F-S4-05 (gold-standard audit): the sitemap lastmod stamp is driven by
// an EXPLICIT content-version constant — NOT `new Date()` (that would
// stamp BUILD time on every URL on every deploy, misinforming crawlers
// about real content change) and not a silent constant either (it used to
// be one and quietly went stale).
// Bump on the release checklist whenever route content changes (audit F-S4-05).
// 2026-08-28 = R9 content overhaul (testimonials removed, /work +/ scenes);
// 2026-09-08 = REF-4-B /contact copy + messages additions (latest content touch).
const CONTENT_VERSION = '2026-09-08'
const LAST_MODIFIED = new Date(CONTENT_VERSION)

/**
 * P2-3 + LOW-3 (R5): Google's localized-sitemap pattern — one <url>
 * entry PER variant (locale × path, 12 total), each carrying the full
 * hreflang alternate set (ar / en / x-default). Arabic (default locale)
 * has no prefix; English lives under /en; x-default points at the
 * Arabic canonical.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return routing.locales.flatMap((locale) =>
    STATIC_PATHS.map((path) => {
      const arUrl = `${SITE_URL}${path === '' ? '/' : path}`
      const enUrl = `${SITE_URL}/en${path === '' ? '' : path}`
      return {
        url: locale === 'ar' ? arUrl : enUrl,
        lastModified: LAST_MODIFIED,
        changeFrequency: 'monthly',
        priority: path === '' ? 1 : path.startsWith('/services') ? 0.9 : 0.8,
        alternates: {
          languages: {
            ar: arUrl,
            en: enUrl,
            'x-default': arUrl,
          },
        },
      }
    }),
  )
}
