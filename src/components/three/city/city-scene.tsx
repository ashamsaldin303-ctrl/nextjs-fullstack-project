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
import { mountCityScene, type CityEngine, type LandmarkRuntime } from './engine'

/**
 * CITY-1 · React wrapper for the interactive city model engine.
 *
 * Owns the embedded DOM chrome (the authored fixed-position overlay,
 * re-expressed inside the section box, bilingual + logical-direction aware):
 * two sky gradient layers (night opacity driven directly through the
 * engine's night callback — no re-render), the loader overlay, the HUD
 * instrument block, the three control buttons (manual / night / tour with
 * the authored inline SVGs), the hint pill (auto-hides after 18s or on
 * selection, like the authored model), the pointer-following tooltip
 * (mouse-only) and the landmark info panel (specs / occupancy / footer in
 * the active locale). All high-frequency updates (HUD text, tooltip
 * transform, night blend) are direct ref writes — React state is reserved
 * for rare toggles (night icon, manual button, selection).
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
  const nightStateRef = useRef(false)

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
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  // ---- live prop wiring ----------------------------------------------------
  useEffect(() => {
    engineRef.current?.setActive(active)
  }, [active])
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
  useEffect(() => {
    const fill = occFillRef.current
    if (!fill || !selected || selected.occ === undefined) return
    fill.style.width = '0%'
    const id = window.setTimeout(() => {
      fill.style.width = `${selected.occ}%`
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

  // Escape while focus sits inside the city chrome (buttons / panel) — the
  // section wrapper handles the focused-wrapper case through the handle.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') deselect()
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

  return (
    <div ref={rootRef} className="absolute inset-0 select-none" onKeyDown={onKeyDown}>
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

      {/* control buttons — physical-left column in AR / right in EN */}
      <div className="absolute bottom-5 end-4 z-30 flex flex-col gap-2">
        <button
          type="button"
          title={t('manual')}
          aria-label={t('manual')}
          aria-pressed={manualOn}
          onClick={() => engineRef.current?.toggleManual()}
          className={`grid size-10 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 hover:scale-[1.06] active:scale-95 ${
            manualOn
              ? 'border-[#e0912f] bg-[rgba(224,145,47,0.25)] text-[#ffc069]'
              : 'border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.85)] text-[#e0912f] hover:bg-[rgba(40,55,70,0.95)]'
          }`}
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
        <button
          type="button"
          title={t('night')}
          aria-label={t('night')}
          aria-pressed={nightOn}
          onClick={() => engineRef.current?.toggleNight()}
          className={`grid size-10 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-200 hover:scale-[1.06] active:scale-95 ${
            nightOn
              ? 'border-[#e0912f] bg-[rgba(224,145,47,0.25)] text-[#ffc069]'
              : 'border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.85)] text-[#e0912f] hover:bg-[rgba(40,55,70,0.95)]'
          }`}
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
        <button
          type="button"
          title={t('tour')}
          aria-label={t('tour')}
          onClick={() => engineRef.current?.replayTour()}
          className="grid size-10 place-items-center rounded-full border border-[rgba(224,145,47,0.5)] bg-[rgba(17,25,33,0.85)] text-[#e0912f] transition-[background-color,transform] duration-200 hover:scale-[1.06] hover:bg-[rgba(40,55,70,0.95)] active:scale-95"
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

      {/* corner title block (authored badge; hidden on very narrow boxes
          where it would collide with the hint pill + button column) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 start-4 z-20 hidden border border-[rgba(224,145,47,0.35)] bg-[rgba(17,25,33,0.78)] px-3.5 py-[9px] text-[11px] leading-[1.9] text-[#dfe6ea] sm:block"
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

      {/* hint pill — authored behavior: leaves 18s after readiness / on selection */}
      <div
        className={`pointer-events-none absolute bottom-7 left-1/2 z-20 flex max-w-[68%] items-center gap-2.5 whitespace-nowrap border border-[rgba(224,145,47,0.4)] bg-[rgba(17,25,33,0.85)] px-[18px] py-2.5 text-[13px] text-[#e8edf1] transition-[opacity,transform] duration-700 ease-in-out sm:max-w-[92%] ${
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
          <path d="M4 4l7 16 2.5-6.5L20 11z" />
        </svg>
        <span className="truncate">{t('hint')}</span>
        <span
          dir="ltr"
          style={{ fontFamily: MONO_FONT }}
          className="shrink-0 border border-[rgba(224,145,47,0.4)] px-1.5 py-0.5 font-mono text-[10px] text-[#e0912f]"
        >
          {t('nodes')}
        </span>
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
                className="absolute inset-y-[1px] start-[1px] w-0 [background-image:repeating-linear-gradient(-45deg,rgba(224,145,47,0.8)_0_1px,transparent_1px_4px)] transition-[width] duration-[600ms] [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"
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
