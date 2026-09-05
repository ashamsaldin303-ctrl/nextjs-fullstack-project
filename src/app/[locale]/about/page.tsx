import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Sparkles, Target, Bot, CalendarRange, Briefcase, Workflow, Users, ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
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

export default async function AboutPage({
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
  const t = await getTranslations('pages.about')

  return (
    <>
      <PageHero namespace="pages.about.hero" />

      {/* Story — SO-2 (G3-5, code-level) editorial pass: the founding
          question becomes a large pull-quote with an accent rule instead
          of living inside a 3-paragraph text-wall; the answer column sits
          in a comfortable measure. Heading moves to the standard
          SectionHeading (the G3-2 trust-bar F4 pattern — hand-rolled
          kicker+h2 drift). */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="story-title">
        <div className="elyra-container max-w-3xl">
          <SectionHeading
            kicker={t('story.kicker')}
            title={t('story.title')}
            align="start"
            titleId="story-title"
          />
          {/* lead-in line — sets up the question */}
          <Reveal delay={0.05} className="mt-8">
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{t('story.p1')}</p>
          </Reveal>
          {/* the founding question as a large pull-quote. Quote marks follow
              the L6-R4 P3 locale convention (Arabic «…», English “…”);
              border-s-2 + ps-6 keep the accent rule on the reading-start
              side in both directions. The quote text is a display:block
              SPAN, not a <p>: the unlayered :lang(ar) p/li/blockquote rule
              forces 1.8 line-height over any leading-* utility, and a
              display-size quote needs leading-snug (the same workaround
              G3-3 documented for the scene typography). */}
          <Reveal delay={0.1}>
            <div className="mt-8 max-w-2xl border-s-2 border-primary/70 ps-6 sm:ps-8">
              <span className="block text-balance text-2xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
                {locale === 'ar' ? `«${t('story.quote')}»` : `“${t('story.quote')}”`}
              </span>
            </div>
          </Reveal>
          {/* the answer column — comfortable measure (max-w-2xl ≈ 65–75
              chars per line at text-lg). No literal drop-cap: Arabic
              letter-joining breaks under first-letter styling, so the
              pull-quote itself carries the “breaking the grid” role
              (documented deviation from the SO-2 prompt's drop-cap-like
              opening). */}
          <div className="mt-10 max-w-2xl space-y-5 text-lg leading-relaxed text-muted-foreground">
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
                {/* SO-2 (G3-5): quiet editorial panels — the value word at
                    display size with a hairline accent rule and a one-line
                    caption, typography-first (no icon chip, no glass fill:
                    backdrop-blur-md over a flat dark section showed
                    nothing and cost compositing). Hover depth stays. */}
                <article className="card-hover-lift group h-full rounded-3xl border border-white/10 bg-white/[0.03] p-8 hover:border-white/20">
                  <Icon className="size-5 text-primary/80" aria-hidden="true" />
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t(`values.${key}.title`)}</h3>
                  <span
                    aria-hidden="true"
                    className="mt-4 block h-0.5 w-8 rounded-full bg-primary/70"
                  />
                  <p className="mt-4 text-sm leading-relaxed text-white/70">{t(`values.${key}.desc`)}</p>
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
              const words = name.split(' ').filter(Boolean)
              /* G2-3 P3-3 (fix 3): Arabic has no initials convention — the
                 disconnected letter pair (“أحمد الرفاعي” → “أا”) reads as
                 noise. AR shows the GIVEN NAME (the clean professional
                 treatment); EN keeps the classic two-initial monogram
                 (“Ahmad Al-Rifai” → “AA”). The avatar glyph is decorative
                 (aria-hidden) — the full name renders in the h3 below. */
              const avatarLabel =
                locale === 'ar'
                  ? (words[0] ?? name)
                  : words.slice(0, 2).map((w) => w[0] ?? '').join('')
              return (
                <Reveal key={m} delay={i * 0.08} variant="zoom">
                  {/* UI-5: hover depth on team cards — lift + primary border
                      tint + avatar nudge. */}
                  <article className="card-hover-lift group flex h-full flex-col items-center rounded-3xl border border-border bg-card p-6 text-center hover:border-primary/30">
                    {/* L1-C P3 (fix 2-d): dropped the unreachable `??` — a modulo
                        over a non-empty const array always yields a defined entry. */}
                    <div
                      aria-hidden="true"
                      className={`flex size-20 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} text-2xl font-bold text-white transition-transform duration-300 group-hover:scale-105`}
                    >
                      {avatarLabel}
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
          {/* G3-2 trust-bar F4 pattern: hand-rolled kicker+h2 → the standard
              SectionHeading (kinetic words, uniform rhythm). */}
          <SectionHeading
            kicker={t('numbers.kicker')}
            title={t('numbers.title')}
            titleId="numbers-title"
          />
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
          {/* G2-3 P2-2 (fix 2): quiet in-content cross-link — the story and
              numbers flow into the work gallery; the site's link idiom
              (text + single ArrowRight, rtl single-flip, hover nudge). */}
          <Reveal className="mt-10 text-center">
            <Link
              href="/work"
              className="group inline-flex items-center gap-2 text-base font-medium text-primary-strong transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('exploreWork.label')}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </Reveal>
        </div>
      </section>

      <CTA namespace="pages.about.cta" variant="on-dark" />
    </>
  )
}
