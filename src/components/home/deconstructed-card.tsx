'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chrome, Boxes, TrendingUp, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { asStringArray } from '@/lib/catalog-guards'

/**
 * Deconstructed work card (Phase 4 WS-5, rebuilt in UI-1, upgraded R2).
 *
 * The FIRST featured project card splits into three spatial layers when it
 * pins inside a sticky zone: a glass browser frame (front), an n8n-style
 * systems layer (middle) and a results/metrics layer (back). Scroll
 * progress drives the separation via CSS 3D transforms.
 *
 * R2 upgrade (user request — "bigger, clearer cards + the scroll
 * animation on mobile too"):
 *
 * 1. ONE unified scene for every viewport. The old <768px static stack
 *    (`md:hidden` duplication) is gone — phones now get the same sticky
 *    scroll-driven explosion. The card itself is fluid:
 *    width = min(30rem, 88vw) with a 5:3 aspect ratio, so it is BIG on
 *    desktop (480×288 vs the old fixed 320×192) and fills the phone
 *    width minus gutters.
 *
 * 2. Measurement-driven geometry. The separation cascade is derived from
 *    the LIVE card size (ResizeObserver). Because every layer transform is
 *    identity at p=0, a not-yet-measured default (480×288) has zero visual
 *    impact — the measurement lands before the user can scroll.
 *
 *      frontSep = 0.50·h + 40      backSep = 0.52·h + 42
 *
 *    which yields the clearance table (spec ≥ 28px gap between layers):
 *
 *      desktop  h=288  → front −184px, back +192px, gaps ≈ 67/61px
 *      mobile   h≈206  → front −143px, back +149px, gaps ≈ 36/33px
 *
 *    X stagger = ±4.5% of the live card width; z stays ±60.
 *
 * 3. NO CSS transitions on scroll-driven transforms (UI-1 rule kept) —
 *    every layer transform maps 1:1 to the scrollbar position in both
 *    directions.
 *
 * 4. The explosion is confined to the PINNED phase (UI-1 rule kept):
 *    raw zone progress 0→0.5 is the h-screen scene sliding into view,
 *    0.5→1 remaps to p 0→1 across exactly one viewport of pinned travel.
 *
 * 5. Reduced-motion → final composed state (p=1) with no listener.
 *
 * Depth cues: per-layer shadow blur/offset/opacity interpolate with p;
 * the middle layer dims to 0.88 (decorative content only) and the back
 * layer to 0.95 — capped there because its sub-metric (muted-foreground
 * on the light green card) falls below WCAG AA 4.5:1 at lower opacities.
 */

// ---------------------------------------------------------------------------
// Fixed scene geometry (the fluid parts are measured at runtime)
// ---------------------------------------------------------------------------
const PERSPECTIVE = 1500
const Z_FRONT = 60
const Z_BACK = -60

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** Separation targets derived from the live card height (see doc table). */
const frontSep = (h: number) => 0.5 * h + 40
const backSep = (h: number) => 0.52 * h + 42
/** X stagger as a fraction of the live card width. */
const X_FRAC = 0.045

// ---------------------------------------------------------------------------
// Shared layer content — sized relatively so it scales with the bigger card.
// ---------------------------------------------------------------------------

/** Glass browser frame — dark card, decorative mock UI (aria-safe). */
function BrowserContent() {
  return (
    <>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-g-red/70" />
        <span className="size-2.5 rounded-full bg-g-yellow/70" />
        <span className="size-2.5 rounded-full bg-g-green/70" />
        <Chrome className="ms-3 size-4 text-white/40" aria-hidden="true" />
      </div>
      {/* Browser content — mock UI; the flex-1 block absorbs the remaining
          height so the frame fills the layer at any size. */}
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="h-2.5 w-3/4 rounded-full bg-white/25" />
        <div className="h-2.5 w-1/2 rounded-full bg-white/15" />
        <div className="flex gap-2.5">
          <div className="h-9 flex-1 rounded-lg bg-primary/30" />
          <div className="size-9 rounded-lg bg-g-green/25" />
        </div>
        <div className="min-h-8 flex-1 rounded-lg bg-white/5" />
        <div className="flex items-center gap-2">
          <Boxes className="size-3.5 text-primary/90" aria-hidden="true" />
          <span className="h-2 w-20 rounded-full bg-white/20" />
        </div>
      </div>
    </>
  )
}

