'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { BeforeAfter } from './before-after'

const PROJECTS = [
  { key: 'project1' as const, variant: 'site-new' as const, accent: '#0071E3', metrics: ['metric1', 'metric2'] },
  { key: 'project2' as const, variant: 'dashboard-new' as const, accent: '#34A853', metrics: ['metric1', 'metric2'] },
]

export function FeaturedWork() {
  const t = useTranslations('workSection')

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="work-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
        />

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {PROJECTS.map((p, i) => {
            const metrics = t.raw(`${p.key}.metrics`) as string[]
            return (
              <Reveal key={p.key} delay={i * 0.1}>
                <article className="group">
                  <BeforeAfter
                    variant={p.variant}
                    accent={p.accent}
                    label={t(`${p.key}.title`)}
                  />
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
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
