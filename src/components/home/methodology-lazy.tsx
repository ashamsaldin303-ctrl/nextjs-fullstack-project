'use client'

import dynamic from 'next/dynamic'
import { useNearViewport } from '@/lib/use-near-viewport'

/**
 * Lazy wrapper around the Methodology section (Phase 5 WS-8).
 *
 * The Methodology component uses framer-motion's useScroll + useTransform
 * to drive a sticky stacked-cards effect. The framer-motion chunk ships
 * in the initial bundle when Methodology is imported eagerly. On / the
 * section is below hero/bento/simulator/featured-work — well below the
 * fold — so deferring it costs no UX while cutting the initial JS.
 *
 * Same pattern as SimulatorLazy + CalculatorLazy: defer both the chunk
 * load and the hydration until the section approaches the viewport
 * (rootMargin 400px). A section-shaped placeholder keeps CLS at 0.
 */

const LazyMethodology = dynamic(
  () => import('./methodology').then((m) => m.Methodology),
  {
    ssr: false,
    loading: () => (
      <section
        className="bg-background py-20 sm:py-28"
        aria-hidden="true"
      >
        <div className="elyra-container mx-auto min-h-[900px] max-w-container sm:min-h-[1100px]" />
      </section>
    ),
  }
)

export function MethodologyLazy() {
  // Near-viewport gate (rootMargin 400px lead) — shared hook, formerly
  // copy-pasted observer machinery (board-R2).
  const { ref, near } = useNearViewport<HTMLDivElement>()

  return (
    <div ref={ref}>
      {near ? <LazyMethodology /> : (
        <section
          className="bg-background py-20 sm:py-28"
          aria-hidden="true"
        >
          <div className="elyra-container mx-auto min-h-[900px] max-w-container sm:min-h-[1100px]" />
        </section>
      )}
    </div>
  )
}
