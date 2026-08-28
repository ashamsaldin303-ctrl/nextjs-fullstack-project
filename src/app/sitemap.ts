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

// Fixed lastmod stamp — `new Date()` would stamp BUILD time on every
// URL on every deploy, misinforming crawlers about real content change.
// 2026-08-28 = R9 content overhaul (testimonials removed, /work +/ scenes).
const LAST_MODIFIED = new Date('2026-08-28')

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
