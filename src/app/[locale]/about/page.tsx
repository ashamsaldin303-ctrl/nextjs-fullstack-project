import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Sparkles, Target, Bot, CalendarRange, Briefcase, Workflow, Users } from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { CTA } from '@/components/shared/cta'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { buildPageMetadata } from '@/lib/seo'

const VALUES = [
  { key: 'beauty' as const, icon: Sparkles },
  { key: 'precision' as const, icon: Target },
  { key: 'humanAutomation' as const, icon: Bot },
] as const

const TEAM = ['m1', 'm2', 'm3', 'm4'] as const

// Phase 2 content enrichment (prompt §6.2): agency numbers — years,
// projects, automations executed, happy clients.
const NUMBERS = ['years', 'projects', 'automations', 'clients'] as const

/* UI-5: per-number visual identity — mirrors the home TrustBar treatment
   (decorative aria-hidden icon chips + gradient accent under the value). */
const NUMBER_ICONS = {
  years: CalendarRange,
  projects: Briefcase,
  automations: Workflow,
  clients: Users,
} as const

const AVATAR_GRADIENTS = [
  'from-primary to-g-blue',
  'from-g-red to-g-yellow',
  'from-g-green to-primary',
  'from-g-yellow to-g-red',
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
    namespace: 'meta.about',
    path: '/about',
  })
}

export default async function AboutPage() {
  const t = await getTranslations('pages.about')

  return (
    <>
      <PageHero namespace="pages.about.hero" />

      {/* Story */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="story-title">
        <div className="elyra-container max-w-3xl">
          <Reveal>
            <span className="kicker">{t('story.kicker')}</span>
            <h2 id="story-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('story.title')}</h2>
          </Reveal>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-muted-foreground">
            <Reveal delay={0.05}><p>{t('story.p1')}</p></Reveal>
            <Reveal delay={0.1}><p>{t('story.p2')}</p></Reveal>
            <Reveal delay={0.15}><p>{t('story.p3')}</p></Reveal>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="values-title">
        <div className="elyra-container max-w-container">
          <SectionHeading
            kicker={t('values.kicker')}
            title={t('values.title')}
            variant="on-dark"
            titleId="values-title"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {VALUES.map(({ key, icon: Icon }, i) => (
              <Reveal key={key} delay={i * 0.1} variant="zoom">
                {/* UI-5: hover depth on the dark value cards — gentle lift +
                    border/background brightening (card-hover-lift collapses
                    to ~0ms under prefers-reduced-motion). */}
                <article className="card-hover-lift group h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{t(`values.${key}.title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{t(`values.${key}.desc`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="team-title">
        <div className="elyra-container max-w-container">
          <SectionHeading
            kicker={t('team.kicker')}
            title={t('team.title')}
            titleId="team-title"
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m, i) => {
              const name = t(`team.members.${m}.name`)
              const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('')
              return (
                <Reveal key={m} delay={i * 0.08} variant="zoom">
                  {/* UI-5: hover depth on team cards — lift + primary border
                      tint + avatar nudge. */}
                  <article className="card-hover-lift group flex h-full flex-col items-center rounded-3xl border border-border bg-card p-6 text-center hover:border-primary/30">
                    <div className={`flex size-20 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] ?? 'from-primary to-g-blue'} text-2xl font-bold text-white transition-transform duration-300 group-hover:scale-105`}>
                      {initials}
                    </div>
                    <h3 className="mt-4 font-semibold">{name}</h3>
                    {/* MED-3: primary/90 on white was 4.04:1 — the AA-on-white
                        brand token primary-strong (#0066CC) is ≈5.8:1 ✓. */}
                    <p className="mt-1 text-sm text-primary-strong">{t(`team.members.${m}.role`)}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {t(`team.members.${m}.bio`)}
                    </p>
                  </article>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Agency numbers */}
      <section className="bg-background pb-20 sm:pb-28" aria-labelledby="numbers-title">
        <div className="elyra-container max-w-5xl">
          <Reveal className="text-center">
            <span className="kicker">{t('numbers.kicker')}</span>
            <h2 id="numbers-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('numbers.title')}</h2>
          </Reveal>
          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
            {NUMBERS.map((n) => {
              const NumberIcon = NUMBER_ICONS[n]
              return (
                /* div wrapper inside dl is valid only when it contains
                   exclusively dt/dd — the visible label lives inside the dd. */
                <div key={n} className="bg-background p-6 text-center sm:p-8">
                  <dt className="sr-only">{t(`numbers.${n}.label`)}</dt>
                  <dd className="transition-transform duration-300 hover:-translate-y-1">
                    <span
                      className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
                      aria-hidden="true"
                    >
                      <NumberIcon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="mt-4 block text-4xl font-bold tracking-tight text-primary sm:text-5xl">
                      {Number(t.raw(`numbers.${n}.value`))}
                      {t(`numbers.${n}.suffix`)}
                    </span>
                    {/* Symmetric gradient accent — direction-agnostic (RTL-safe). */}
                    <span
                      aria-hidden="true"
                      className="mx-auto mt-4 block h-0.5 w-10 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                    />
                    <span className="mt-3 block text-sm text-muted-foreground">{t(`numbers.${n}.label`)}</span>
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      </section>

      <CTA namespace="pages.about.cta" variant="on-dark" />
    </>
  )
}
