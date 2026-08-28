import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Hero } from '@/components/home/hero'
import { IntroOverlay } from '@/components/home/intro-overlay'
import { TrustBar } from '@/components/home/trust-bar'
import { Manifesto } from '@/components/home/manifesto'
import { ServicesBento } from '@/components/home/bento'
import { SimulatorLazy } from '@/components/home/simulator-lazy'
import { FeaturedWork } from '@/components/home/featured-work'
import { MethodologyLazy } from '@/components/home/methodology-lazy'
import { CalculatorLazy } from '@/components/home/calculator-lazy'
import { HomeJsonLd } from '@/components/seo/home-json-ld'
import { routing } from '@/i18n/routing'
import { SITE_URL } from '@/lib/seo'
import { OG_IMAGE_ALT } from '@/lib/site-config'

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
    // Shared alt constant (L1-B P3) — identical to the layout's and
    // buildPageMetadata's cards (single source in site-config.ts).
    alt: OG_IMAGE_ALT,
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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  // Canonical next-intl pattern: pin the request locale so any future
  // implicit-locale getTranslations in this page (or its metadata) never
  // falls back to headers() and silently breaks prerendering.
  setRequestLocale(locale)
  return (
    <>
      <HomeJsonLd />
      <IntroOverlay />
      <Hero />
      <TrustBar />
      {/* R7 manifesto — the scroll-lit editorial statement bridging the
          proof (stats) into the offer (services bento). */}
      <Manifesto />
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
      {/* R9 (user request): the «قالوا عننا» testimonials section was
          removed from the homepage. The catalog keys stay — the contact
          page reuses items.first for its form-side social proof. */}
      <MethodologyLazy />
      <CalculatorLazy />
    </>
  )
}
