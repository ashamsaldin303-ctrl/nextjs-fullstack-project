import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/i18n/routing'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Fail-soft warning (audit P2): without NEXT_PUBLIC_SITE_URL every
// canonical/hreflang/OG URL silently points at localhost in production.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn(
    '[seo] NEXT_PUBLIC_SITE_URL is not set — canonical/hreflang/OG URLs will point to localhost',
  )
}

interface PageMetadataInput {
  locale: Locale
  namespace: string
  /** Path WITHOUT locale prefix, e.g. "/services/websites". */
  path: string
}

/**
 * Builds per-page metadata with canonical + hreflang alternates.
 * Arabic (default locale) has no prefix; English lives under /en.
 */
export async function buildPageMetadata({
  locale,
  namespace,
  path,
}: PageMetadataInput): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace })

  const enPath = path === '/' ? '/en' : `/en${path}`
  const canonical = locale === 'ar' ? path : enPath

  // OG card image — served by the [locale]/opengraph-image.tsx file
  // convention. Metadata merging is SHALLOW: a page's own openGraph
  // object replaces the segment's (including its file-convention image),
  // so the image must be referenced explicitly here. Arabic is the
  // default locale (as-needed prefixing → no /ar prefix in the public
  // URL; /ar/opengraph-image would 307 to this canonical form).
  const ogImageUrl =
    locale === 'ar' ? `${SITE_URL}/opengraph-image` : `${SITE_URL}/en/opengraph-image`
  // LOW-4 (R5): siteName is repeated here (not inherited) because the
  // shallow merge above replaces the layout's whole openGraph object.
  const ogImage = {
    url: ogImageUrl,
    width: 1200,
    height: 630,
    alt: 'Elyra — Stunning Websites · n8n Automation · Digital Studio',
    type: 'image/png',
  }

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonical,
      // P2-3: full hreflang set incl. x-default (points at the default
      // Arabic locale) — mirrors the sitemap alternates.
      languages: {
        ar: path,
        en: enPath,
        'x-default': path,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${SITE_URL}${canonical}`,
      siteName: 'Elyra',
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      type: 'website',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [ogImage],
    },
  }
}

export { SITE_URL }
