'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Lightweight scroll-reveal (Phase 3 §4.3) — IntersectionObserver + CSS
 * transitions, ZERO framer-motion. This is the drop-in replacement for the
 * old framer-based Reveal in every "simple" usage; framer-motion remains
 * only for the genuinely complex interactions (calculator step slider,
 * automation simulator, methodology scroll-linked cards).
 *
 * R2 (user request — "scroll animations across the whole site"): the
 * component grew VISUAL VARIANTS. All of them share the same discipline:
 *
 *   - content is present in the SSR HTML (SEO/no-JS see it after CSS runs);
 *   - animates once when scrolled into view (rootMargin -10%);
 *   - `delay` staggers via transition-delay (seconds);
 *   - reduced-motion users get instant content (global CSS override);
 *   - the hidden start state applies ONLY under `@media (scripting: enabled)`
 *     (see globals.css) so no-JS visitors never lose content.
 *
 * Variants:
 *   up    — fade + rise (the classic, default)
 *   zoom  — fade + scale 0.92→1 (cards, media)
 *   left  — fade + slide from the physical left (decorative, LTR+RTL safe)
 *   right — fade + slide from the physical right
 *   clip  — clip-path wipe from the bottom (headlines, images)
 *
 *   (L6-F1: the `blur` variant was removed — its only consumer was the
 *   testimonials section deleted in R9; zero live variant="blur" usages.)
 */
export type RevealVariant = 'up' | 'zoom' | 'left' | 'right' | 'clip'

const VARIANT_CLASS: Record<RevealVariant, string> = {
  up: 'reveal',
  zoom: 'reveal reveal-zoom',
  left: 'reveal reveal-left',
  right: 'reveal reveal-right',
  clip: 'reveal reveal-clip',
}

export function Reveal({
  children,
  className,
  delay = 0,
  variant = 'up',
}: {
  children: React.ReactNode
  className?: string
  /** Stagger in seconds (CSS transition-delay). */
  delay?: number
  /** Visual variant — see the table above. */
  variant?: RevealVariant
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
      className={cn(VARIANT_CLASS[variant], visible && 'reveal-visible', className)}
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

/**
 * Parallax — continuous scroll-LINKED motion (R2). Unlike Reveal (which
 * fires once), Parallax keeps translating the element while it is anywhere
 * near the viewport, so the drift tracks the scrollbar in both directions
 * like the deconstructed work card.
 *
 * Discipline:
 *   - rAF-coalesced scroll listener (one listener, one rect read per frame);
 *   - IntersectionObserver arms/disarms the scroll listener — elements far
 *     offscreen cost literally nothing;
 *   - transform-only (compositor), never layout properties;
 *   - reduced-motion → static (no listener at all);
 *   - `speed` in px per viewport-height of travel (negative = moves against
 *     the scroll direction). Keep it small (±80) — this is seasoning, not
 *     the dish.
 */
export function Parallax({
  children,
  className,
  speed = 40,
}: {
  children: React.ReactNode
  className?: string
  /** Vertical drift in px per viewport height of scroll (±; default 40). */
  speed?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let rafId = 0
    let armed = false

    const apply = () => {
      rafId = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // −1 (element top at viewport bottom) … +1 (element bottom at top)
      const t = (rect.top + rect.height / 2 - vh / 2) / vh
      const clamped = Math.max(-1.2, Math.min(1.2, t))
      el.style.transform = `translate3d(0, ${(-clamped * speed).toFixed(1)}px, 0)`
    }
    const requestUpdate = () => {
      if (!rafId) rafId = requestAnimationFrame(apply)
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && !armed) {
          armed = true
          window.addEventListener('scroll', requestUpdate, { passive: true })
          apply()
        } else if (!entry.isIntersecting && armed) {
          armed = false
          window.removeEventListener('scroll', requestUpdate)
          if (rafId) {
            cancelAnimationFrame(rafId)
            rafId = 0
          }
        }
      },
      { rootMargin: '20% 0px 20% 0px', threshold: 0 }
    )
    io.observe(el)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', requestUpdate)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [reduced, speed])

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  )
}
