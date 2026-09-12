'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { onScrollEvent } from '@/lib/scroll-store'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { useMobileTier } from '@/lib/use-mobile-tier'
import { probeWebGL } from '@/lib/use-webgl'
import { pokeRuneField } from './rune-bus'
import { runeDirForPath, runePresetKeyForPath, type RunePresetKey } from './model-registry'

/**
 * Rune Landmarks root (RUNE-3) — the full-viewport semantic layer
 * mounted ONCE in [locale]/layout. This root is the GATEKEEPER and the
 * SCROLL HEARTBEAT: it stays out of the three.js chunk boundary entirely
 * (only hooks + next/dynamic + the tiny rune-bus + the pure-TS landmark
 * registry here) and translates every DOM scroll event into (a)
 * scroll-clock advancement (scroll-store) and (b) a poke on the
 * invalidate bus, which is what makes the scene's frameloop="demand"
 * render frames while — and only while — the page is being scrolled.
 *
 * Gates (unchanged product decisions from RUNE-1, MOBILE-2 amendment):
 * 1. prefers-reduced-motion → NOTHING mounts (pure decor; reduced-motion
 *    users lose zero function).
 * 2. Tier (useMobileTier: <768px / coarse pointer):
 *    · DESKTOP ('field') — the full roaming choreography, unchanged.
 *    · MOBILE ('hero', MOBILE-1 plan د) — the guarded «hero signature»
 *      tier: ONE small centered body per page (the page's own kit,
 *      semantic parity with the PC tier) composed in the hero's lower
 *      whitespace band, no edge journey, inert pointer layer, capped
 *      dpr, and an FPS watchdog — a renderer that cannot hold
 *      <24fps across a 3s rolling window is PERMANENTLY faded out for
 *      the session (sessionStorage flag) back to the IA atmosphere.
 *      Real phones run hardware GL and the kits are low-poly; only
 *      pathological renderers (software GL) lose the tier.
 * 3. requestIdleCallback (2.5s timeout fallback) before the three.js
 *    chunk is even fetched — LCP-neutral (a session already flagged by
 *    the watchdog never fetches the chunk for the mobile tier at all).
 * 4. probeWebGL() (module-memoized, rAF-deferred) → hide entirely.
 * 5. document visibilitychange → frameloop 'never' while hidden; on
 *    return-to-visible the bus is poked so the field repaints.
 *
 * Stacking: z-[5] fixed inset-0 — the semantic bodies float in the
 * sections' free margins ABOVE section content (translucent,
 * pointer-events-none), below the navbar (50), scroll progress (60),
 * intro curtain (80), grain (90) and cursor (200). pointer-events none +
 * aria-hidden: pure decoration, clicks always fall through (G8). The
 * landmarks' anchors are LOGICAL ('start'/'end') and resolve against
 * the active writing direction, so AR and EN mirror each other
 * correctly without rebuilding anything.
 *
 * MOBILE-2 side-channel: while the mobile hero tier is LIVE the root
 * sets `document.documentElement.dataset.runeMobile = '1'` (with full
 * effect cleanup) — the inner heroes' CSS reads it to open the ~120px
 * mobile-only bottom breathing room the signature body composes into
 * (see globals.css). Reduced-motion and degraded sessions never set
 * the attribute, so they keep the original rhythm.
 */

const RuneScene = dynamic(() => import('./rune-scene').then((m) => m.RuneScene), {
  ssr: false,
})

/** MOBILE-2: the sessionStorage key the hero tier's fps watchdog sets —
 *  a session-permanent «this renderer cannot hold the mobile tier» mark
 *  (SwiftShader-class software GL). Guarded everywhere: private-mode
 *  browsers can throw on storage access. */
const RUNE_MOBILE_DEGRADED_KEY = 'elyra.runeMobileDegraded'

function readRuneMobileDegraded(): boolean {
  try {
    return sessionStorage.getItem(RUNE_MOBILE_DEGRADED_KEY) === '1'
  } catch {
    // Private mode / storage disabled — do not punish the visitor for
    // the browser's storage policy: treat the session as not degraded.
    return false
  }
}

