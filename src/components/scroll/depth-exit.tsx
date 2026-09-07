'use client'

/**
 * DepthExit (REF-2 Phase B) — the hero content recede.
 *
 * As the visitor scrolls out of a full-viewport hero, its content column
 * doesn't just slide away with the page: it RECEDES — drifting slightly
 * downward, easing toward 0.94 scale and fading late — so the hero feels
 * like a deep stage the camera is pulling back from (illoca's
 * scrollytelling depth, executed with pure DOM transforms).
 *
 * · Pure function of the hero's scroll progress: reversible, deterministic,
 *   and it stops the instant the hero has fully left (progress 1) —
 *   nothing keeps animating afterwards.
 * · Transform + opacity only (compositor-friendly; never touches layout).
 * · prefers-reduced-motion → the column rides with the page normally.
 */

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

interface DepthExitProps {
  children: React.ReactNode
  className?: string
  /** Downward drift over the exit, as a fraction of the element height. */
  drift?: number
  /** Final scale. */
  endScale?: number
}

export function DepthExit({
  children,
  className,
  drift = 0.3,
  endScale = 0.94,
}: DepthExitProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  // 0 while the column's top sits at the viewport top; 1 by the time its
  // bottom reaches the viewport top (the full hero exit).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${drift * 100}%`])
  const scale = useTransform(scrollYProgress, [0, 1], [1, endScale])
  // Hold full presence for the first 30% of the exit, fade through 85%,
  // fully gone before the hero bottom clears (never a stray ghost pixel).
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.85, 1], [1, 1, 0, 0])

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      style={{ y, scale, opacity, willChange: 'transform, opacity' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
