import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

interface PageMetadataInput {
  locale: string
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

  const arPath = path === '/' ? '/' : path
  const enPath = path === '/' ? '/en' : `/en${path}`
  const canonical = locale === 'ar' ? arPath : enPath

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: canonical,
      languages: {
        ar: arPath,
        en: enPath,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${SITE_URL}${canonical}`,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  }
}

export { SITE_URL, routing }
