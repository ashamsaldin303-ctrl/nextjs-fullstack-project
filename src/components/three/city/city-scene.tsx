'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useMobileTier } from '@/lib/use-mobile-tier'
import { getLenis } from '@/lib/lenis-holder'
import { mountCityScene, type CityEngine, type LandmarkRuntime } from './engine'

/**
 * CITY-1 · React wrapper for the interactive city model engine.
 *
 * Owns the embedded DOM chrome (the authored fixed-position overlay,
 * re-expressed inside the section box, bilingual + logical-direction aware):
 * two sky gradient layers (night opacity driven directly through the
 * engine's night callback — no re-render), the loader overlay, the HUD
 * instrument block, the control buttons (manual / night / tour with the
 * authored inline SVGs), the hint pill (auto-hides after 18s or on
 * selection, like the authored model), the pointer-following tooltip
 * (mouse-only) and the landmark info panel (specs / occupancy / footer in
 * the active locale). All high-frequency updates (HUD text, tooltip
 * transform, night blend) are direct ref writes — React state is reserved
 * for rare toggles (night icon, manual button, selection).
 *
 * MOBILE-FS · Immersive fullscreen mode. The embedded 16:10 box is a fine
 * showcase but a poor cockpit — on phones the city begs for the whole
 * screen. The fullscreen button (first in the control column) expands the
 * scene to a viewport-covering layer:
 *
 *   • MECHANISM — dual-path: the native Fullscreen API is requested when
 *     the environment allows it (top-level windows) AND a CSS immersive
 *     class (`fixed inset-0 z-[70]`) is applied regardless, so embedded
 *     previews (iframes without allowfullscreen) and iOS Safari (no
 *     element-level fullscreen) still get a true fullscreen experience.
 *     z-[70] sits above the navbar (50) / scroll progress (60) and below
 *     the grain film (90) / custom cursor (200) — the site's sensory skin
 *     keeps dressing the fullscreen city.
 *   • CONTAINING-BLOCK SCRUB — `position: fixed` inside the Reveal wrapper
 *     would be trapped (its transform creates a containing block), so
 *     enterImmersive walks the ancestor chain and neutralizes
 *     transform/filter/backdrop-filter/perspective via inline overrides
 *     (restored verbatim on exit).
 *   • CAMERA — the engine widens the vertical FOV on portrait aspects
 *     (see engine.ts onResize) so the wide city never collapses into a
 *     sliver; the ResizeObserver carries the new size to the renderer.
 *   • CONTROLS — manual mode auto-enables while immersive (drag anywhere
 *     to rotate; no page-scroll conflict — the page behind is locked via
 *     body overflow + Lenis stop, the site's single-writer discipline).
 *     Touch-discoverable zoom ± buttons join the column, all buttons grow
 *     to 48px targets, and the column clears the iOS home-indicator safe
 *     area. The previous manual state is restored on exit.
 *   • EXITS — the fullscreen button (now "exit"), Escape (when no landmark
 *     panel is open — Escape with a selection just closes the panel, the
 *     second press leaves fullscreen), and the native fullscreenchange
 *     event (browser UI exits). All paths run through the same idempotent
 *     exitImmersive.
 */

/** Imperative handle (React 19 ref-as-prop; passes through next/dynamic). */
export interface CitySceneHandle {
  /** Keyboard drag equivalent — arrow keys rotate the camera. */
  nudge: (dxPx: number, dyPx: number) => void
  /** Escape-path deselect (the section wrapper also forwards its own). */
  deselect: () => void
}

const SKY_DAY =
  'linear-gradient(180deg, #c9dbe7 0%, #e6ebe2 62%, #eae7db 100%)'
const SKY_NIGHT =
  'linear-gradient(180deg, #060b16 0%, #0b1424 45%, #14213a 75%, #1d2a45 100%)'
/** Instrument face — the authored model's IBM Plex Mono (pulled by the
 * engine's font race), falling back to the site's mono token if the CDN
 * is unreachable. */
