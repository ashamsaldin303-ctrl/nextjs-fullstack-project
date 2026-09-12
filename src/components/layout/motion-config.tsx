'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { MotionConfig as MotionConfigFn } from 'framer-motion'

/**
 * MotionConfigProvider — W2-03 (plan §2, decision D15): the central
 * framer-motion umbrella. `reducedMotion="user"` makes every framer-motion
 * animation and transition inside the tree INSTANT for visitors who prefer
 * reduced motion — one setting covering every framer-motion consumer
 * (methodology cards, calculator slider/AnimatePresence, simulator)
 * without touching those files individually.
 *
 * F-S3-04 / F-S7-01 (gold-standard audit): framer-motion used to ship in
 * the INITIAL bundle on EVERY route because this client component was
 * statically imported from the root layout. It is now loaded via a
 * dynamic `import('framer-motion')` AFTER hydration:
 *
 *   - SSR/hydration render children UNWRAPPED — the children are the
 *     server layout's slots and stay fully server-rendered (next/dynamic
 *     with ssr:false would have BLANKED the page's first paint; this
 *     hand-rolled wrapper keeps the HTML intact);
 *   - once the module resolves (instantly on routes whose own chunks
 *     already import framer-motion — same module instance; never loaded
 *     at all on framer-free routes, e.g. error/loading-only renders), the
 *     MotionConfig context mounts and every consumer re-renders under it;
 *   - context propagation is reactive, so consumers that mounted before
 *     the umbrella pick up reducedMotion="user" the moment it lands —
 *     in practice consumers statically import framer themselves, so the
 *     umbrella is always in place before their first animated frame.
 *
 * The existing MANUAL gating (usePrefersReducedMotion hooks + the rAF
 * loops in cursor / cube / spotlight / scroll-progress / manifesto) stays
 * untouched on purpose: those hand-driven animations are OUTSIDE framer's
 * tree and keep their own hooks. The two systems reinforce each other —
 * both disable on `prefers-reduced-motion: reduce`; they never fight.
 */
export function MotionConfigProvider({ children }: { children: ReactNode }) {
  const [MotionConfig, setMotionConfig] = useState<typeof MotionConfigFn | null>(null)

  useEffect(() => {
    let alive = true
    void import('framer-motion').then((mod) => {
      if (alive) setMotionConfig(() => mod.MotionConfig)
    })
    return () => {
      alive = false
    }
  }, [])

  if (MotionConfig) {
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>
  }
  return <>{children}</>
}
