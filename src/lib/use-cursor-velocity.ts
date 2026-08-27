'use client'

import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from './use-reduced-motion'

/**
 * useCursorVelocity — Phase 5 WS-6 (Kinetic Typography).
 *
 * Tracks pointer velocity (pixels per millisecond) and writes the result
 * to a CSS custom property on the target element's ref. Designed for
 * variable-font headings whose weight (`--wght`) responds to how fast
 * the visitor moves their cursor — fast moves → heavier weight (800),
 * slow moves → lighter (600), default 700 when idle.
 *
 * Throttled to one rAF per frame (max ~60fps) and writes directly to
 * the DOM via the ref — zero React re-renders per frame.
 *
 * Guards (prompt §9):
 *   · `pointer: fine` only — touch devices get static wght=700;
 *   · per-event pointerType filter (mouse/pen) — hybrid touch screens
 *     fire touch pointermove on a fine-pointer device;
 *   · NOT `prefers-reduced-motion` — reduced-motion users get static
 *     wght=700;
 *   · client-only mount (the ref is null on the server).
 *
 * The caller passes the target element's ref + the velocity-to-wght
 * mapping (default 600→800 with idle=700). The hook writes
 * `--wght` straight to the element's style.
 */

interface CursorVelocityOptions {
  /** Minimum wght at zero velocity (default 600). */
  minWght?: number
  /** Maximum wght at high velocity (default 800). */
  maxWght?: number
  /** Idle wght when the cursor hasn't moved for >idleMs (default 700). */
  idleWght?: number
  /** Velocity (px/ms) at which wght saturates to maxWght (default 2.5). */
  saturationVelocity?: number
  /** Milliseconds of stillness before wght returns to idle (default 200). */
  idleMs?: number
}

export function useCursorVelocity(
  ref: React.RefObject<HTMLElement | null>,
  options: CursorVelocityOptions = {},
) {
  const reduced = usePrefersReducedMotion()
  const {
    minWght = 600,
    maxWght = 800,
    idleWght = 700,
    saturationVelocity = 2.5,
    idleMs = 200,
  } = options

  // Persist last cursor position + time outside React state — refs only.
  const lastPos = useRef<{ x: number; y: number; t: number } | null>(null)
  const idleTimer = useRef<number | null>(null)
  const rafId = useRef<number>(0)
  const targetWght = useRef(idleWght)
  const currentWght = useRef(idleWght)

  useEffect(() => {
    // Activation guards — bail entirely on touch or reduced-motion.
    if (reduced) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const el = ref.current
    if (!el) return

    let disposed = false

    // Re-run (StrictMode, option change): start from a clean idle state so
    // the lerp doesn't jump in from a stale weight left by the previous run.
    targetWght.current = idleWght
    currentWght.current = idleWght

    const writeWght = () => {
      if (disposed) return
      // Lerp current toward target for smooth transitions — no jumps
      // when the cursor stops suddenly.
      currentWght.current += (targetWght.current - currentWght.current) * 0.18
      // Converged? Snap exactly to the target (sub-0.5 wght is invisible)
      // and stop the loop — otherwise keep easing on the next frame.
      // The loop must be self-sustaining: without the re-schedule below,
      // the idle timer fired exactly ONE 18% step and --wght froze
      // mid-transition (e.g. stuck at 770.7 instead of easing to 700).
      if (Math.abs(targetWght.current - currentWght.current) <= 0.5) {
        currentWght.current = targetWght.current
      }
      // Round to 1 decimal — sub-pixel wght steps are perceptible
      // noise on variable fonts, but 0.1 granularity is invisible.
      const w = Math.round(currentWght.current * 10) / 10
      el.style.setProperty('--wght', w.toString())
      if (currentWght.current !== targetWght.current) {
        rafId.current = requestAnimationFrame(writeWght)
      } else {
        rafId.current = 0
      }
    }

    const scheduleWrite = () => {
      if (rafId.current) return
      rafId.current = requestAnimationFrame(writeWght)
    }

    const onPointerMove = (e: PointerEvent) => {
      // L3 FIX (R5): the (pointer: fine) media guard above still passes on
      // hybrid devices (touchscreen laptops), where touch drags fire window
      // pointermove too — same per-event filter as use-magnetic: only fine
      // pointers may animate the font weight.
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      const now = performance.now()
      const last = lastPos.current
      lastPos.current = { x: e.clientX, y: e.clientY, t: now }

      if (!last) {
        scheduleWrite()
        return
      }

      const dt = now - last.t
      // Skip frames with dt < 1ms — division noise.
      if (dt < 1) {
        scheduleWrite()
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      const distance = Math.hypot(dx, dy)
      const velocity = distance / dt // px / ms

      // Map velocity → wght: 0 = minWght, saturation = maxWght.
      const ratio = Math.min(1, velocity / saturationVelocity)
      // Ease the ratio so small movements don't slam to minWght.
      const eased = ratio * ratio
      targetWght.current = minWght + (maxWght - minWght) * eased

      // Reset idle timer — wght returns to idle after idleMs of stillness.
      if (idleTimer.current !== null) {
        window.clearTimeout(idleTimer.current)
      }
      idleTimer.current = window.setTimeout(() => {
        targetWght.current = idleWght
        scheduleWrite()
      }, idleMs)

      scheduleWrite()
    }

    // Initialize wght to idle.
    el.style.setProperty('--wght', idleWght.toString())

    window.addEventListener('pointermove', onPointerMove, { passive: true })

    return () => {
      disposed = true
      window.removeEventListener('pointermove', onPointerMove)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      // Reset so a stale handle can never block the next effect run's
      // scheduleWrite() (the loop is self-sustaining now — without this
      // reset, StrictMode remounts would freeze at the old handle).
      rafId.current = 0
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current)
      // Reset to idle on unmount so the element doesn't keep the last wght.
      el.style.setProperty('--wght', idleWght.toString())
    }
  }, [reduced, ref, minWght, maxWght, idleWght, saturationVelocity, idleMs])
}
