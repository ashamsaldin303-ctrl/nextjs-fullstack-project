import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Hero } from '@/components/home/hero'
import { TrustBar } from '@/components/home/trust-bar'
import { ServicesBento } from '@/components/home/bento'
import { SimulatorLazy } from '@/components/home/simulator-lazy'
import { FeaturedWork } from '@/components/home/featured-work'
import { MethodologyLazy } from '@/components/home/methodology-lazy'
import { Testimonials } from '@/components/home/testimonials'
import { CalculatorLazy } from '@/components/home/calculator-lazy'
import { HomeJsonLd } from '@/components/seo/home-json-ld'
import { SITE_URL } from '@/lib/seo'

/**
 * Home-level metadata exists for ONE reason (final-board R5-LOW-1,
 * completing board-D's layout fix): the [locale]/opengraph-image.tsx
 * file convention beats LAYOUT-declared openGraph.images but loses to
 * PAGE-declared ones — so pinning the canonical card URLs here is the
 * only way to keep the default-locale home off the redirecting
 * /ar/opengraph-image URL. Everything else (title/description/
 * canonical/alternates) still flows from the layout's generateMetadata.
 *
 * NOTE: a child's openGraph/twitter object REPLACES the parent's (same
 * shallow-merge rule the subpages hit in R5-LOW-4) — so the full object
 * is restated here, mirroring the layout's fields.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'meta' })
  const ogImage = {
    url:
      locale === 'ar' ? `${SITE_URL}/opengraph-image` : `${SITE_URL}/en/opengraph-image`,
    width: 1200,
    height: 630,
    alt: 'Elyra — Stunning Websites & n8n Automation Systems',
    type: 'image/png',
  }
  return {
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `${SITE_URL}${locale === 'ar' ? '' : '/en'}`,
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

export default function HomePage() {
  return (
    <>
      <HomeJsonLd />
      <Hero />
      <TrustBar />
      <ServicesBento />
      {/* Hotfix H-4: simulator loads/hydrates only near the viewport —
          cuts homepage TBT (was 690ms prod) without touching LCP. */}
      <SimulatorLazy />
      <FeaturedWork />
      {/* Phase 5 WS-8: Methodology + Calculator lazy-loaded too — both
          use framer-motion, both sit well below the fold. Deferring
          their chunks cuts the initial JS bundle on / by ~30KB
          minified+gzipped (framer-motion + AnimatePresence + motion
          runtime) without losing any functionality. */}
      <MethodologyLazy />
      <Testimonials />
      <CalculatorLazy />
    </>
  )
}
