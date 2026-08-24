'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
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

const PROJECTS: ProjectDef[] = [
  { key: 'p1', category: 'websites', variant: 'site-new', accent: '#0071E3' },
  { key: 'p2', category: 'websites', variant: 'site-new', accent: '#34A853' },
  { key: 'p3', category: 'websites', variant: 'site-new', accent: '#EA4335' },
  { key: 'p4', category: 'automation', variant: 'dashboard-new', accent: '#FBBC05' },
  { key: 'p5', category: 'automation', variant: 'dashboard-new', accent: '#4285F4' },
  { key: 'p6', category: 'automation', variant: 'dashboard-new', accent: '#0071E3' },
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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

        <motion.div layout className="mt-12 grid gap-8 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {visible.map((p, i) => {
              const metrics = t.raw(`projects.${p.key}.metrics`) as string[]
              return (
                <motion.article
                  key={p.key}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
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
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {metrics.map((m, idx) => (
                        <li key={idx} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  )
}
