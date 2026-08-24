'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lightweight scroll-reveal (Phase 3 §4.3) — IntersectionObserver + CSS
 * transitions, ZERO framer-motion. This is the drop-in replacement for the
 * old framer-based Reveal in every "simple" usage; framer-motion remains
 * only for the genuinely complex interactions (calculator step slider,
 * automation simulator, methodology scroll-linked cards).
 *
 * Behavior parity with the old component:
 *   - content is present in the SSR HTML (SEO/no-JS see it after CSS runs);
 *   - animates once when scrolled into view (rootMargin -10%);
 *   - `delay` staggers via transition-delay (seconds);
 *   - reduced-motion users get instant content (global CSS override).
 */

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  /** Stagger in seconds (CSS transition-delay). */
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // Legacy fallback — async (rAF) so we never setState synchronously
      // inside the effect body (react-hooks/set-state-in-effect).
      const id = window.requestAnimationFrame(() => setVisible(true))
      return () => window.cancelAnimationFrame(id)
    }
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('reveal', visible && 'reveal-visible', className)}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  )
}

/**
 * KineticTypography — variable-font weight animation per word, now CSS-only.
 * Each word is an inline-block running the `kinetic-word` keyframes with a
 * per-word stagger. Runs on first paint (no JS dependency, no in-view wait —
 * same as the previous framer implementation which animated on mount).
 *
 * Above-the-fold heroes do NOT use this (LCP discipline — Phase 3 §4.1);
 * it is only for below-fold section headings.
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
  const words = text.split(' ').filter(Boolean)
  return (
    <span className={cn('inline-block', className)} aria-label={text}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className={cn('kinetic-word', wordClassName)}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {w}
            {i < words.length - 1 ? '\u00A0' : ''}
          </span>
        ))}
      </span>
    </span>
  )
}
