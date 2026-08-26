'use client'

import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Animated SVG ring gauge (Phase 4 WS-4, prompt §7).
 *
 * Two instances render in the calculator result step: one for the budget
 * range and one for the duration in weeks. The ring fills via
 * stroke-dashoffset with a CSS transition (no rAF needed for the arc),
 * and the number counts up via a single rAF easeOutCubic loop that fires
 * on viewport entry AND on every value change.
 *
 * Pure SVG — no Canvas, no WebGL. RTL reverses the rotation direction.
 * Reduced-motion: final values displayed instantly, no animation.
 *
 * Phase 5 P1-4 fix: the original implementation animated `displayValue`
 * from 0 to `fraction` (a 0-1 number), then formatted that as money —
 * so a $15000 budget showed as "$1" because fraction=0.75 rounded to 1.
 * Now the component takes BOTH `fraction` (for the ring fill, 0-1) and
 * `value` (for the count-up display, the actual money/weeks number).
 * The ring fill animates proportionally to fraction; the displayed
 * number counts up to `value`. They're coupled by design (a higher value
 * also fills more of the ring) but formatted independently.
 */

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface RingGaugeProps {
  /** 0–1 fraction of the ring to fill. */
  fraction: number
  /** The actual value to count up to (e.g., budget in dollars, or weeks). */
  value: number
  /** Formatter for the count-up display value. */
  formatValue: (n: number) => string
  /** Label below the ring. */
  label: string
  /** Accent color (hex). */
  color: string
  /** RTL reverses the rotation direction. */
  isRtl: boolean
}

export function RingGauge({ fraction, value, formatValue, label, color, isRtl }: RingGaugeProps) {
  const reduced = usePrefersReducedMotion()
  // Count-up animates the VALUE (e.g. $15000), not the fraction — fixing
  // the original bug where formatMoney(0.75) showed "$1".
  const [displayValue, setDisplayValue] = useState(reduced ? value : 0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (reduced) return
    const from = fromRef.current
    const to = value
    if (from === to) return
    const duration = 800
    const startTime = performance.now()
    let cancelled = false
    let raf = 0
    const tick = (now: number) => {
      if (cancelled) return
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayValue(from + (to - from) * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        // Only commit fromRef when the animation completes successfully
        // — protects against React Strict Mode's effect cleanup+rerun
        // pattern, which otherwise updates fromRef before the rAF
        // actually fires, then the second effect sees from === to and
        // skips the animation entirely (Phase 5 P1-4 root cause).
        fromRef.current = to
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [value, reduced])

  // Ring fill — pure CSS transition on stroke-dashoffset (no rAF).
  const dashOffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)))
  const rotation = isRtl ? -90 : 90

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative size-32">
        <svg
          viewBox="0 0 120 120"
          className="size-full"
          style={{ transform: `rotate(${rotation}deg)` }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress arc — CSS transition handles the fill animation */}
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{
              transition: reduced ? 'none' : 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>
        {/* Count-up number centered */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {formatValue(reduced ? value : displayValue)}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
