'use client'

import dynamic from 'next/dynamic'
import { useNearViewport } from '@/lib/use-near-viewport'

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
    // FIX(2-c/8): raised to an honest approximation of the idle section
    // height (heading + 260px stage + step card + controls ≈ 800px).
    // G2-1 F3: the inner div now carries the real section's exact
    // container classes (elyra-container max-w-container — see
    // automation-simulator.tsx) instead of the loose hand-rolled
    // max-w-7xl px-4/6/8 approximation, so the placeholder's box
    // (gutters + max-width) matches what replaces it.
    loading: () => (
      <section className="bg-elyra-deep py-20 text-elyra-on-dark sm:py-28" aria-hidden="true">
        <div className="elyra-container max-w-container min-h-[720px]" />
      </section>
    ),
  }
)

export function SimulatorLazy(props: { scenario?: 'newOrder' | 'paymentReminder' | 'weeklyReport'; showScenarioPicker?: boolean }) {
  // Near-viewport gate (rootMargin 400px lead) — shared hook, formerly
  // copy-pasted observer machinery (board-R2).
  const { ref, near } = useNearViewport<HTMLDivElement>()

  return (
    <div ref={ref}>
      {near ? <LazySimulator {...props} /> : (
        /* Same-shaped spacer pre-observation (avoids a load-in jump when
           the observer fires before the dynamic chunk's loading state).
           G2-1 F3: same elyra-container/max-w-container shape as the
           loading placeholder + the real section. */
        <section className="bg-elyra-deep py-20 text-elyra-on-dark sm:py-28" aria-hidden="true">
          <div className="elyra-container max-w-container min-h-[720px]" />
        </section>
      )}
    </div>
  )
}
