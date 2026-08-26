import type { MetadataRoute } from 'next'
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
const LAST_MODIFIED = new Date('2026-08-26')

/**
 * P2-3 (audit + prompt §7.4): every path is emitted as ONE <url> entry
 * carrying full hreflang alternates (ar / en / x-default) per the
 * next-intl recommendation. Arabic (default locale) has no prefix;
 * English lives under /en; x-default points at the Arabic canonical.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => {
    const arUrl = `${SITE_URL}${path === '' ? '/' : path}`
    const enUrl = `${SITE_URL}/en${path === '' ? '' : path}`
    return {
      url: arUrl,
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
  })
}
