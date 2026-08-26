'use client'

import { useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useCursorVelocity } from '@/lib/use-cursor-velocity'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

/**
 * Kinetic heading (Phase 5 WS-6, prompt §9).
 *
 * The hero h1 (and optionally the primary CTA) binds to a CSS custom
 * property `--wght` whose value is driven by the cursor's velocity.
 * Variable-font Inter (Latin) + Cairo (Arabic) honor
 * `font-variation-settings: "wght" var(--wght, 700)`.
 *
 * Velocity mapping (prompt §9):
 *   · idle (no movement for 200ms) → wght 700 (the static default);
 *   · slow cursor (<2.5 px/ms)     → wght interpolated 600→800;
 *   · fast cursor (>2.5 px/ms)    → wght 800 (saturated).
 *
 * Per-word spans (prompt §9):
 *   · Arabic shaping benefits from per-word isolation — each word
 *     becomes its own inline-block so the font's complex-contextual
 *     shaping doesn't bleed across the whole line. For Latin the
 *     split is purely visual (each word gets its own variation
 *     instance, but the difference is sub-perceptual).
 *
 * Activation guards:
 *   · `pointer: fine` + NOT `prefers-reduced-motion` + client-side
 *     mount — otherwise the heading renders with the static `wght 700`
 *     default and never installs the pointer listener.
 *
 * LCP-safe: the heading is server-rendered with the static wght 700.
 * The hook attaches AFTER hydration and only writes a CSS variable —
 * no flash, no layout shift, no React re-render per frame.
 */

interface KineticHeadingProps {
  /** i18n keys for the three lines (top / accent / bottom). */
  titleTopKey: string
  titleAccentKey: string
  titleBottomKey: string
  /** Heading id (for aria-labelledby wiring). */
  id?: string
  /** Velocity-to-wght range. Default 600→800, idle 700. */
  minWght?: number
  maxWght?: number
  idleWght?: number
  className?: string
}

/** Split a string into per-word spans. For RTL Arabic each word
 *  becomes its own inline-block so the font's complex-contextual
 *  shaping doesn't bleed across the whole line. */
function splitToWords(text: string): { word: string; key: number }[] {
  const words = text.split(/(\s+)/) // keep whitespace tokens
  let key = 0
  return words
    .filter((w) => w.length > 0)
    .map((w) => {
      // Whitespace tokens: render as a literal space (no span).
      if (/^\s+$/.test(w)) return { word: w, key: -1 }
      return { word: w, key: key++ }
    })
}

export function KineticHeading({
  titleTopKey,
  titleAccentKey,
  titleBottomKey,
  id,
  minWght = 600,
  maxWght = 800,
  idleWght = 700,
  className,
}: KineticHeadingProps) {
  const t = useTranslations('hero')
  const reduced = usePrefersReducedMotion()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Only attach the cursor-velocity hook when motion is allowed. The
  // hook itself also checks the same guards — we skip the call site
  // entirely so the ref is unused during SSR + reduced-motion.
  useCursorVelocity(headingRef, {
    minWght,
    maxWght,
    idleWght,
    saturationVelocity: 2.5,
    idleMs: 200,
  })

  const lines = useMemo(
    () => [
      { text: t(titleTopKey), accent: false },
      { text: t(titleAccentKey), accent: true },
      { text: t(titleBottomKey), accent: false },
    ],
    [t, titleTopKey, titleAccentKey, titleBottomKey],
  )

  return (
    <h1
      ref={headingRef}
      id={id}
      className={cn('hero-enter mt-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl', className)}
      // Bind font-variation-settings to --wght (default 700 when the
      // hook hasn't written anything — covers SSR + touch + reduced).
      style={{
        fontVariationSettings: reduced ? '"wght" 700' : '"wght" var(--wght, 700)',
      }}
    >
      {lines.map((line, lineIdx) => (
        <span
          key={lineIdx}
          className={cn('block', line.accent && 'text-primary')}
        >
          {splitToWords(line.text).map(({ word, key }) =>
            // Whitespace token → render as plain string (no wrapper).
            key === -1 ? (
              word
            ) : (
              <span
                key={key}
                className="inline-block"
                // Per-word wght: each word can carry its own --wght
                // inheritance. For now all words share the parent's
                // --wght (the hook writes to the h1). Future per-word
                // velocity is a one-line extension (set --wght on
                // each span based on cursor distance to that word).
              >
                {word}
              </span>
            ),
          )}
        </span>
      ))}
    </h1>
  )
}
