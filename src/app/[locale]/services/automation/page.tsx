import type { Metadata } from 'next'
import { Fragment } from 'react'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { type LucideIcon } from 'lucide-react'
import {
  Users, FileText, Mail, Send, Table, Bot, CreditCard, Database, ArrowRight, ArrowDown,
} from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { CTA } from '@/components/shared/cta'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { SimulatorLazy } from '@/components/home/simulator-lazy'
import { CalculatorLazy } from '@/components/home/calculator-lazy'
import { ServiceProse } from '@/components/shared/service-prose'
import { ServiceCrossNav } from '@/components/services/cross-nav'
import { AutomationHeroMotif } from '@/components/services/hero-motifs'
import { buildPageMetadata } from '@/lib/seo'

const INTEGRATIONS: { key: string; icon: LucideIcon }[] = [
  { key: 'crm', icon: Users },
  { key: 'invoicing', icon: FileText },
  { key: 'email', icon: Mail },
  { key: 'telegram', icon: Send },
  { key: 'sheets', icon: Table },
  { key: 'ai', icon: Bot },
  { key: 'payments', icon: CreditCard },
  { key: 'databases', icon: Database },
]

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
    namespace: 'meta.automation',
    path: '/services/automation',
  })
}

export default async function AutomationPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  // Canonical next-intl pattern: pin the request locale so implicit-locale
  // getTranslations in this page (and future metadata) never fall back to
  // headers() and silently break prerendering.
  setRequestLocale(locale)
  const t = await getTranslations('pages.automation')

  return (
    <>
      {/* SO-1 (G3-5): node-flow signature motif — the hero keeps the
          generic dark treatment; the decorative slot adds the service's
          core idea in miniature. Hero CTA stays on /contact ("design your
          system" = start a conversation — honest destination). */}
      <PageHero
        namespace="pages.automation.hero"
        decorative={<AutomationHeroMotif />}
      />

      {/* Integrations grid */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="int-title">
        <div className="elyra-container max-w-container">
          <SectionHeading
            kicker={t('integrations.kicker')}
            title={t('integrations.title')}
            subtitle={t('integrations.note')}
            titleId="int-title"
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map(({ key, icon: Icon }, i) => (
              <Reveal key={key} delay={(i % 4) * 0.06} variant="zoom">
                {/* G2-3 P3-8 (fix 9): shell unified to the site's dominant
                    card family (rounded-3xl · p-8 · hover shadow-lg ·
                    size-12 rounded-2xl chip · size-6 icon) — was the drifted
                    rounded-2xl/p-6/shadow-md/size-11 outlier; now identical
                    to the websites types + about values + service prose
                    shells. */}
                <article className="group h-full rounded-3xl border border-border bg-card p-8 transition-all hover:border-primary/40 hover:shadow-lg">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-semibold tracking-tight">{t(`integrations.items.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`integrations.items.${key}.desc`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* "This site runs on n8n" */}
      <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="n8n-title">
        <div className="elyra-container max-w-5xl">
          <SectionHeading
            kicker={t('runsOnN8n.kicker')}
            title={t('runsOnN8n.title')}
            subtitle={t('runsOnN8n.desc')}
            variant="on-dark"
            titleId="n8n-title"
          />
          <Reveal className="mt-12">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {[
                { label: t('runsOnN8n.flow.request'), color: 'bg-primary/20 border-primary/40' },
                { label: t('runsOnN8n.flow.webhook'), color: 'bg-g-yellow/15 border-g-yellow/40' },
                { label: t('runsOnN8n.flow.actions'), color: 'bg-g-green/15 border-g-green/40' },
              ].map((node, i, arr) => (
                /* G2-3 P3-7 (fix 7): each node renders via a Fragment so a
                   MOBILE connector can sit BETWEEN the stacked rows while
                   the desktop arrow stays INSIDE the row (between the
                   boxes) — previously the arrows were sm:-only and the
                   stacked nodes had no connectors at all. */
                <Fragment key={node.label}>
                  <div className="flex flex-1 items-center gap-3">
                    <div className={`flex-1 rounded-2xl border ${node.color} px-4 py-5 text-center text-sm font-medium backdrop-blur-sm`}>
                      {node.label}
                    </div>
                    {i < arr.length - 1 ? (
                      /* MED-6: the raw → glyph never mirrors in RTL — the
                         site-wide single-flip pattern (rtl:rotate-180) is
                         used instead. Decorative: aria-hidden. Desktop. */
                      <ArrowRight
                        className="hidden size-4 text-white/40 sm:block rtl:rotate-180"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  {i < arr.length - 1 ? (
                    /* G2-3 P3-7 (fix 7): compact centered ↓ between the
                       stacked nodes below sm — restores the flow reading
                       (ArrowDown is direction-neutral: no rtl flip). */
                    <div className="flex justify-center sm:hidden" aria-hidden="true">
                      <ArrowDown className="size-4 text-white/40" />
                    </div>
                  ) : null}
                </Fragment>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="mt-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-g-green/30 bg-g-green/10 px-4 py-1.5 text-sm text-g-green">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-g-green" />
              </span>
              {t('runsOnN8n.badge')}
            </span>
          </Reveal>
        </div>
      </section>

      {/* Extended simulator with scenarios (lazy — Hotfix H-4) */}
      <SimulatorLazy showScenarioPicker />

      {/* Phase 2 — deeper prose: what's included / how we work (§6.4) */}
      <ServiceProse namespace="pages.automation.prose" />

      {/* G2-3 P2-2 (fix 2): quiet cross-navigation row — the sibling
          service + /work + /about (labels reuse nav.*). */}
      <ServiceCrossNav
        label={t('explore.label')}
        links={['websites', 'work', 'about']}
      />

      {/* G2-3 P3-8 (fix 9): closing treatment unified with /services/websites
          (crossNav → on-dark CTA → calculator). The CTA copy promises a
          cost estimate "in under a minute", so the button targets the
          calculator directly below instead of /contact's top. */}
      <CTA
        namespace="pages.automation.cta"
        variant="on-dark"
        href="/services/automation#calculator"
      />

      {/* The calculator the CTA copy promises — embedded lazily (WS-8
          pattern) as the page's closing conversion beat, mirroring /,
          /contact and the sibling service page. The wrapper div is the
          stable #calculator anchor target. */}
      <CalculatorLazy />
    </>
  )
}
