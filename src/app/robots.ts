import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // '/admin' deliberately NOT listed (L1-A P3 fix): no admin surface
      // exists anywhere in the app, and advertising a nonexistent path is
      // a free recon hint. Re-add only once a real admin route ships.
      disallow: ['/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
