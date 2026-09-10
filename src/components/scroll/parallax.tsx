'use client'

/**
 * Parallax (REF-2 Phase B) — the multi-speed depth layer.
 *
 * Wraps decorative blocks (stat numerals, watermarks, media) and drifts
 * them against the page's travel: the block passes the viewport slower
 * (speed > 0) or faster (speed < 0) than the document. Everything the
 * reference sites use to break the "flat scrolling paper" feeling —
 * executed with ONE transform, pure function of scroll progress, fully
 * reversible, and completely still once the block is out of range.
 *
 * prefers-reduced-motion → plain passthrough (no drift).
 *
 * IMPORTANT placement rule: the wrapped element must not be the anchor
 * of sticky/fixed descendants (transform creates a containing block for
 * fixed positioning — sticky is unaffected but its motion would fight
 * the drift; keep Parallax on leaf/decorative layers only).
 */

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

interface ParallaxProps {
  children: React.ReactNode
  className?: string
  /** Positive = lags behind the page (far layer). Negative = races ahead
   *  (near layer). |speed| is px of drift per viewport-height travelled;
   *  stay ≤ 90 for content, ≤ 160 for pure decoration. */
  speed?: number
}

export function Parallax({ children, className, speed = 40 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  // The block's journey through the viewport band (enters bottom, leaves
  // top) → 0..1.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed], { clamp: true })

  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      style={{ y, willChange: 'transform' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
