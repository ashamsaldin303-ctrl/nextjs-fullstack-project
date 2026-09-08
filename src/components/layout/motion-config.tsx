'use client'

import { MotionConfig } from 'framer-motion'

/**
 * MotionConfigProvider — W2-03 (plan §2, decision D15): the central
 * framer-motion umbrella. `reducedMotion="user"` makes every framer
 * animation and transition inside the tree INSTANT for visitors who prefer
 * reduced motion — one setting covering every framer-motion consumer
 * (methodology cards, calculator slider/AnimatePresence, simulator)
 * without touching those files individually.
 *
 * The existing MANUAL gating (usePrefersReducedMotion hooks + the rAF
 * loops in cursor / cube / spotlight / scroll-progress / manifesto) stays
 * untouched on purpose: those hand-driven animations are OUTSIDE framer's
 * tree and keep their own hooks. The two systems reinforce each other —
 * both disable on `prefers-reduced-motion: reduce`; they never fight.
 */
export function MotionConfigProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
