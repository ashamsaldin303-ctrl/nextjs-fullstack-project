'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { BeforeAfter, toMockContent } from './before-after'
import { DeconstructedCard } from './deconstructed-card'
const PROJECTS = [
  { key: 'project1' as const, variant: 'site-new' as const, accent: '#B45309', metrics: ['metric1', 'metric2'] },
  { key: 'project2' as const, variant: 'dashboard-new' as const, accent: '#34A853', metrics: ['metric1', 'metric2'] },
]

// FIX(2-c/11): project1 gets the full deconstructed showcase above, so
// the grid below renders only the remaining projects — otherwise the same
// title/desc/metrics content appears twice in one section.
const GRID_PROJECTS = PROJECTS.filter((p) => p.key !== 'project1')

export function FeaturedWork() {
  const t = useTranslations('workSection')
  const tc = useTranslations('common')

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="work-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="work-title"
        />

        {/* WS-5: the first featured project is a full-width deconstructed
            3D card — pulled out of the grid so it can take a proper
            sticky zone (Phase 5 P1-2: the original layout squashed the
            card into a 240px grid row, killing the sticky scroll effect
            and the Z separation entirely). */}
        <Reveal delay={0}>
          <DeconstructedCard projectKey="project1" />
        </Reveal>

        {/* With a single remaining project the grid becomes one centered
            card — reads as an intentional "next project" teaser instead of
            a half-empty 2-col grid. */}
        <div className="mx-auto mt-14 max-w-2xl">
          {GRID_PROJECTS.map((p) => {
            const metrics = t.raw(`${p.key}.metrics`) as string[]
            // UI-4: per-project mock content for the realistic "after" scene
            const mock = toMockContent(t.raw(`${p.key}.mock`))
            return (
              <Reveal key={p.key} delay={0.1}>
                <article className="group" data-cursor="preview" data-cursor-label={tc('cursor.preview')}>
                  {/* subtle hover lift on the comparison mockup (UI-4) */}
                  <div className="rounded-2xl transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg">
                    <BeforeAfter
                      variant={p.variant}
                      accent={p.accent}
                      label={t(`${p.key}.title`)}
                      mock={mock}
                    />
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {t(`${p.key}.category`)}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {t(`${p.key}.title`)}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t(`${p.key}.desc`)}
                  </p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {metrics.map((m, idx) => (
                      <li
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary-strong"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/work"
            data-cursor="magnet"
            className="group inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-foreground/5"
          >
            {t('viewAll')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
