'use client'

/**
 * VelocitySkew (REF-2 Phase B) — the fling-lean.
 *
 * While the visitor flings the page (up OR down) the wrapped block leans
 * a few degrees INTO the direction of travel — the classic award-site
 * "speed lines" cue (aardvark/animejs family). scrollY → useVelocity →
 * a critically-damped spring → clamped skewY.
 *
 * Contract compliance:
 * · Pure function of scroll position history — fully reversible; scroll
 *   the opposite way and the lean mirrors instantly.
 * · The spring settles to EXACTLY 0 when scrolling stops (framer-motion
 *   stops its driver loop once at rest — nothing keeps animating).
 * · prefers-reduced-motion → plain div, zero JS participation.
 *
 * Kept subtle by design: ±3° max, spring damping high (no wobble), so
 * headings never lose readability mid-fling.
 */

import { motion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion'

import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

interface VelocitySkewProps {
  children: React.ReactNode
  className?: string
  /** Max lean in degrees (applied symmetrically). Default 3. */
  max?: number
  /** Velocity (px/s) at which the lean saturates. Default 2200. */
  saturation?: number
}

export function VelocitySkew({
  children,
  className,
  max = 3,
  saturation = 2200,
}: VelocitySkewProps) {
  const reduced = usePrefersReducedMotion()

  const { scrollY } = useScroll()
  const velocity = useVelocity(scrollY)
  // High damping + mid stiffness: tracks the fling, never oscillates.
  const smoothVelocity = useSpring(velocity, {
    stiffness: 350,
    damping: 55,
    mass: 0.9,
  })
  // Lean INTO the travel: scrolling DOWN (positive velocity) → negative
  // skew (top of the block drifts forward, like acceleration lean).
  const skewY = useTransform(
    smoothVelocity,
    [-saturation, 0, saturation],
    [max, 0, -max],
    { clamp: true },
  )

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      style={{ skewY }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  )
}
