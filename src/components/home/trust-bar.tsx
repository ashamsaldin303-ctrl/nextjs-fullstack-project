'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Briefcase, Zap, Star, Blocks, type LucideIcon } from 'lucide-react'
import { Reveal } from '@/components/shared/reveal'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/* UI-5: per-stat visual identity — one semantic icon per metric, rendered
 * as a decorative (aria-hidden) tinted chip above the counter. */
const STAT_ICONS: Record<'projects' | 'hours' | 'satisfaction' | 'integrations', LucideIcon> = {
  projects: Briefcase,
  hours: Zap,
  satisfaction: Star,
  integrations: Blocks,
}

interface CounterProps {
  value: number
  suffix: string
  durationMs?: number
}

/**
 * In-view detection without framer-motion (Phase 3 §4.3) — a tiny
 * IntersectionObserver hook with the same once/margin semantics.
 */
function useInViewOnce(ref: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // Legacy fallback — async (rAF) so we never setState synchronously
      // inside the effect body (react-hooks/set-state-in-effect).
      const id = window.requestAnimationFrame(() => setInView(true))
      return () => window.cancelAnimationFrame(id)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '-15% 0px -15% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

function Counter({ value, suffix, durationMs = 1600 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInViewOnce(ref)
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(0)
  // FIX(2-c/16): counts are formatted through next-intl's formatter — the
  // exact machinery the simulator's `stepOf` message uses — so AR pages
  // get Arabic-Indic digits ("١٢٠") instead of hardcoded en-US. Money
  // elsewhere stays Latin per the site's digit convention.
  const format = useFormatter()

  useEffect(() => {
    if (!inView || reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(Math.round(eased * value))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, value, durationMs])

  // Reduced-motion users see the final value immediately (derived, no setState).
  const shown = reduced ? (inView ? value : 0) : display
  const formatted = format.number(shown)

  return (
    <span ref={ref} className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  )
}

export function TrustBar() {
  const t = useTranslations('stats')
  const items = [
    { key: 'projects' as const, value: Number(t.raw('projects.value')), suffix: t('projects.suffix'), label: t('projects.label') },
    { key: 'hours' as const, value: Number(t.raw('hours.value')), suffix: t('hours.suffix'), label: t('hours.label') },
    { key: 'satisfaction' as const, value: Number(t.raw('satisfaction.value')), suffix: t('satisfaction.suffix'), label: t('satisfaction.label') },
    { key: 'integrations' as const, value: Number(t.raw('integrations.value')), suffix: t('integrations.suffix'), label: t('integrations.label') },
  ]

  return (
    <section
      className="bg-background py-20 sm:py-24"
      aria-labelledby="stats-title"
    >
      <div className="elyra-container max-w-container">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="kicker">{t('kicker')}</span>
          <h2 id="stats-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
        </Reveal>

        {/* UI-5 note: the `gap-px bg-border` grid already yields hairline
            dividers between stats on desktop (RTL-safe by construction —
            no divide-x/reverse needed); cells below add the icon chip,
            a gradient accent under each value, and a gentle hover lift
            on the INNER dd (lifting the cell itself would expose the
            border-colored grid gaps behind it). */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = STAT_ICONS[item.key]
            return (
              /* Reveal renders the div wrapper (valid dl child) — but that div
                 may only contain dt/dd, so the visible label lives inside dd. */
              <Reveal
                key={item.key}
                delay={i * 0.08}
                variant="zoom"
                className="bg-background p-6 text-center sm:p-8"
              >
                <dt className="sr-only">{item.label}</dt>
                <dd className="group transition-transform duration-300 hover:-translate-y-1">
                  <span
                    className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span
                    className="mt-4 block text-4xl font-bold tracking-tight text-primary sm:text-5xl"
                    style={{ fontVariationSettings: '"wght" 700' }}
                  >
                    <Counter value={Number(item.value)} suffix={item.suffix} />
                  </span>
                  {/* Subtle symmetric gradient accent under the value —
                      direction-agnostic, safe for RTL. */}
                  <span
                    aria-hidden="true"
                    className="mx-auto mt-4 block h-0.5 w-10 rounded-full bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                  />
                  <span className="mt-3 block text-sm font-normal tracking-normal text-muted-foreground">{item.label}</span>
                </dd>
              </Reveal>
            )
          })}
        </dl>
      </div>
    </section>
  )
}
