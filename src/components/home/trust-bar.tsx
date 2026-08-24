'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/shared/reveal'

interface CounterProps {
  value: number
  suffix: string
  durationMs?: number
}

function Counter({ value, suffix, durationMs = 1600 }: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(0)

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
  const formatted = new Intl.NumberFormat('en-US').format(shown)

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="kicker">{t('kicker')}</span>
          <h2 id="stats-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('title')}
          </h2>
        </Reveal>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border bg-border lg:grid-cols-4">
          {items.map((item, i) => (
            <Reveal
              key={item.key}
              delay={i * 0.08}
              className="bg-background p-6 text-center sm:p-8"
            >
              <dt className="sr-only">{item.label}</dt>
              <dd
                className="text-4xl font-bold tracking-tight text-primary sm:text-5xl"
                style={{ fontVariationSettings: '"wght" 700' }}
              >
                <Counter value={Number(item.value)} suffix={item.suffix} />
              </dd>
              <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
