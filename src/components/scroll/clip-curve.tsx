'use client'

/**
 * ClipCurve (REF-2 Phase B) — the aardvark-style curved section boundary.
 *
 * A full-width SVG band whose top edge is a designed quadratic curve.
 * Placed as the LAST in-flow child of a dark section, it paints the NEXT
 * section's light surface bulging up into the dark one along that curve —
 * the organic "sections bleed into each other" signature of
 * aardvarkbookclub.com (is--inner-clip / is--outer-clip), instead of a
 * hard flat edge.
 *
 * The curve's dip deepens with scroll (a flat-ish seam far from the
 * viewport, the full designed dip as it rides to mid-screen) via a
 * useMotionTemplate path — every frame is a pure function of scroll
 * position, fully reversible; prefers-reduced-motion renders the static
 * designed dip (the curve still exists as composition, just not driven).
 *
 * Symmetric around the vertical center axis — no RTL mirroring needed.
 * Decorative: aria-hidden + pointer-events-none (clicks pass through to
 * the section beneath — G8 discipline).
 */

import { useRef } from 'react'
import { motion, useMotionTemplate, useScroll, useTransform } from 'framer-motion'

import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

interface ClipCurveProps {
  /** Tailwind text-color class matching the NEXT section's surface (the
   *  path is filled with currentColor). e.g. "text-background". */
  fillClass: string
  /** Band height in px (design scale: 150 = one full gesture step). */
  height?: number
  /** Resting dip as a fraction of height (reduced-motion / SSR paint). */
  restDip?: number
  /** Scroll-driven dip range [min, max] as fractions of height. */
  dipRange?: [number, number]
  className?: string
}

export function ClipCurve({
  fillClass,
  height = 150,
  restDip = 0.55,
  dipRange = [0.38, 0.78],
  className,
}: ClipCurveProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  // Progress 0 → 1 as the band's top edge travels from the viewport
  // bottom to the viewport center — the curve "grows" as it rides up.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'start 0.45'],
  })

  const dip = useTransform(
    scrollYProgress,
    [0, 1],
    [height * dipRange[0], height * dipRange[1]],
    { clamp: true },
  )
  const path = useMotionTemplate`M0,0 Q720,${dip} 1440,0 L1440,${height} L0,${height} Z`

  const restPath = `M0,0 Q720,${(height * restDip).toFixed(1)} 1440,0 L1440,${height} L0,${height} Z`

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none relative w-full select-none', className)}
      style={{ height }}
    >
      <svg
        viewBox={`0 0 1440 ${height}`}
        preserveAspectRatio="none"
        className={cn('absolute inset-0 block h-full w-full', fillClass)}
        // SVG children are purely geometric — screen readers already
        // skipped the whole band via aria-hidden above.
        focusable="false"
      >
        {reduced ? (
          <path d={restPath} fill="currentColor" />
        ) : (
          <motion.path d={path} fill="currentColor" />
        )}
      </svg>
    </div>
  )
}
