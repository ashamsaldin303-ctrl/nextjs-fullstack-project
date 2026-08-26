import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Check, Globe, ShoppingCart, LayoutDashboard } from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { CTA } from '@/components/shared/cta'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { ThreeDSection } from '@/components/home/three-d-section'
import { ServiceProse } from '@/components/shared/service-prose'
import { buildPageMetadata } from '@/lib/seo'

const TYPES = [
  { key: 'landing' as const, icon: Globe },
  { key: 'store' as const, icon: ShoppingCart },
  { key: 'platform' as const, icon: LayoutDashboard },
]

const JOURNEY = ['s1', 's2', 's3', 's4', 's5', 's6'] as const

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
    namespace: 'meta.websites',
    path: '/services/websites',
  })
}

export default async function WebsitesPage() {
  const t = await getTranslations('pages.websites')

  return (
    <>
      <PageHero namespace="pages.websites.hero" />

      <section className="bg-background py-20 sm:py-28" aria-labelledby="types-title">
        <div className="elyra-container max-w-container">
          <SectionHeading
            kicker={t('types.kicker')}
            title={t('types.title')}
            titleId="types-title"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TYPES.map(({ key, icon: Icon }, i) => (
              <Reveal key={key} delay={i * 0.1}>
                <article className="group h-full overflow-hidden rounded-3xl border border-border bg-card p-8 transition-all hover:border-primary/40 hover:shadow-lg">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Icon className="size-7" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight">{t(`types.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`types.${key}.desc`)}</p>
                  <ul className="mt-5 space-y-2">
                    {(t.raw(`types.${key}.features`) as string[]).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
                        <Check className="size-4 text-g-green" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ThreeDSection />

      {/* Phase 2 — deeper prose: what's included / how we work (§6.4) */}
      <ServiceProse namespace="pages.websites.prose" />

      <section className="bg-background py-20 sm:py-28" aria-labelledby="journey-title">
        <div className="elyra-container max-w-5xl">
          <SectionHeading
            kicker={t('journey.kicker')}
            title={t('journey.title')}
            titleId="journey-title"
          />
          <ol className="mt-14 space-y-4">
            {JOURNEY.map((s, i) => (
              /* li must be a direct child of ol — Reveal (a div) wraps the
                 CONTENT inside the li instead (Lighthouse a11y: list-item). */
              <li key={s}>
                <Reveal delay={i * 0.05}>
                  {/* UI-5: hover depth on the journey rows — gentle lift +
                      primary border tint; the number badge brightens. */}
                  <div className="card-hover-lift group flex gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/30 sm:gap-6 sm:p-6">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary transition-colors duration-300 group-hover:bg-primary/15">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <h3 className="font-semibold">{t(`journey.steps.${s}.title`)}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{t(`journey.steps.${s}.desc`)}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CTA namespace="pages.websites.cta" variant="on-dark" />
    </>
  )
}
