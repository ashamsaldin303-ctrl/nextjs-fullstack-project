'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeading } from '@/components/shared/section-heading'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

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
  // exact machinery the simulator's `stepOf` message uses. Digit convention
  // (L6-R4 reword — documents the ACTUAL runtime behavior): RUNTIME-formatted
  // values (useFormatter/Intl — incl. formatMoney, the clocks, dates) render
  // LATIN digits in ar: the plain `ar` locale resolves to the latn numbering
  // system on current ICU/CLDR (SSR-verified: the counter paints "0", not
  // "٠"), and the hero clock now pins -u-nu-latn explicitly to match (it
  // alone used ar-SY → Arabic-Indic glyphs inside the latin-subset mono
  // face). STATIC catalog strings keep Latin digits by house style — one
  // numeral presentation site-wide.
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
        {/* G2-1 F2: standard SectionHeading (same stats.kicker / stats.title
            catalog keys — kicker→h2 system, KineticWords reveal; content-side
            mt-12 rhythm below). */}
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          titleId="stats-title"
        />

        {/* G3-6 Stitch port (design-lab trust-band reference — the G2-1
            Opportunity-3 typographic stats strip): the boxed stat-card grid
            (rounded container + gap-px borders + icon chips + gradient
            accents) becomes ONE continuous typographic strip — oversized
            tabular numerals as the section's hero, small muted labels
            beneath, thin vertical hairline rules BETWEEN stats only.
            The rules are border-s (inline-start — LOGICAL, so the line
            lands between neighbors in BOTH directions) on every non-first
            item: at lg that separates the 4 columns; below lg (2×2 grid)
            it separates the two columns. No boxes, no container chrome,
            no icons — the numerals ARE the composition. dl/dt/dd contract,
            the Counter hook (rAF easeOutCubic count-up + instant final
            value under reduced motion) and the staggered Reveal entrance
            are all preserved from the pre-port design. */}
        <dl className="mt-12 grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {items.map((item, i) => {
            return (
              /* Reveal renders the div wrapper (valid dl child) — but that div
                 may only contain dt/dd, so the visible label lives inside dd. */
              <Reveal
                key={item.key}
                delay={i * 0.08}
                variant="zoom"
                className={cn(
                  'px-4 py-2 text-center sm:px-6',
                  i > 0 && 'border-s border-border'
                )}
              >
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span
                    className="block text-4xl font-bold tracking-tight text-primary tabular-nums sm:text-5xl lg:text-6xl"
                    style={{ fontVariationSettings: '"wght" 700' }}
                  >
                    <Counter value={Number(item.value)} suffix={item.suffix} />
                  </span>
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
