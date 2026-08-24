'use client'

import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Scroll-reveal wrapper — respects prefers-reduced-motion.
 * Renders content immediately for SSR; transforms fire only after mount+inView.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' })

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

/**
 * KineticTypography — animates the variable-font weight axis of each word
 * as it enters the viewport. Works for both Latin (Inter) and Arabic (Cairo)
 * because both are variable fonts; Arabic words animate as whole units
 * (Arabic letters are connected — word-level motion is correct).
 */
export function KineticWords({
  text,
  className,
  wordClassName,
}: {
  text: string
  className?: string
  wordClassName?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' })

  const words = text.split(' ').filter(Boolean)

  if (reduced) {
    return (
      <span ref={ref} className={className}>
        {text}
      </span>
    )
  }

  return (
    <span ref={ref} className={cn('inline-block', className)} aria-label={text}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <motion.span
            key={`${w}-${i}`}
            className={cn('inline-block whitespace-nowrap', wordClassName)}
            initial={{ opacity: 0, y: 30, fontVariationSettings: '"wght" 200' }}
            animate={
              inView
                ? { opacity: 1, y: 0, fontVariationSettings: '"wght" 700' }
                : { opacity: 0, y: 30, fontVariationSettings: '"wght" 200' }
            }
            transition={{
              duration: 1.1,
              delay: 0.08 * i,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ willChange: 'transform, opacity, font-variation-settings' }}
          >
            {w}
            {i < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        ))}
      </span>
    </span>
  )
}
