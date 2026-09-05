'use client'

import dynamic from 'next/dynamic'
import { useNearViewport } from '@/lib/use-near-viewport'

/**
 * Lazy wrapper around the Calculator (Phase 5 WS-8).
 *
 * The Calculator is the heaviest client component on /contact (and the
 * last section on /): framer-motion's AnimatePresence + motion.div
 * step transitions ship ~30KB minified+gzipped in the initial bundle.
 * On /contact the calculator sits BELOW the channels/form section, and
 * on / it sits below hero/bento/simulator/featured-work/methodology —
 * either way, well below the fold. G3-5: it now also closes both
 * service pages (/services/websites, /services/automation) as the
 * on-page #calculator target their hero/CTA copy promises.
 *
 * This wrapper defers BOTH the chunk load and the hydration until the
 * section approaches the viewport (rootMargin 400px) — the same proven
 * pattern used for SimulatorLazy + CapabilityScene. A section-shaped
 * placeholder keeps the layout stable (no CLS, no scrollbar jump).
 *
 * LCP-safe: the calculator is never the LCP element on any route. The
 * deferred chunk only loads when the user has scrolled toward it — by
 * then LCP has long since fired.
 *
 * Reduced-motion + touch: the wrapper itself is JS-only and inert; the
 * real Calculator handles reduced-motion + touch internally (it falls
 * back to instant step transitions). The lazy gate is unconditional.
 */

const LazyCalculator = dynamic(
  () => import('./calculator').then((m) => m.Calculator),
  {
    ssr: false,
    // Placeholder mirrors the calculator's outer rhythm: same bg +
    // vertical padding + min-height — keeps CLS at 0 pre-load.
    // FIX(2-c/8): raised to an honest approximation — the tallest wizard
    // step (features) renders ≈1200px (heading + progress + step card +
    // controls); slightly under to avoid overshoot.
    loading: () => (
      <section
        className="bg-background py-20 sm:py-28"
        aria-hidden="true"
      >
        <div className="elyra-container mx-auto min-h-[1000px] max-w-5xl" />
      </section>
    ),
  }
)

export function CalculatorLazy() {
  // Near-viewport gate (rootMargin 400px lead) — shared hook, formerly
  // copy-pasted observer machinery (board-R2).
  const { ref, near } = useNearViewport<HTMLDivElement>()

  return (
    <div
      ref={ref}
      // G2-3 P2-1 (fix 1): the STABLE anchor target for #calculator links.
      // The id lives here — not on the Calculator's own <section> — so the
      // hash resolves in the SSR HTML (pre-hydration, pre-lazy-load) AND
      // after the real component swaps in (the wrapper never unmounts, so
      // the anchor never goes stale mid-scroll). scroll-mt-20 (80px)
      // clears the fixed h-16 navbar when the browser jumps to the anchor.
      id="calculator"
      className="scroll-mt-20"
    >
      {near ? <LazyCalculator /> : (
        /* Same-shaped spacer pre-observation (avoids a load-in jump when
           the observer fires before the dynamic chunk's loading state). */
        <section
          className="bg-background py-20 sm:py-28"
          aria-hidden="true"
        >
          <div className="elyra-container mx-auto min-h-[1000px] max-w-5xl" />
        </section>
      )}
    </div>
  )
}
