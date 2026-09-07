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
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { getLenis, setLenis } from '@/lib/lenis-holder'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/** Lerp factor — 0.10 ≈ ~130ms of glide tail: perceptibly smooth on a
 *  trackpad fling yet short enough that scroll-linked choreography
 *  (scrub/velocity) never feels detached from the finger. */
const LERP = 0.1
/** Anchor offset — fixed navbar height so hash targets land clear of it. */
const ANCHOR_OFFSET = -96

export function SmoothScroll() {
  const reduced = usePrefersReducedMotion()
  const pathname = usePathname()

  useEffect(() => {
    if (reduced) return

    const lenis = new Lenis({
      lerp: LERP,
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
