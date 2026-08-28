'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import { BeforeAfter, toMockContent } from '@/components/home/before-after'

type Category = 'websites' | 'automation'

interface ProjectDef {
  key: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6'
  category: Category
  variant: 'site-new' | 'property-new' | 'academy-new' | 'dining-new' | 'dashboard-new'
  accent: string
  /** R9: dashboard skin — p5 dark SaaS vs p6 light studio ops. */
  tone?: 'dark' | 'light'
}

// Phase 2 content enrichment (prompt §6.1): six projects across six
// industries — e-commerce, real estate, education, restaurants, SaaS,
// and a creative agency. Industries live in the i18n `type` field;
// service lists are served per project via `projects.{key}.services`.
// R9: the four website projects now each render their OWN after-scene
// archetype (storefront / real-estate marketplace / course platform /
// restaurant) instead of one shared storefront skeleton — the
// "مواقع متشابهة" (sites look alike) report.
const PROJECTS: ProjectDef[] = [
  { key: 'p1', category: 'websites', variant: 'site-new', accent: '#0071E3' },      // e-commerce storefront (blue)
  { key: 'p2', category: 'websites', variant: 'property-new', accent: '#34A853' },  // real-estate marketplace (brand green)
  { key: 'p3', category: 'websites', variant: 'academy-new', accent: '#EA4335' },   // course platform (red)
  { key: 'p4', category: 'websites', variant: 'dining-new', accent: '#FBBC05' },    // restaurant site (gold)
  { key: 'p5', category: 'automation', variant: 'dashboard-new', accent: '#4285F4', tone: 'dark' },   // SaaS (google blue)
  { key: 'p6', category: 'automation', variant: 'dashboard-new', accent: '#EA4335', tone: 'light' }, // creative studio (light ops skin)
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
        {/* FIX(2-c/14): plain toggle-button group — the previous
            role="tablist"/"tab" markup had no tabpanels, no aria-controls
            and no roving tabindex (an incomplete tabs pattern). These are
            filters with visible text labels, so aria-pressed buttons are
            the correct semantics. */}
        <div className="flex flex-wrap justify-center gap-2">
          {filters.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                data-cursor="magnet"
                aria-pressed={active}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
            dropping /work's initial JS below the 200KB target.
            R2: cards are BIGGER (gap-10, larger type) and reveal with the
            zoom variant + per-card stagger — the same scroll-animation
            language as the deconstructed card, scaled for the grid.
            R8.1: single column up to lg (1024px) — the dense before/after
            mockups need ~600px+ of width to stay legible; the old
            md:grid-cols-2 squeezed them into ~340px at tablet / preview
            panel widths (the "didn't display well" report). */}
        <div key={filter} className="reveal-filter-in mt-14 grid gap-10 lg:grid-cols-2">
          {visible.map((p, i) => {
            const metrics = t.raw(`projects.${p.key}.metrics`) as string[]
            const services = t.raw(`projects.${p.key}.services`) as string[]
            // UI-4: per-project mock content for the realistic "after" scene
            const mock = toMockContent(t.raw(`projects.${p.key}.mock`))
            return (
              <article
                key={p.key}
                className="group"
                data-cursor="zoom"
              >
                <Reveal variant="zoom" delay={i * 0.07}>
                  {/* subtle hover lift on the comparison mockup (UI-4) */}
                  <div className="rounded-2xl transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-xl">
                    <BeforeAfter
                      variant={p.variant}
                      accent={p.accent}
                      tone={p.tone}
                      label={t(`projects.${p.key}.title`)}
                      mock={mock}
                    />
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {t(`projects.${p.key}.type`)}
                    </span>
                    <h3 className="text-xl font-semibold tracking-tight">{t(`projects.${p.key}.title`)}</h3>
                  </div>
                  <p className="mt-2.5 text-sm text-muted-foreground">{t(`projects.${p.key}.desc`)}</p>

                  {/* Services delivered (Phase 2 content enrichment) */}
                  <ul className="mt-4 space-y-1.5">
                    {services.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Wrench className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
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
