'use client'

import { useEffect } from 'react'
import { usePrefersReducedMotion } from './use-reduced-motion'

/**
 * useMagnetic — R7-b "Sensory Polish Layer": a magnetic pull for
 * call-to-action elements. When the pointer comes within `radius` px
 * beyond the element's bounds, the element eases toward the pointer
 * (strength × offset-from-center, clamped to ±MAX_OFFSET so the pull
 * always stays classy). When the pointer leaves the radius, the element
 * eases back to rest and the hook lets go.
 *
 * Follows the codebase's rAF-coalesced pattern (see use-cursor-velocity):
 * a window pointermove listener only stores the latest position; a single
 * rAF loop — scheduled on demand, never free-running — reads
 * getBoundingClientRect at most once per frame and writes
 * `el.style.transform = translate3d(…)` directly. No React state, no
 * re-renders, no layout reads outside the frame callback.
 *
 * Transform ownership (the standard approach for composability):
 *   · While magnetized (or easing back), the hook OWNS el.style.transform
 *     exclusively — per-frame writes are un-transitioned, so the rAF lerp
 *     is the only easing.
 *   · When the element settles back at rest, the inline transform is
 *     removed ENTIRELY, so CSS classes (Tailwind hover:scale,
 *     transition-transform, …) govern the resting state again.
 *   · If the element itself transitions `transform` (e.g. Tailwind
 *     `transition-transform hover:scale-105` on the hero CTA), that
 *     transition would also smooth the per-frame writes into mush — so it
 *     is suppressed with an inline `transition: none` for exactly as long
 *     as the hook is writing, then restored. Elements that transition
 *     other properties (colors) are left untouched.
 *
 * No-op — returns immediately, attaches nothing — when
 * prefers-reduced-motion is set or the pointer isn't fine (the
 * usePrefersReducedMotion pattern: reactive, so toggling the preference
 * mid-session re-arms or disarms cleanly).
 *
 * @param ref Ref to the element to magnetize (shares fine with other
 *            hooks on the same ref as long as they don't write
 *            `transform` — e.g. useCursorVelocity writes a CSS var).
 * @param options.strength Pull factor toward the pointer (default 0.3).
 * @param options.radius   Activation distance beyond the element's bounds
 *                         in px (default 28).
 */

/** Max translate magnitude in px — keeps the pull subtle. */
const MAX_OFFSET = 14
/** Both axes within this of their target → settled (stop the loop). */
const SETTLE_EPSILON = 0.2
/** Per-frame easing factor toward the target offset. */
const LERP = 0.18

export interface MagneticOptions {
  /** Pull factor toward the pointer (default 0.3). */
  strength?: number
  /** Activation distance beyond the element's bounds, px (default 28). */
  radius?: number
}

export function useMagnetic<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  options: MagneticOptions = {},
): void {
  const reduced = usePrefersReducedMotion()
  const { strength = 0.3, radius = 28 } = options

  useEffect(() => {
    // Activation guards — bail entirely on touch or reduced-motion.
    if (reduced) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    const el = ref.current
    if (!el) return

    let disposed = false
    let raf = 0
    // armed: a real pointer position has been seen (the {0,0} default must
    // never magnetize an element that happens to sit near the corner).
    let armed = false

    const pointer = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }

    // --- transform ownership bookkeeping --------------------------------
    const inlineTransition = el.style.transition
    let transitionSuppressed = false
    // Does this element transition `transform` (or `all`)? If so, that
    // transition must be silenced while the hook drives the transform.
    const transitionsTransform = (() => {
      const props = window.getComputedStyle(el).transitionProperty
      return props === 'all' || props.split(',').some((p) => p.trim() === 'transform')
    })()
    const suppressTransition = () => {
      // Only elements that actually transition transform (or all) need
      // the silencing — color-only transitions are left untouched.
      if (!transitionsTransform || transitionSuppressed) return
      transitionSuppressed = true
      el.style.transition = 'none'
    }
    const restoreTransition = () => {
      if (transitionSuppressed) {
        transitionSuppressed = false
        el.style.transition = inlineTransition
      }
    }

    const tick = () => {
      raf = 0
      if (disposed || !armed) return
      const rect = el.getBoundingClientRect()
      const dx = pointer.x - (rect.left + rect.width / 2)
      const dy = pointer.y - (rect.top + rect.height / 2)
      // Distance from the pointer to the element's bounds — 0 while
      // inside, growing as it moves beyond the box (direction-agnostic,
      // so RTL/LTR is irrelevant here).
      const gapX = Math.max(0, Math.abs(dx) - rect.width / 2)
      const gapY = Math.max(0, Math.abs(dy) - rect.height / 2)
      const dist = Math.hypot(gapX, gapY)

      let targetX = 0
      let targetY = 0
      if (dist <= radius) {
        targetX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * strength))
        targetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * strength))
      }

      current.x += (targetX - current.x) * LERP
      current.y += (targetY - current.y) * LERP

      if (
        Math.abs(targetX - current.x) < SETTLE_EPSILON &&
        Math.abs(targetY - current.y) < SETTLE_EPSILON
      ) {
        // Settled. At rest → release the element back to CSS entirely.
        // Still attracted (pointer parked nearby) → pin the exact target
        // and idle until the pointer moves again.
        if (targetX === 0 && targetY === 0) {
          el.style.transform = ''
          restoreTransition()
        } else {
          current.x = targetX
          current.y = targetY
          suppressTransition()
          el.style.transform = `translate3d(${targetX.toFixed(2)}px, ${targetY.toFixed(2)}px, 0)`
        }
        return
      }

      suppressTransition()
      el.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`
      raf = requestAnimationFrame(tick)
    }

    const schedule = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(tick)
    }

    const onPointerMove = (e: PointerEvent) => {
      // Mouse and pen are fine pointers; touch drags must not magnetize.
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      pointer.x = e.clientX
      pointer.y = e.clientY
      armed = true
      schedule()
    }

    // Keep the offset honest when the page shifts under a resting pointer
    // (scrolling can slide the element away from / under the cursor).
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
      // Never leave a stale inline transform/transition behind.
      el.style.transform = ''
      restoreTransition()
    }
  }, [reduced, ref, strength, radius])
}
