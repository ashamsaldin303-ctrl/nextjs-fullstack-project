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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return STATIC_PATHS.map((path) => {
    // Arabic (default locale) has no prefix; English lives under /en.
    const arUrl = `${SITE_URL}${path === '' ? '/' : path}`
    const enUrl = `${SITE_URL}/en${path === '' ? '' : path}`
    return {
      url: arUrl,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: path === '' ? 1 : path.startsWith('/services') ? 0.9 : 0.8,
      alternates: {
        languages: {
          ar: arUrl,
          en: enUrl,
        },
      },
    }
  })
}