/** Systems layer — primary-tinted card (blue), n8n-style nodes + connections. */
function SystemsContent({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Workflow className="size-8 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="size-3 rounded-full bg-primary" />
            <span className="h-px w-14 bg-primary/30" />
            <span className="size-3 rounded-full bg-g-green" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Results layer — green-tinted light card. MED-5: light-surface tokens
 * (primary-strong ≈5.1:1, muted-foreground ≈6.7:1 on the light tint);
 * the g-green icon stays decorative + aria-hidden.
 */
function ResultsContent({
  metric,
  sub,
}: {
  metric: string
  sub: string
}) {
  return (
    <div className="text-center">
      <TrendingUp className="mx-auto size-9 text-g-green" aria-hidden="true" />
      {/* L1-C P3 (fix 2-d): metric line renders ONLY when the catalog
          provides one — no hardcoded Latin '+140%' fallback on the AR site. */}
      {metric ? (
        <p className="mt-2 font-bold leading-snug text-primary-strong tabular-nums text-3xl md:text-4xl">
          {metric}
        </p>
      ) : null}
      {sub ? <p className="mt-1 text-sm text-muted-foreground md:text-base">{sub}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeconstructedCard({ projectKey }: { projectKey: string }) {
  const t = useTranslations('workSection')
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(reduced ? 1 : 0)
  // Live card size — measured via ResizeObserver (defaults match the
  // desktop 30rem card; corrected on the first client pass — safe because
  // all layer transforms are identity at p=0).
  const [size, setSize] = useState({ w: 480, h: 288 })

  // L6-R2 (fix 6): runtime-narrowed catalog read (was `as string[] | undefined` —
  // the guard degrades a missing/drifting array to [] and the ?? fallbacks
  // below keep the empty-metric rendering path).
  const metrics = asStringArray(t.raw(`${projectKey}.metrics`))
  const metricMain = metrics[0] ?? ''
  const metricSub = metrics[1] ?? ''

  // Viewport-height damp — on short viewports (landscape phones, small
  // laptops) the fan is squeezed so the full cascade + label still fits
  // inside the pinned screen. 820px is the reference height.
  const [vhScale, setVhScale] = useState(1)
  useEffect(() => {
    const apply = () => {
      const s = Math.min(1, Math.max(0.72, window.innerHeight / 820))
      setVhScale((prev) => (Math.abs(prev - s) < 0.01 ? prev : s))
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  // --- measure the fluid card (width = min(30rem, 88vw), aspect 5:3) -----
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const apply = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setSize((prev) =>
          Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
            ? prev
            : { w: r.width, h: r.height }
        )
      }
    }
    apply()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply)
      return () => window.removeEventListener('resize', apply)
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // --- scroll progress (UI-1 rules: rAF-coalesced, pinned phase only) ----
  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let rafId = 0
    const update = () => {
      rafId = 0
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // Raw progress across the 200vh zone: 0 when the zone's top enters
      // the viewport bottom, 0.5 the instant the sticky pins (rect.top 0),
      // 1 at release (rect.top −vh).
      const raw = (vh - rect.top) / (vh * 2)
      // Confine the explosion to the pinned phase (raw 0.5→1 ⇒ p 0→1).
      const pinned = (Math.min(1, Math.max(0, raw)) - 0.5) * 2
      setProgress(Math.min(1, Math.max(0, pinned)))
    }
    const requestUpdate = () => {
      if (rafId) return
      rafId = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    update()
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [reduced])

  const p = reduced ? 1 : progress

  // --- geometry derived from the measured card ----------------------------
  const fY = frontSep(size.h) * vhScale
  const bY = backSep(size.h) * vhScale
  const fX = -X_FRAC * size.w // mirrored fan: front drifts start-side,
  const bX = X_FRAC * size.w // back drifts end-side (identical LTR/RTL)

  // Depth cues — blur/offset/opacity grow with separation, per layer.
  const frontShadow = `0 ${(14 + 30 * p).toFixed(1)}px ${(34 + 50 * p).toFixed(1)}px -16px rgba(0,0,0,${(0.45 + 0.2 * p).toFixed(2)})`
  const middleShadow = `0 ${(10 + 18 * p).toFixed(1)}px ${(26 + 30 * p).toFixed(1)}px -12px rgba(0,113,227,${(0.3 + 0.16 * p).toFixed(2)})`
  const backShadow = `0 ${(8 + 12 * p).toFixed(1)}px ${(20 + 22 * p).toFixed(1)}px -10px rgba(52,168,83,${(0.24 + 0.12 * p).toFixed(2)})`

  return (
    // L3 FIX (R3): no data-cursor here — this scene has ZERO pointer
    // handlers (the explosion is 100% scroll-driven), so the rotate cursor
    // + "drag to explore the layers" chip promised an interaction that
    // never existed. Removed both attributes.
    <div>
      {/* Unified sticky scroll-driven scene — desktop AND mobile.
          The outer div is 200vh so the pin lasts exactly (200vh − 100vh) =
          100vh — one viewport of scroll travel (§8). */}
      <div ref={ref} className="relative h-[200vh]">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4">
          <div
            ref={cardRef}
            className="relative"
            style={{
              perspective: `${PERSPECTIVE}px`,
              width: 'min(30rem, 88vw)',
              aspectRatio: '5 / 3',
            }}
          >
            {/* Scene wrapper — a gentle 6°→0° tilt that flattens as the
                layers separate (foreshortening ≤1.2%, ignorable in the
                clearance math above). */}
            <div
              className="h-full w-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${((1 - p) * 6).toFixed(2)}deg)`,
                willChange: 'transform',
              }}
            >
              {/* Layer 3 (BACK): Results — metric slides. Translates DOWN
                  and back (negative Z). The project label rides just below
                  this layer (top:100%) so it is glued to the fan at every
                  progress — no projected-edge math needed. */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border border-g-green/40 bg-g-green/5 p-5 md:p-6"
                style={{
                  // NO transition — scroll-driven, 1:1 with the scrollbar.
                  transform: `translate3d(${lerp(0, bX, p)}px, ${lerp(0, bY, p)}px, ${lerp(0, Z_BACK, p)}px) rotate(${lerp(0, 2, p)}deg) scale(${lerp(1, 0.88, p).toFixed(4)})`,
                  boxShadow: backShadow,
                  opacity: lerp(1, 0.95, p),
                  willChange: 'transform',
                }}
              >
                <ResultsContent metric={metricMain} sub={metricSub} />
                {/* Label — absolutely positioned below the back layer; it
                    inherits the layer transform, riding the cascade. */}
                <div className="pointer-events-none absolute inset-x-0 top-full -mx-10 mt-3.5 text-center md:-mx-16">
                  <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                    {t(`${projectKey}.title`)}
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground md:text-base">
                    {t(`${projectKey}.desc`)}
                  </p>
                </div>
              </div>

              {/* Layer 2 (MIDDLE): Systems — n8n nodes + connections.
                  Stays near the centre of the cascade. */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-5 md:p-6"
                style={{
                  transform: `translate3d(0px, 0px, 0px) scale(${lerp(1, 0.86, p).toFixed(4)})`,
                  boxShadow: middleShadow,
                  opacity: lerp(1, 0.88, p),
                  willChange: 'transform',
                }}
              >
                <SystemsContent rows={4} />
              </div>

              {/* Layer 1 (FRONT): Glass browser frame. Translates UP and
                  forward (positive Z) — DOM-last so it also paints on top
                  while the layers still overlap mid-transition. */}
              <div
                className={cn(
                  'card-deep absolute inset-0 flex flex-col rounded-2xl border border-white/15 bg-elyra-dark/95',
                )}
                style={{
                  transform: `translate3d(${lerp(0, fX, p)}px, ${lerp(0, -fY, p)}px, ${lerp(0, Z_FRONT, p)}px) rotate(${lerp(0, -2, p)}deg) scale(${lerp(1, 0.9, p).toFixed(4)})`,
                  boxShadow: frontShadow,
                  // Inline so it beats .card-deep's unlayered
                  // `background: rgba(255,255,255,0.03)` — the utility
                  // `bg-elyra-dark/95` was being overridden (the "dark
                  // glass" frame rendered as near-transparent light
                  // glass). elyra-dark #0F172A @ 95%.
                  background: 'rgba(15, 23, 42, 0.95)',
                  willChange: 'transform',
                }}
              >
                <BrowserContent />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
