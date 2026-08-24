import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
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
