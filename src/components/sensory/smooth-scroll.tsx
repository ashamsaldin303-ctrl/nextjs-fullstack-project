'use client'

/**
 * SmoothScroll (REF-2 Phase A) — the Lenis layer that turns the site's
 * native wheel steps into the buttered continuous glide every
 * award-winning reference has (illoca, aardvark — see REF-1 analysis).
 *
 * Mount ONCE in [locale]/layout (this component renders nothing).
 *
 * Behaviour:
 * · prefers-reduced-motion → NOTHING initialises (native scroll, zero
 *   JS, the user asked for less motion and gets exactly that).
 * · Touch stays native (Lenis `syncTouch` is off by default — phones
 *   keep their tuned momentum; only wheel/trackpad is smoothed).
 * · `autoRaf` runs Lenis's own rAF heartbeat; when momentum drains the
 *   scroll events simply stop firing, so the rune field freezes exactly
 *   as before (scroll-is-time contract untouched).
 * · `anchors: true` routes every hash link (#main, section anchors)
 *   through the smooth glide with the navbar offset applied.
 * · Route-change hygiene: on pathname change the window is returned to
 *   the top IMMEDIATELY (immediate: true — a glide on fresh content
 *   would feel like fighting the navigation), matching the previous
 *   native behavior the teleport guard in scroll-store expects.
 * · The lenis instance is registered in lib/lenis-holder so imperative
 *   consumers never import the chunk.
 *
 * SCROLL-FIX (owner-reported «تسريع مفاجئ»): the previous `lerp: 0.1`
 * mode chases the target with a velocity PROPORTIONAL TO THE GAP
 * (v = λ·gap ⇒ exponential chase) and settles only asymptotically —
 * a long fling or a stalled main thread (heavy 3D frame) let the gap
 * accumulate, then the page LEAPT to catch up: the classic sudden-
 * acceleration feel. Duration mode replaces it with a BOUNDED tween:
 * every impulse lands in exactly DURATION seconds through a cubic-out
 * ease — soft start (peak velocity ≈ 88% of input rate, simulated in
 * the MODEL-5 session), monotone deceleration to an exact landing, and
 * a hard tail bound (no asymptotic glide-away after the finger stops).
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { getLenis, setLenis } from '@/lib/lenis-holder'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/** Glide duration (s) — the hard tail bound: every wheel impulse lands
 *  in exactly this long. 0.8s ≈ award-site butter while staying attached
 *  to the finger (a 500px fling peaks at ~440px/s then decelerates).
 *  This replaces the old lerp chase — see the header's SCROLL-FIX note. */
const DURATION = 0.8
/** Cubic-out ease — soft start (never a velocity step at t=0), monotone
 *  deceleration, lands at exactly 100% with zero slope (no snap). */
const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3)
/** Anchor offset — fixed navbar height so hash targets land clear of it. */
const ANCHOR_OFFSET = -96

export function SmoothScroll() {
  const reduced = usePrefersReducedMotion()
  const pathname = usePathname()

  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({
      duration: DURATION,
      easing: EASE_OUT_CUBIC,
      autoRaf: true,
      anchors: { offset: ANCHOR_OFFSET },
      // Touch devices keep native momentum (default syncTouch: false).
      overscroll: true,
    })
    setLenis(lenis)

    return () => {
      setLenis(null)
      lenis.destroy()
    }
  }, [reduced])

  // Route change → instant scroll reset (previous native behaviour; the
  // scroll-store teleport guard ignores the jump, the rune morph handles
  // the route fade separately — see rune-scene). `reduced` in deps is
  // inert: flipping it destroys/creates the instance above first.
  useEffect(() => {
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
  }, [pathname, reduced])

  return null
}
