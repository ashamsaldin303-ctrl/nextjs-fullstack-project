'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/shared/reveal'
import { BeforeAfter, toMockContent, type ScenePalette } from '@/components/home/before-after'
import { asStringArray } from '@/lib/catalog-guards'

type Category = 'websites' | 'automation'

interface ProjectDef {
  key: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6'
  category: Category
  variant: 'site-new' | 'property-new' | 'academy-new' | 'dining-new' | 'kanban-new' | 'dashboard-new'
  accent: string
  /** R9: dashboard skin — p5 dark SaaS; p6 is the kanban board (G3-4). */
  tone?: 'dark' | 'light'
  /** G3-4: per-scene brand palette (G2-2 F2) — when present its primary
   *  becomes the scene accent and its neutrals replace the shared stone
   *  scale inside the scene. */
  palette?: ScenePalette
}

/* G3-4 per-scene palettes — each project's "after" scene now carries its
 * Stitch brand world's neutrals, not just a swapped accent (the G2-2 F2
 * sameness cure). p5 keeps its dark Google-blue console (accent only);
 * p6's kanban scene owns its warm-graphite tokens internally.
 * • p1 لمسة — quiet-luxury boutique: warm stone/clay on linen off-white
 * • p2 عقار بلس — trustworthy portal: emerald/teal on warm off-white
 * • p3 مسار — warm education: terracotta + charcoal on cream
 * • p4 بيت الشام — Levantine hospitality: espresso/cream/tomato
 */
const PROJECTS: ProjectDef[] = [
  {
    key: 'p1',
    category: 'websites',
    variant: 'site-new',
    accent: '#A96A4F',
    palette: {
      primary: '#A96A4F',
      surface: '#FBF8F3',
      surfaceMuted: '#F3EDE3',
      border: '#E7DDD0',
      borderSoft: '#F0E9DE',
      ink: '#2E2721',
      inkSoft: '#4A423A',
      inkMuted: '#8A7E72',
      inkFaint: '#B3A99D',
    },
  },
  {
    key: 'p2',
    category: 'websites',
    variant: 'property-new',
    accent: '#0E8A5F',
    palette: {
      primary: '#0E8A5F',
      surface: '#FCFDFB',
      surfaceMuted: '#EEF5F0',
      border: '#DAE7DE',
      borderSoft: '#E8F1EA',
      ink: '#12241C',
      inkSoft: '#2A4237',
      inkMuted: '#6B7C73',
      inkFaint: '#9BABA2',
    },
  },
  {
    key: 'p3',
    category: 'websites',
    variant: 'academy-new',
    accent: '#C05B3C',
    palette: {
      primary: '#C05B3C',
      surface: '#FDF9F1',
      surfaceMuted: '#F6EFE2',
      border: '#EBDFCC',
      borderSoft: '#F2EADB',
      ink: '#33291F',
      inkSoft: '#50453A',
      inkMuted: '#8A7A66',
      inkFaint: '#B5A78F',
    },
  },
  {
    key: 'p4',
    category: 'websites',
    variant: 'dining-new',
    accent: '#C23A22',
    palette: {
      primary: '#C23A22',
      surface: '#FFF9EC',
      surfaceMuted: '#F7EEDA',
      border: '#EADBC0',
      borderSoft: '#F2EAD6',
      ink: '#2B1B12',
      inkSoft: '#4E3A2B',
      inkMuted: '#8C7563',
      inkFaint: '#B8A48E',
    },
  },
  { key: 'p5', category: 'automation', variant: 'dashboard-new', accent: '#4285F4', tone: 'dark' }, // SaaS console (google blue, dark)
  {
    key: 'p6',
    category: 'automation',
    variant: 'kanban-new',
    accent: '#D97706', // warm-graphite planner + amber (G3-4: was a light-tone DashNewScene twin of p5)
  },
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
            // L6-R2 (fix 6): runtime-narrowed catalog reads (was `as string[]`).
            const metrics = asStringArray(t.raw(`projects.${p.key}.metrics`))
            const services = asStringArray(t.raw(`projects.${p.key}.services`))
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
                      palette={p.palette}
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
