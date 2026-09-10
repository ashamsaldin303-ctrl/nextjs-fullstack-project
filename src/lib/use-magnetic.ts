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
 * rAF loop — scheduled on demand, never free-running — writes
 * `el.style.transform = translate3d(…)` directly. No React state, no
 * re-renders. Layout reads follow the rune-scene rect-cache contract
 * (AUDIT-A3 FIX 7): the DOM rect is read ONCE per arm (mount / resize /
 * pointer-proximate scroll event — all BEFORE Lenis's same-frame
 * scrollTop write; the scroll arm is proximity-gated, see
 * PROXIMITY_MARGIN below), and the tick derives the live box
 * arithmetically from the scroll delta — a gBCR inside a rAF tick runs
 * AFTER Lenis's write (its loop registers first) and forces a
 * synchronous layout (3 hero magnets ⇒ 1 forced layout/frame while
 * scrolling — the exact class MODEL-5 eliminated).
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
/** Proximity margin for the scroll-arm refresh guard (AUDIT-C5) — slack
 * added to `radius` when deciding, from the CACHED box alone, whether a
 * scroll event could possibly put the pointer in play for this magnet.
 * Covers the documented stale-box drift between refreshes (reflow
 * travel above the element, ≤ ~24px per the rect-cache note above) plus
 * this magnet's own ±MAX_OFFSET translate. */
const PROXIMITY_MARGIN = 64

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

    // --- rect cache (rune-scene / MODEL-5 pattern) ---------------------
    // Read once per ARM (mount / resize / proximity-gated scroll event,
    // see pointerNearCachedBox below); the tick derives the live
    // viewport box from the scroll delta instead of re-reading gBCR. The
    // capture includes any magnetic translate present at arm time,
    // exactly like a live read would.
    let rectTop = 0
    let rectLeft = 0
    let rectW = 0
    let rectH = 0
    let rectAtY = 0
    let rectAtX = 0
    const refreshRect = () => {
      const r = el.getBoundingClientRect()
      rectTop = r.top
      rectLeft = r.left
      rectW = r.width
      rectH = r.height
      rectAtY = window.scrollY
      rectAtX = window.scrollX
    }
    refreshRect()

    /** Scroll-arm refresh guard (AUDIT-C5 LOW): is the last-known pointer
     * plausibly in this magnet's play zone, judging ONLY from the cached
     * box + the arithmetic live derivation (zero layout reads — the
     * scroll listener must not re-create the 3-gBCR-per-scroll-event
     * always-on cost the rect cache exists to eliminate)? `armed` gates
     * the {0,0} default pointer; offscreen magnets fail naturally
     * because the pointer is viewport-fixed while the derived box
     * scrolls away. Stale-box tolerance: pure scrolling is compensated
     * EXACTLY by the arithmetic below, so the cache only drifts on
     * reflow — bounded, absorbed by PROXIMITY_MARGIN, and self-healing
     * (the cache refreshes on the first proximate scroll / resize /
     * actual magnetization). */
    const pointerNearCachedBox = () => {
      if (!armed) return false
      const left = rectLeft - (window.scrollX - rectAtX)
      const top = rectTop - (window.scrollY - rectAtY)
      const dx = pointer.x - (left + rectW / 2)
      const dy = pointer.y - (top + rectH / 2)
      const gapX = Math.max(0, Math.abs(dx) - rectW / 2)
      const gapY = Math.max(0, Math.abs(dy) - rectH / 2)
      return Math.hypot(gapX, gapY) <= radius + PROXIMITY_MARGIN
    }

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
      // Live box derived from the cache — never a gBCR in here (Lenis
      // writes scrollTop in its own rAF earlier in this same frame).
      const left = rectLeft - (window.scrollX - rectAtX)
      const top = rectTop - (window.scrollY - rectAtY)
      const dx = pointer.x - (left + rectW / 2)
      const dy = pointer.y - (top + rectH / 2)
      // Distance from the pointer to the element's bounds — 0 while
      // inside, growing as it moves beyond the box (direction-agnostic,
      // so RTL/LTR is irrelevant here).
      const gapX = Math.max(0, Math.abs(dx) - rectW / 2)
      const gapY = Math.max(0, Math.abs(dy) - rectH / 2)
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
    // (scrolling can slide the element away from / under the cursor). The
    // scroll arm ALSO refreshes the rect cache — but only when the
    // proximity guard above passes (AUDIT-C5 LOW: a scroll with the
    // pointer far from every magnet costs ZERO layout reads, restoring
    // the pre-rect-cache cost floor while the cache stays exact whenever
    // a magnet is actually in play). Reading in the event phase, before
    // this frame's Lenis write, keeps the tick layout-free. schedule()
    // stays unconditional: the tick itself is layout-free and settles
    // immediately when far — it is what notices an element sliding under
    // a resting pointer.
    const onScrollArm = () => {
      if (pointerNearCachedBox()) refreshRect()
      schedule()
    }
    // Reflow invalidates the rect cache — re-read, then re-check whether
    // the resting pointer now magnetizes.
    const onResize = () => {
      refreshRect()
      schedule()
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScrollArm, { passive: true, capture: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScrollArm, { capture: true })
      window.removeEventListener('resize', onResize)
      // Never leave a stale inline transform/transition behind.
      el.style.transform = ''
      restoreTransition()
    }
  }, [reduced, ref, strength, radius])
}
