'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

/**
 * Lazy wrapper around the automation simulator (Hotfix H-4, option A).
 *
 * The simulator is a heavy client component (framer-motion + three scenario
 * tab sets + rAF counters) sitting FAR below the fold on the homepage and
 * on /services/automation. Production Lighthouse attributed most of the
 * homepage's 690ms TBT to hydrating it eagerly. This wrapper defers BOTH
 * the chunk load and the hydration until the section approaches the
 * viewport (rootMargin 400px) — the same proven pattern used for
 * CapabilityScene — while a lightweight section-shaped placeholder keeps
 * the layout stable (no CLS).
 *
 * Decision documented in README (Phase-3 decisions, #23): option A chosen
 * over bundle-splitting for zero restructuring risk and equal effect.
 */

const LazySimulator = dynamic(
  () => import('./automation-simulator').then((m) => m.AutomationSimulator),
  {
    ssr: false,
    // Placeholder mirrors the real section rhythm: dark background +
    // py-20/28 + min-height — keeps the scrollbar/CLS stable pre-load.
    loading: () => (
      <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-hidden="true">
        <div className="mx-auto min-h-[420px] max-w-7xl px-4 sm:px-6 lg:px-8" />
      </section>
    ),
  }
)

export function SimulatorLazy(props: { scenario?: 'newOrder' | 'paymentReminder' | 'weeklyReport'; showScenarioPicker?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      const id = window.requestAnimationFrame(() => setNear(true))
      return () => window.cancelAnimationFrame(id)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref}>
      {near ? <LazySimulator {...props} /> : (
        /* Same-shaped spacer pre-observation (avoids a load-in jump when
           the observer fires before the dynamic chunk's loading state). */
        <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-hidden="true">
          <div className="mx-auto min-h-[420px] max-w-7xl px-4 sm:px-6 lg:px-8" />
        </section>
      )}
    </div>
  )
}
