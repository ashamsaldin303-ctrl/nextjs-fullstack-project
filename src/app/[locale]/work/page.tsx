import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { PageHero } from '@/components/shared/page-hero'
import { CTA } from '@/components/shared/cta'
import { WorkGrid } from '@/components/pages/work-grid'
import { buildPageMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  // Narrow string → Locale for buildPageMetadata (validity is already
  // guaranteed by the proxy for every reachable route).
  if (!hasLocale(routing.locales, locale)) notFound()
  return buildPageMetadata({
    locale,
    namespace: 'meta.work',
    path: '/work',
  })
}

export default async function WorkPage() {
  return (
    <>
      <PageHero namespace="pages.work.hero" />
      <WorkGrid />
      <CTA namespace="pages.work.cta" variant="on-dark" />
    </>
  )
}
