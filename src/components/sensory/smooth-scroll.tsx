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
 *   native behavior the teleport guard in scroll-store expects. The
 *   ONE exception is the initial mount of a #hash deep-link (AUDIT-C3):
 *   the browser has already natively scrolled a cold load of e.g.
 *   /services/websites#calculator to the SSR'd anchor before hydration,
 *   so that first run re-applies the anchor through Lenis instead of
 *   yanking the visitor to top.
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

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { getLenis, lenisScrollTo, setLenis } from '@/lib/lenis-holder'
import { expectTeleport } from '@/lib/scroll-store'
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
  // Effect-run discriminator for the cold-load hash branch below: null
  // before the first run; afterwards the last (pathname, reduced) key
  // this effect has seen. A re-run with the SAME key is a re-play of the
  // initial run (reactStrictMode dev double-mount) — it must take the
  // same hash branch, or the simulated remount would re-introduce the
  // top-yank this fix removes. Any key CHANGE is a real navigation (or
  // a reduced-motion flip) and keeps the reset semantics exactly.
  const prevRunKey = useRef<string | null>(null)

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
  // rune morph handles the route fade separately — see rune-scene).
  // `reduced` in deps is inert: flipping it destroys/creates the instance
  // above first.
  useEffect(() => {
    const lenis = getLenis()
    const runKey = `${pathname}::${reduced}`
    const initialRun =
      prevRunKey.current === null || prevRunKey.current === runKey
    prevRunKey.current = runKey

    // Cold-load #hash deep-links (AUDIT-C3 LOW): the browser natively
    // scrolled the SSR'd anchor into view BEFORE hydration; Lenis's
    // `anchors` option is click-only (lenis.mjs:541-556 — no
    // location.hash handling), so without this branch the initial run
    // of this effect would yank those visitors to top. Instead the
    // anchor is re-applied through the ONE scroll writer (Lenis) with
    // the same −96 navbar offset as the anchors click path. The write
    // is immediate (a hash JUMP, not a glide — no motion introduced on
    // load) and declared teleport-class BEFORE it fires so the rune
    // clocks never read the jump as a gesture (lenisScrollTo's
    // immediate path re-arms the same flag — see lenis-holder).
    // Lenis absent (reduced motion / instance not ready): leave the
    // browser's native anchor position UNTOUCHED.
    if (initialRun && window.location.hash) {
      if (lenis) {
        expectTeleport()
        lenisScrollTo(window.location.hash, {
          offset: ANCHOR_OFFSET,
          immediate: true,
        })
      }
      return
    }

    if (lenis) {
      // AUDIT-A3 (FIX 1): declare the jump BEFORE the write. Sub-900px
      // navigation resets (route change / back-forward restore / locale
      // restore) used to slip past scroll-store's TELEPORT magnitude
      // guard and inject a fake upward gesture into the clocks (~350ms
      // glow flash + rune phase drift per navigation). Next's restore
      // and this write land in the same task, so the browser coalesces
      // them into one scroll event the flag then swallows.
      expectTeleport()
      lenis.scrollTo(0, { immediate: true, force: true })
    }
  }, [pathname, reduced])

  return null
}