const MONO_FONT = "'IBM Plex Mono', var(--font-mono), monospace"

/** Immersive zoom factors — one press ≈ ±20% camera radius. */
const ZOOM_IN_FACTOR = 0.8
const ZOOM_OUT_FACTOR = 1.25

/** Inline style scrubbed from an ancestor while immersive (restored on exit). */
interface SavedAncestor {
  el: HTMLElement
  transform: string
  filter: string
  backdropFilter: string
  perspective: string
}

export function CityScene({
  active,
  ref,
}: {
  active: boolean
  /** Keyboard handle — passes through next/dynamic → React.lazy because
   *  ref is a regular prop in React 19. Optional (omit if unused). */
  ref?: Ref<CitySceneHandle>
}) {
  const t = useTranslations('pages.websites.threeD.city')
  const locale = useLocale()
  const isAr = locale === 'ar'
  // Locale through a ref: the engine callbacks are captured once at mount,
  // so a mid-session locale switch (client navigation) must still resolve
  // the right tooltip language without re-mounting the whole city. Synced
  // post-commit (never during render).
  const localeRef = useRef(locale)
  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  const mobileTier = useMobileTier()

  // ---- engine + DOM refs -------------------------------------------------
  const rootRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<CityEngine | null>(null)
  const skyNightRef = useRef<HTMLDivElement>(null)
  const hudCamRef = useRef<HTMLSpanElement>(null)
  const hudCurRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const tipNameRef = useRef<HTMLSpanElement>(null)
  const occFillRef = useRef<HTMLDivElement>(null)
  const readyTimerRef = useRef<number | null>(null)
  const hintTimerRef = useRef<number | null>(null)

  // ---- rare-toggle state --------------------------------------------------
  const [loaderHidden, setLoaderHidden] = useState(false)
  const [loaderGone, setLoaderGone] = useState(false)
  const [nightOn, setNightOn] = useState(false)
  const [manualOn, setManualOn] = useState(false)
  const [hintOff, setHintOff] = useState(false)
  const [selected, setSelected] = useState<LandmarkRuntime | null>(null)
  // Keeps the last landmark so the panel fades out WITH its content (the
  // authored model kept the last DOM content during the close transition).
  const [panelLm, setPanelLm] = useState<LandmarkRuntime | null>(null)
  // Current hovered node for the tooltip text (ref only — no re-render).
  const hoverRef = useRef<LandmarkRuntime | null>(null)
  // Synchronous selection mirror — the document-level Escape handler must
  // know whether a panel is open NOW (React state updates land a commit
  // later, after the event has already bubbled past every handler).
  const selectedRef = useRef<LandmarkRuntime | null>(null)
  const nightStateRef = useRef(false)

  // ---- immersive fullscreen state -----------------------------------------
  const [immersive, setImmersive] = useState(false)
  // Fade-in for the immersive overlay: the canvas RESIZES discretely when
  // the root swaps to fixed inset-0 (ResizeObserver → renderer.setSize) —
  // animating geometry would tear. A 300ms opacity ramp on the overlay
  // masks the swap with a soft materialize instead of an instant snap.
  // Double-rAF so the opacity-0 start state is committed first (a single
  // rAF can coalesce with the mount paint and skip the transition). The
  // reset lives in exitImmersive (event handler — setState in sync effect
  // bodies is forbidden by the site's react-hooks discipline).
  const [immersiveFaded, setImmersiveFaded] = useState(false)
  useEffect(() => {
    if (!immersive) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setImmersiveFaded(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [immersive])
  // Synchronous mirror (event handlers + idempotency guards must read the
  // value NOW, not after the next commit).
  const immersiveRef = useRef(false)
  // Ancestors whose inline styles were scrubbed for the fixed overlay.
  const savedAncestorsRef = useRef<SavedAncestor[]>([])
  // Manual mode as it was BEFORE immersive auto-enabled it.
  const manualBeforeImmersiveRef = useRef(false)
  // Body overflow inline value captured while locking the page. The
  // '\u0000' sentinel means "not locked" — '' is a legitimate saved value
  // (bodies rarely carry an inline overflow), so it can't be the marker.
  const bodyOverflowRef = useRef('\u0000')

  // ---- immersive enter / exit ----------------------------------------------
  /** Restores everything exitImmersive / unmount must undo. Idempotent. */
  const restorePage = useCallback(() => {
    for (const s of savedAncestorsRef.current) {
      s.el.style.transform = s.transform
      s.el.style.filter = s.filter
      s.el.style.backdropFilter = s.backdropFilter
      s.el.style.perspective = s.perspective
    }
    savedAncestorsRef.current = []
    if (bodyOverflowRef.current !== '\u0000') {
      // Direct body write (outside React's ownership) — intentional: the
      // immersive overlay must lock TOUCH scrolling behind it, and Lenis
      // cannot (syncTouch off → phones keep native momentum; lenis.stop()
      // only locks wheel). This is the same lock Radix applies for its
      // sheets/modals, restored verbatim on exit.
      // eslint-disable-next-line react-compiler/react-compiler
      document.body.style.overflow = bodyOverflowRef.current
      bodyOverflowRef.current = '\u0000'
      getLenis()?.start()
    }
  }, [])

  const enterImmersive = useCallback(() => {
    if (immersiveRef.current) return
    const root = rootRef.current
    if (!root) return
    immersiveRef.current = true

    // 1) Scrub ancestor containing-block/stacking effects (the Reveal
    //    wrapper's transform would otherwise trap position:fixed and hide
    //    the overlay under the navbar's stacking order). Only properties
    //    whose COMPUTED value actually traps are touched; inline originals
    //    are saved and restored verbatim on exit.
    const saved: SavedAncestor[] = []
    let el: HTMLElement | null = root.parentElement
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = window.getComputedStyle(el)
      if (
        cs.transform !== 'none' ||
        cs.filter !== 'none' ||
        cs.backdropFilter !== 'none' ||
        cs.perspective !== 'none'
      ) {
        saved.push({
          el,
          transform: el.style.transform,
          filter: el.style.filter,
          backdropFilter: el.style.backdropFilter,
          perspective: el.style.perspective,
        })
        el.style.transform = 'none'
        el.style.filter = 'none'
        el.style.backdropFilter = 'none'
        el.style.perspective = 'none'
      }
      el = el.parentElement
    }
    savedAncestorsRef.current = saved

    // 2) Manual camera ON — the fullscreen overlay has no page to scroll,
    //    so drag-anywhere rotation is pure gain. Previous state restored
    //    on exit.
    manualBeforeImmersiveRef.current = manualOn
    engineRef.current?.setManual(true)

    // 3) Lock the page behind the overlay (single-writer scroll
    //    discipline: Lenis stop freezes at the real position; body
    //    overflow hidden is the belt to Lenis's braces).
    bodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    getLenis()?.stop()

    // 4) React drives the root's className to the fixed overlay
    //    (fixed inset-0 z-[70]); the engine's ResizeObserver picks the new
    //    size up and adapts renderer + portrait FOV.
    setImmersive(true)

    // 5) Native fullscreen when the environment permits it (top-level
    //    windows). Sandboxed iframes without allowfullscreen reject the
    //    promise and iOS Safari has no element-level API — both simply
    //    keep the CSS immersive path (step 4). Rejections are swallowed:
    //    the CSS overlay IS the guaranteed mechanism.
    const fsRoot = root as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
    }
    try {
      const req: Promise<void> | void = root.requestFullscreen
        ? root.requestFullscreen({ navigationUI: 'hide' })
        : fsRoot.webkitRequestFullscreen
          ? fsRoot.webkitRequestFullscreen()
          : undefined
      if (req && typeof (req as Promise<void>).catch === 'function') {
        void (req as Promise<void>).catch(() => {})
      }
    } catch {
      /* legacy synchronous API errors — CSS immersive already applied */
    }

    // 6) Re-show the hint pill with the immersive gesture guide; it leaves
    //    again after a shorter 6s cadence.
    setHintOff(false)
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => setHintOff(true), 6000)
  }, [manualOn])

  const exitImmersive = useCallback(() => {
    if (!immersiveRef.current) return
    immersiveRef.current = false
    if (document.fullscreenElement) {
      try {
        const p = document.exitFullscreen()
        if (p && typeof p.catch === 'function') void p.catch(() => {})
      } catch {
        /* legacy sync exit — CSS state is restored below regardless */
      }
    }
    restorePage()
    engineRef.current?.setManual(manualBeforeImmersiveRef.current)
    setImmersiveFaded(false) // re-arm the next immersive fade-in
    setImmersive(false)
  }, [restorePage])

  // Native fullscreen exits driven by the BROWSER UI (Esc key, OS back
  // gesture, windowing) — full security-screen hand-backs land here too.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && immersiveRef.current) exitImmersive()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [exitImmersive])

  // Escape while immersive — CAPTURE phase on document, so it runs BEFORE
  // any bubble-phase handler (the section wrapper's own Escape→deselect
  // included). That ordering matters: the wrapper's handler would deselect
  // first, and a bubble-phase document listener would then read
  // selectedRef == null and wrongly leave fullscreen — both on the SAME
  // keystroke. With capture + stopPropagation the semantics are exact and
  // single-shot: panel open → close ONLY the panel (stay fullscreen);
  // otherwise → leave fullscreen. Works wherever focus sits (body, the
  // focusable wrapper, buttons inside the chrome).
  useEffect(() => {
    if (!immersive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !immersiveRef.current) return
      e.preventDefault()
      e.stopPropagation() // this keystroke is owned here — nothing else reacts
      if (selectedRef.current) {
        engineRef.current?.deselect()
      } else {
        exitImmersive()
      }
    }
    document.addEventListener('keydown', onKey, { capture: true })
    return () => document.removeEventListener('keydown', onKey, { capture: true })
  }, [immersive, exitImmersive])

  // ---- mount / unmount ----------------------------------------------------
  // Initial tier/visibility snapshots for the mount-once engine bootstrap —
  // live prop changes flow through the imperative wiring below
  // (setActive / setMobile), never through re-mounting the whole city.
  const initialActiveRef = useRef(active)
  const initialMobileRef = useRef(mobileTier)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const engine = mountCityScene(mount, {
      mobile: initialMobileRef.current,
      active: initialActiveRef.current,
      callbacks: {
        onReady: () => {
          // authored cadence: the loader fades ~700ms after the build, then
          // unmounts once the 800ms fade has fully played out
          readyTimerRef.current = window.setTimeout(() => {
            setLoaderHidden(true)
            readyTimerRef.current = window.setTimeout(() => setLoaderGone(true), 850)
          }, 700)
          // authored behavior: the hint pill leaves 18s after the scene is
          // live (not after component mount — the build can take ~2s)
          hintTimerRef.current = window.setTimeout(() => setHintOff(true), 18000)
        },
        onSelect: (lm) => {
          selectedRef.current = lm
          setSelected(lm)
          if (lm) {
            setPanelLm(lm)
            setHintOff(true)
          }
        },
        onHover: (lm, x, y) => {
          const tip = tipRef.current
          if (!tip) return
          // authored offset: +16px right / −52px up from the pointer
          tip.style.transform = `translate(${x + 16}px, ${y - 52}px)`
          if (lm !== hoverRef.current) {
            hoverRef.current = lm
            if (lm && tipNameRef.current) {
              tipNameRef.current.textContent = localeRef.current === 'ar' ? lm.name : lm.en.name
            }
            tip.style.opacity = lm ? '1' : '0'
          }
        },
        onHud: (camText, curText) => {
          if (hudCamRef.current) hudCamRef.current.textContent = camText
          if (hudCurRef.current) hudCurRef.current.textContent = curText
        },
        onNight: (blend, isNight) => {
          if (skyNightRef.current) skyNightRef.current.style.opacity = String(blend)
          if (nightStateRef.current !== isNight) {
            nightStateRef.current = isNight
            setNightOn(isNight)
          }
        },
        onManual: (on) => setManualOn(on),
      },
    })
    engineRef.current = engine
    return () => {
      if (readyTimerRef.current !== null) window.clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
      // Route change / unmount while immersive: the fixed overlay is about
      // to vanish with the canvas — restore the page's scroll + ancestor
      // styles first so the underlying document is never left locked.
      if (immersiveRef.current) {
        immersiveRef.current = false
        restorePage()
      }
      engine.dispose()
      engineRef.current = null
    }
  }, [restorePage])

  // ---- live prop wiring ----------------------------------------------------
  // While immersive the render loop stays alive even if the (now empty)
  // embedded box happens to leave the viewport — the fullscreen canvas IS
  // the content the visitor is watching.
  useEffect(() => {
    engineRef.current?.setActive(active || immersive)
  }, [active, immersive])
  useEffect(() => {
    engineRef.current?.setMobile(mobileTier)
  }, [mobileTier])

  // Locale switch: refresh the tooltip text for the currently hovered node.
  useEffect(() => {
    const lm = hoverRef.current
    if (lm && tipNameRef.current) {
      tipNameRef.current.textContent = isAr ? lm.name : lm.en.name
    }
  }, [isAr])

  // Occupancy bar animation (authored: reset to 0%, then fill after 60ms).
  // F-S7-03 (audit r2): the fill now grows via the CSS `scale` property
  // (scaleX — origin at the logical start edge: origin-left /
  // rtl:origin-right in the JSX) instead of animating `width` (a layout
  // property) over 600ms with an undeclared 5th easing curve; duration +
  // curve are the site canon (300ms + the global expo ease). The JSX's
  // scale-x-0 class is the pre-effect initial state; these inline writes
  // take over from the first selection frame.
  useEffect(() => {
    const fill = occFillRef.current
    if (!fill || !selected || selected.occ === undefined) return
    fill.style.scale = '0 1'
    const occ = selected.occ
    const id = window.setTimeout(() => {
      fill.style.scale = `${(occ / 100).toFixed(4)} 1`
    }, 60)
    return () => window.clearTimeout(id)
  }, [selected])

  // ---- imperative handle ----------------------------------------------------
  const nudge = useCallback((dxPx: number, dyPx: number) => {
    engineRef.current?.nudge(dxPx, dyPx)
  }, [])
  const deselect = useCallback(() => {
    engineRef.current?.deselect()
  }, [])
  useImperativeHandle(ref, () => ({ nudge, deselect }), [nudge, deselect])

  // ---- keyboard (focus inside the chrome / fullscreen) ----------------------
  // Escape while NOT immersive → deselect (same as before). While IMMERSIVE
  // the document-level CAPTURE listener above owns every Escape (it stops
  // propagation before this handler can run), so nothing to do here.
  // Arrow keys rotate through the same ±16px mapping as the wrapper —
  // immersive-only (stopPropagation so the wrapper's own arrow handler
  // never double-applies while focus is inside the chrome).
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        if (!immersiveRef.current) deselect()
        return
      }
      if (!immersiveRef.current) return
      const step = 16
      switch (e.key) {
        case 'ArrowLeft':
          engineRef.current?.nudge(-step, 0)
          break
        case 'ArrowRight':
          engineRef.current?.nudge(step, 0)
          break
        case 'ArrowUp':
          engineRef.current?.nudge(0, -step)
          break
        case 'ArrowDown':
          engineRef.current?.nudge(0, step)
          break
        default:
          return
      }
      e.stopPropagation()
      e.preventDefault()
    },
    [deselect]
  )

  // ---- panel content (last landmark keeps content during fade-out) --------
  const panelName = panelLm ? (isAr ? panelLm.name : panelLm.en.name) : ''
  const panelCat = panelLm ? (isAr ? panelLm.cat : panelLm.en.cat) : ''
  const panelDesc = panelLm ? (isAr ? panelLm.desc : panelLm.en.desc) : ''
  const panelSpecs = panelLm ? (isAr ? panelLm.specs : panelLm.en.specs) : []
  const panelOccLab = panelLm
    ? isAr
      ? panelLm.occLab ?? t('occDefault')
      : panelLm.en.occLab ?? t('occDefault')
    : t('occDefault')

  // HUD + authored title block: both are end-corner chrome that crowds the
  // control column inside the small embedded mobile box — shown there only
  // when the box is NOT a cramped phone viewport, but ALWAYS once immersive
  // (the whole screen is the instrument panel then).
  const showInstruments = !mobileTier || immersive

  // Control column geometry: 48px touch targets + iOS home-indicator safe
  // area while immersive; the authored 40px targets in the embedded box.
  const btnBase = immersive
    ? 'grid size-12 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 hover:scale-[1.06] active:scale-95'
    : 'grid size-10 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 hover:scale-[1.06] active:scale-95'
  const btnIdle = 'border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.85)] text-[#e0912f] hover:bg-[rgba(40,55,70,0.95)]'
  const btnOn =
    'border-[#e0912f] bg-[rgba(224,145,47,0.25)] text-[#ffc069]'

  return (
    <div
      ref={rootRef}
      className={
        immersive
          ? 'fixed inset-0 z-[70] select-none transition-opacity duration-300 ease-out motion-reduce:transition-none' +
            (immersiveFaded ? ' opacity-100' : ' opacity-0')
          : 'absolute inset-0 select-none'
      }
      onKeyDown={onKeyDown}
    >
      {/* sky layers — night opacity written directly by the engine callback */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: SKY_DAY }}
      />
      <div
        ref={skyNightRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: SKY_NIGHT, opacity: 0 }}
      />

      {/* engine canvas mounts here (above sky, below chrome) */}
      <div ref={mountRef} className="absolute inset-0 z-10" />

      {/* HUD instrument block — mono, LTR, physical-left in AR / right in EN */}
      {showInstruments ? (
        <div
          dir="ltr"
          style={{ fontFamily: MONO_FONT }}
          className="pointer-events-none absolute end-4 top-4 z-20 border border-white/15 bg-[rgba(17,25,33,0.72)] px-3 py-2 text-left font-mono text-[11px] leading-[1.8] text-[#cfd8de]"
        >
          <div>
            <span className="text-[#e0912f]/90">{t('hudCam')}</span>{' '}
            <span ref={hudCamRef}>000° · ALT 000M</span>
          </div>
          <div>
            <span className="text-[#e0912f]/90">{t('hudCur')}</span>{' '}
            <span ref={hudCurRef}>X+000 · Z+000</span>
          </div>
        </div>
      ) : null}

      {/* control buttons — physical-left column in AR / right in EN.
          MOBILE-FS order: fullscreen (expand/exit) · zoom ± (immersive only,
          touch-discoverable) · manual · night · tour. */}
      <div
        className={
          immersive
            ? 'absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] end-4 z-30 flex flex-col gap-2.5'
            : 'absolute bottom-5 end-4 z-30 flex flex-col gap-2'
        }
      >
        {/* fullscreen / exit fullscreen */}
        <button
          type="button"
          title={immersive ? t('exitFullscreen') : t('fullscreen')}
          aria-label={immersive ? t('exitFullscreen') : t('fullscreen')}
          aria-pressed={immersive}
          onClick={immersive ? exitImmersive : enterImmersive}
          className={`${btnBase} ${btnIdle}`}
        >
          {immersive ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          )}
        </button>

        {/* zoom ± — immersive only (pinch stays available; buttons make
            single-finger zoom discoverable on touch) */}
        {immersive ? (
          <>
            <button
              type="button"
              title={t('zoomIn')}
              aria-label={t('zoomIn')}
              onClick={() => engineRef.current?.zoomBy(ZOOM_IN_FACTOR)}
              className={`${btnBase} ${btnIdle}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </button>
            <button
              type="button"
              title={t('zoomOut')}
              aria-label={t('zoomOut')}
              onClick={() => engineRef.current?.zoomBy(ZOOM_OUT_FACTOR)}
              className={`${btnBase} ${btnIdle}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6" />
              </svg>
            </button>
          </>
        ) : null}

        {/* manual camera control (authored move-cross icon) */}
        <button
          type="button"
          title={t('manual')}
          aria-label={t('manual')}
          aria-pressed={manualOn}
          onClick={() => engineRef.current?.toggleManual()}
          className={`${btnBase} ${manualOn ? btnOn : btnIdle}`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" />
          </svg>
        </button>

        {/* night / day (authored moon↔sun swap) */}
        <button
          type="button"
          title={t('night')}
          aria-label={t('night')}
          aria-pressed={nightOn}
          onClick={() => engineRef.current?.toggleNight()}
          className={`${btnBase} ${nightOn ? btnOn : btnIdle}`}
        >
          {nightOn ? (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </button>

        {/* cinematic tour replay (authored rotate-ccw icon) */}
        <button
          type="button"
          title={t('tour')}
          aria-label={t('tour')}
          onClick={() => engineRef.current?.replayTour()}
          className={`${btnBase} ${btnIdle}`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 12a9 9 0 1 0 2.6-6.4" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      </div>

      {/* corner title block (authored badge; hidden in the cramped embedded
          mobile box, shown from sm up + always while immersive) */}
      {showInstruments ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 start-4 z-20 border border-[rgba(224,145,47,0.35)] bg-[rgba(17,25,33,0.78)] px-3.5 py-[9px] text-[11px] leading-[1.9] text-[#dfe6ea]"
        >
          {t('title')}
          <span
            dir="ltr"
            style={{ fontFamily: MONO_FONT }}
            className="block text-left font-mono text-[9.5px] tracking-[1px] text-[#8b98a3]"
          >
            {t('titleMono')}
          </span>
        </div>
      ) : null}

      {/* hint pill — authored behavior: leaves 18s after readiness / on
          selection; MOBILE-FS: re-shows with the immersive gesture guide
          for 6s whenever fullscreen is entered. Mobile max-width keeps the
          pill clear of the (now four-button) control column. */}
      <div
        className={`pointer-events-none absolute bottom-7 left-1/2 z-20 flex max-w-[calc(100%-130px)] items-center gap-2.5 whitespace-nowrap border border-[rgba(224,145,47,0.4)] bg-[rgba(17,25,33,0.85)] px-[18px] py-2.5 text-[13px] text-[#e8edf1] transition-[opacity,transform] duration-700 ease-in-out sm:max-w-[92%] ${
          hintOff ? '-translate-x-1/2 translate-y-4 opacity-0' : '-translate-x-1/2 translate-y-0 opacity-100'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-[#e0912f]"
        >
          {immersive ? (
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          ) : (
            <path d="M4 4l7 16 2.5-6.5L20 11z" />
          )}
        </svg>
        <span className="truncate">{immersive ? t('hintImmersive') : t('hint')}</span>
        {immersive ? null : (
          <span
            dir="ltr"
            style={{ fontFamily: MONO_FONT }}
            className="shrink-0 border border-[rgba(224,145,47,0.4)] px-1.5 py-0.5 font-mono text-[10px] text-[#e0912f]"
          >
            {t('nodes')}
          </span>
        )}
      </div>

      {/* pointer-following tooltip (mouse-only; engine passes null on touch) */}
      <div
        ref={tipRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-40 whitespace-nowrap border border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.9)] px-3 py-1.5 text-[12.5px] font-semibold text-[#f2f5f7] opacity-0 transition-opacity duration-[180ms] ease-out"
      >
        <span ref={tipNameRef} />
        <small className="block text-[10px] font-light text-[#aeb9c2]">{t('tipHint')}</small>
      </div>

      {/* landmark info panel — slides in from the reading-start side */}
      <aside
        role="region"
        aria-label={panelName || undefined}
        className={`absolute top-1/2 z-40 w-[320px] max-w-[85%] -translate-y-1/2 border border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.88)] text-[#e8edf1] shadow-[0_18px_42px_rgba(8,16,24,0.4)] backdrop-blur-[10px] transition-[opacity,transform] duration-[450ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] ${
          selected
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : 'pointer-events-none opacity-0 ltr:-translate-x-5 rtl:translate-x-5'
        } start-4`}
      >
        <div className="relative flex items-center gap-3 pb-2.5 ps-3.5 pe-10 pt-3.5">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
            className="shrink-0 text-[#e0912f]"
          >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <div className="text-[17px] font-bold text-white">{panelName}</div>
          <button
            type="button"
            title={t('close')}
            aria-label={t('close')}
            onClick={deselect}
            className="absolute end-2.5 top-2.5 grid size-[27px] place-items-center rounded-full border border-[rgba(224,145,47,0.5)] text-[#e0912f] transition-[background-color,transform] duration-200 hover:rotate-90 hover:bg-[rgba(224,145,47,0.18)]"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="ms-[34px] pb-2.5 ps-3.5 pe-3.5 text-[11.5px] text-[#aeb9c2]">{panelCat}</div>
        <div
          aria-hidden="true"
          className="mx-3.5 h-[7px] border-y border-[rgba(224,145,47,0.35)] [background-image:repeating-linear-gradient(-45deg,rgba(224,145,47,0.55)_0_1px,transparent_1px_5px)]"
        />
        <div className="px-3.5 pb-1 pt-2.5">
          {panelSpecs.map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline justify-between border-b border-dashed border-white/[0.12] py-[7px] text-[12.5px] last:border-b-0"
            >
              <span className="font-light text-[#aeb9c2]">{k}</span>
              <span style={{ fontFamily: MONO_FONT }} className="font-mono text-[12px] text-[#f0c887]">
                {v}
              </span>
            </div>
          ))}
        </div>
        {panelLm && panelLm.occ !== undefined ? (
          <div className="px-3.5 pb-0.5 pt-1.5">
            <div className="flex justify-between text-[11.5px] text-[#aeb9c2]">
              <span>{panelOccLab}</span>
              <span style={{ fontFamily: MONO_FONT }} className="font-mono text-[#f0c887]">
                {panelLm.occ}%
              </span>
            </div>
            <div className="relative mt-1.5 h-[11px] border border-white/20 bg-white/[0.06]">
              <div
                ref={occFillRef}
                className="absolute inset-y-[1px] start-[1px] end-[1px] origin-left scale-x-0 rtl:origin-right [background-image:repeating-linear-gradient(-45deg,rgba(224,145,47,0.8)_0_1px,transparent_1px_4px)] transition-[width] duration-[600ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
              />
            </div>
          </div>
        ) : null}
        <div className="px-3.5 pb-3.5 pt-2.5 text-[12px] font-light leading-[1.9] text-[#cfd8de]">
          {panelDesc}
        </div>
        {panelLm ? (
          <div
            dir="ltr"
            style={{ fontFamily: MONO_FONT }}
            className="border-t border-dashed border-white/[0.14] px-3.5 py-2 text-left font-mono text-[9px] tracking-[1px] text-[#8b98a3]"
          >
            {t('foot', { code: panelLm.code, sector: panelLm.sector })}
          </div>
        ) : null}
      </aside>

      {/* loader overlay — fades ~700ms after engine readiness, unmounts
          once the 800ms fade has fully played out (authored #loader.hidden) */}
      {loaderGone ? null : (
        <div
          className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#e9ece4] transition-opacity duration-[800ms] ease-in-out ${
            loaderHidden ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <div className="mb-[15px] size-10 animate-spin rounded-full border-2 border-[rgba(60,70,80,0.15)] border-t-[#c0721c]" />
          <div className="text-[13px] font-semibold tracking-[2px] text-[#3a4450]">{t('loader')}</div>
        </div>
      )}
    </div>
  )
}
