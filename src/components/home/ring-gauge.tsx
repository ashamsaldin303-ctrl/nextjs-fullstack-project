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
 */

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface RingGaugeProps {
  /** 0–1 fraction of the ring to fill. */
  fraction: number
  /** Formatter for the count-up display value. */
  formatValue: (n: number) => string
  /** Label below the ring. */
  label: string
  /** Accent color (hex). */
  color: string
  /** RTL reverses the rotation direction. */
  isRtl: boolean
}

export function RingGauge({ fraction, formatValue, label, color, isRtl }: RingGaugeProps) {
  const reduced = usePrefersReducedMotion()
  const [displayValue, setDisplayValue] = useState(reduced ? fraction : 0)
  const fromRef = useRef(0)

  // Count-up animation — fires on mount (viewport entry via the IO guard
  // in the parent) and on every fraction change (calculator input changes).
  // setDisplayValue is called inside a rAF callback (async, NOT synchronous
  // in the effect body) so react-hooks/set-state-in-effect does not flag it.
  useEffect(() => {
    if (reduced) return
    const from = fromRef.current
    const to = fraction
    if (from === to) return
    const duration = 800
    const startTime = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayValue(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    fromRef.current = to
    return () => cancelAnimationFrame(raf)
  }, [fraction, reduced])

  // Ring fill — pure CSS transition on stroke-dashoffset (no rAF).
  const effectiveFraction = reduced ? fraction : fraction
  const dashOffset = CIRCUMFERENCE * (1 - effectiveFraction)
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
            {formatValue(reduced ? fraction : displayValue)}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
