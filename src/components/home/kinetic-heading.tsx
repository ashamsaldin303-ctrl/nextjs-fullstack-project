'use client'

import { useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { useCursorVelocity } from '@/lib/use-cursor-velocity'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { cn } from '@/lib/utils'

/**
 * Kinetic heading — R7 editorial rework.
 *
 * The hero h1 renders as an editorial display block: each LINE lives in an
 * overflow-hidden mask (`.hr-line`) and each WORD rises out of that mask
 * (`.hr-word`, translateY 125% → 0) with a per-word stagger — the classic
 * award-site reveal. The accent line carries a brand gradient + a spinning
 * star mark, and the three lines are staggered with inline-start indents
 * for a broken-grid, editorial rhythm.
 *
 * Kept from the previous version:
 *   · the cursor-velocity → `--wght` variable-font binding (Inter/Cairo);
 *   · per-word inline-block isolation (Arabic shaping stays whole — each
 *     word is one shaping run, joining never crosses spans);
 *   · LCP-safety: server-rendered words + CSS-only entrance, no JS wait.
 *
 * Arabic diacritics (damma/shadda rise above the em box) survive the mask
 * via `.hr-line { padding-block: .18em; margin-block: -.18em }` — the pad
 * widens the visible clip box, the negative margin cancels the layout gap.
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

/** Split a string into per-word spans (whitespace tokens preserved). */
function splitToWords(text: string): { word: string; key: number }[] {
  const words = text.split(/(\s+)/)
  let key = 0
  return words
    .filter((w) => w.length > 0)
    .map((w) => {
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

  useCursorVelocity(headingRef, {
    minWght,
    maxWght,
    idleWght,
    saturationVelocity: 2.5,
    idleMs: 200,
  })

  // Per-line reveal choreography: each line's words start after the
  // previous line has largely landed, words inside a line chase at 70ms.
  // R9: bases retimed to the tightened "Assembly" sweep (1.7s scan — the
  // light reaches the headline zone ~0.78–1.12s in; the words rise out of
  // the mask right as it passes over them).
  const lines = useMemo(
    () => [
      { text: t(titleTopKey), accent: false, base: 0.78, indent: '' },
      { text: t(titleAccentKey), accent: true, base: 0.95, indent: 'ms-[7vw] md:ms-[9vw]' },
      { text: t(titleBottomKey), accent: false, base: 1.12, indent: 'ms-[1.5vw]' },
    ],
    [t, titleTopKey, titleAccentKey, titleBottomKey],
  )

  return (
    <h1
      ref={headingRef}
      id={id}
      className={cn(
        // flex-col: flex containers never collapse the .hr-line negative
        // margins (block siblings would, costing ~2×0.18em per line) —
        // the padding/negative-margin mask trick stays net-zero.
        'mt-6 flex flex-col text-[clamp(2.7rem,9vw,8.5rem)] font-extrabold leading-[1.04] ltr:tracking-tight',
        className,
      )}
      // Bind font-variation-settings to --wght (default 700 when the
      // hook hasn't written anything — covers SSR + touch + reduced).
      style={{
        fontVariationSettings: reduced ? '"wght" 700' : '"wght" var(--wght, 700)',
      }}
    >
      {lines.map((line, lineIdx) => (
        <span
          key={lineIdx}
          className={cn('hr-line block', line.indent)}
        >
          {line.accent ? (
            <span className="hr-accent-words">
              {splitToWords(line.text).map(({ word, key }, wi) =>
                key === -1 ? (
                  word
                ) : (
                  <span
                    key={key}
                    className="hr-word inline-block"
                    style={{ animationDelay: `${(line.base + wi * 0.07).toFixed(2)}s` }}
                  >
                    {word}
                  </span>
                ),
              )}
              {/* Spinning star mark — the editorial "asterisk" flourish
                  that trails the accent word. Decorative, joins the same
                  mask-reveal choreography. */}
              <span
                className="hr-word hr-star inline-flex align-baseline"
                style={{ animationDelay: `${(line.base + 0.14).toFixed(2)}s` }}
                aria-hidden="true"
              >
                <Sparkles
                  className="motion-safe:animate-[spin_9s_linear_infinite] text-g-green"
                  strokeWidth={1.5}
                  style={{ width: '0.62em', height: '0.62em' }}
                />
              </span>
            </span>
          ) : (
            splitToWords(line.text).map(({ word, key }, wi) =>
              key === -1 ? (
                word
              ) : (
                <span
                  key={key}
                  className="hr-word inline-block"
                  style={{ animationDelay: `${(line.base + wi * 0.07).toFixed(2)}s` }}
                >
                  {word}
                </span>
              ),
            )
          )}
        </span>
      ))}
    </h1>
  )
}
