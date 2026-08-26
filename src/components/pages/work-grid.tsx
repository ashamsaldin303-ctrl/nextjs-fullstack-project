'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import { BeforeAfter } from '@/components/home/before-after'

type Category = 'websites' | 'automation'

interface ProjectDef {
  key: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6'
  category: Category
  variant: 'site-new' | 'dashboard-new'
  accent: string
}

// Phase 2 content enrichment (prompt §6.1): six projects across six
// industries — e-commerce, real estate, education, restaurants, SaaS,
// and a creative agency. Industries live in the i18n `type` field;
// service lists are served per project via `projects.{key}.services`.
const PROJECTS: ProjectDef[] = [
  { key: 'p1', category: 'websites', variant: 'site-new', accent: '#0071E3' },   // e-commerce
  { key: 'p2', category: 'websites', variant: 'site-new', accent: '#34A853' },   // real estate
  { key: 'p3', category: 'websites', variant: 'site-new', accent: '#EA4335' },   // education
  { key: 'p4', category: 'websites', variant: 'site-new', accent: '#FBBC05' },   // restaurant
  { key: 'p5', category: 'automation', variant: 'dashboard-new', accent: '#4285F4' }, // SaaS
  { key: 'p6', category: 'automation', variant: 'dashboard-new', accent: '#0071E3' }, // creative agency
]

type Filter = 'all' | Category

export function WorkGrid() {
  const t = useTranslations('pages.work')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(
    () => (filter === 'all' ? PROJECTS : PROJECTS.filter((p) => p.category === filter)),
    [filter]
  )

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: t('filters.all') },
    { id: 'websites', label: t('filters.websites') },
    { id: 'automation', label: t('filters.automation') },
  ]

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="work-grid-title">
      <div className="elyra-container max-w-container">
        {/* sr-only h2: fixes the broken aria-labelledby reference AND the
            h1→h3 heading-order jump flagged by Lighthouse. */}
        <h2 id="work-grid-title" className="sr-only">{t('gridTitle')}</h2>
        {/* Tabs are self-describing (visible text labels) — no redundant
            aria-label repeating the section title (audit P1-5). */}
        <div className="flex flex-wrap justify-center gap-2" role="tablist">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                data-cursor="magnet"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex h-10 items-center rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:bg-foreground/5'
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Phase 3 §4.3: framer layout-animation replaced by a CSS fade
            keyed on the filter — filtering stays instant and framer-free,
            dropping /work's initial JS below the 200KB target. */}
        <div key={filter} className="reveal-filter-in mt-12 grid gap-8 md:grid-cols-2">
          {visible.map((p, i) => {
            const metrics = t.raw(`projects.${p.key}.metrics`) as string[]
            const services = t.raw(`projects.${p.key}.services`) as string[]
            return (
              <article
                key={p.key}
                className="reveal reveal-visible"
                data-cursor="zoom"
                style={{ transitionDelay: `${i * 0.04}s` }}
              >
                <Reveal>
                  <BeforeAfter variant={p.variant} accent={p.accent} label={t(`projects.${p.key}.title`)} />
                  <div className="mt-5 flex items-center gap-3">
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {t(`projects.${p.key}.type`)}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight">{t(`projects.${p.key}.title`)}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t(`projects.${p.key}.desc`)}</p>

                  {/* Services delivered (Phase 2 content enrichment) */}
                  <ul className="mt-4 space-y-1.5">
                    {services.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wrench className="size-3 shrink-0 text-primary/70" aria-hidden="true" />
                        {s}
                      </li>
                    ))}
                  </ul>

                  <ul className="mt-4 flex flex-wrap gap-2">
                    {metrics.map((m, idx) => (
                      <li key={idx} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary-strong">
                        {m}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