export function EdgeRune() {
  const reduced = usePrefersReducedMotion()
  const mobileTier = useMobileTier()
  const pathname = usePathname() ?? '/'

  // MOBILE-2 — session-permanent degradation state (mobile tier only).
  // Read rAF-deferred post-hydration (the probeWebGL pattern: a state
  // flip never happens synchronously inside the effect body —
  // hydration-safe + lint-compliant): EdgeRune is server-rendered as
  // part of the layout, so the first paint must stay storage-free. The
  // idle gate below ALSO re-checks the flag synchronously before arming,
  // so a degraded session never even fetches the three.js chunk.
  const [mobileDegraded, setMobileDegraded] = useState(false)
  useEffect(() => {
    if (!mobileTier) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (!cancelled && readRuneMobileDegraded()) setMobileDegraded(true)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [mobileTier])

  // Idle-load gate — the three.js chunk is fetched only after the
  // browser is idle (hero.tsx pattern). Re-arms if a gated tier flips
  // back off. MOBILE-2: the gate now arms for BOTH tiers (the mobile
  // hero tier mounts too); a session already degraded by the fps
  // watchdog returns early — the chunk is never fetched for a dead tier.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (reduced) return
    if (mobileTier && readRuneMobileDegraded()) return
    let started = false
    const start = () => {
      if (!started) {
        started = true
        setReady(true)
      }
    }
    let cancel: (() => void) | undefined
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2500 })
      cancel = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(start, 1500)
      cancel = () => window.clearTimeout(id)
    }
    return () => {
      cancel?.()
    }
  }, [reduced, mobileTier])

  // Scroll heartbeat — attached whenever a tier MAY mount (reduced-
  // motion still excluded). MOBILE-2: the mobile hero tier needs the
  // pokes too — its presence envelope still depends on the hero
  // section's travel, and the scroll clocks still drive the per-part
  // odometer drives. When no scene is registered on the bus the poke is
  // a no-op, so a degraded session keeps this listener harmlessly.
  useEffect(() => {
    if (reduced) return
    const onScroll = () => {
      onScrollEvent()
      pokeRuneField()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  // WebGL probe — module-memoized probeWebGL(), rAF-deferred so the state
  // flip never happens synchronously inside the effect body
  // (hydration-safe + lint-compliant; the same pattern the websites 3D
  // section uses).
  const [glOk, setGlOk] = useState(true)
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      if (!probeWebGL()) setGlOk(false)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [ready])

  // Tab-visibility gate → the Canvas frameloop ('never' while hidden);
  // returning to visible pokes the bus so the frozen field repaints.
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const onVis = () => {
      const nowVisible = !document.hidden
      setVisible(nowVisible)
      if (nowVisible) pokeRuneField()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Mount fade-in — one rAF after the scene mounts, the layer eases from
  // transparent to full presence (700ms), so a direct landing or a route
  // morph never flashes an unblended composition.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!ready || !glOk) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [ready, glOk])

  // MOBILE-2 — while the mobile hero tier is LIVE, mark the root
  // element: the inner page heroes' CSS (globals.css) reads
  // html[data-rune-mobile] to open their lower signature band. Never
  // set for the desktop field, reduced-motion, or a degraded session;
  // the cleanup deletes the attribute on every one of those exits.
  const heroTierLive = mobileTier && !mobileDegraded && !reduced && ready && glOk
  useEffect(() => {
    if (!heroTierLive) return
    document.documentElement.dataset.runeMobile = '1'
    return () => {
      delete document.documentElement.dataset.runeMobile
    }
  }, [heroTierLive])

  // MOBILE-2 — the scene's fps-watchdog callback: mark the session
  // (storage failures degrade to the in-memory flag: the layer still
  // unmounts for this page view) and flip the state that unmounts the
  // mobile tier for the rest of the session. The IA atmosphere (CSS/DOM
  // layers) remains — «permanent session fade-out to the atmosphere».
  const onMobileDegrade = useCallback(() => {
    try {
      sessionStorage.setItem(RUNE_MOBILE_DEGRADED_KEY, '1')
    } catch {
      // Private mode — the in-memory flag below still unmounts now.
    }
    setMobileDegraded(true)
  }, [])

  if (reduced || !ready || !glOk) return null
  // MOBILE-2: a session the fps watchdog condemned never re-mounts the
  // mobile tier (the desktop field is unaffected by this flag).
  if (mobileTier && mobileDegraded) return null

  const presetKey: RunePresetKey = runePresetKeyForPath(pathname)
  const dir = runeDirForPath(pathname)

  return (
    <div
      aria-hidden="true"
      data-elyra-rune-field=""
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{
        opacity: shown ? 1 : 0,
        transition: 'opacity 700ms ease-out',
      }}
    >
      {/* MOBILE-2: the tier keys the scene — crossing the 768px boundary
          (or a coarse-pointer flip) remounts the Canvas with the other
          tier's dpr/slot-set cleanly instead of morphing one into the
          other. Desktop renders the roaming field exactly as before. */}
      <RuneScene
        key={mobileTier ? 'hero' : 'field'}
        active={visible}
        presetKey={presetKey}
        dir={dir}
        tier={mobileTier ? 'hero' : 'field'}
        onDegenerate={mobileTier ? onMobileDegrade : undefined}
      />
    </div>
  )
}
