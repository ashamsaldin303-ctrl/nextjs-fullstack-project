'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chrome, Boxes, TrendingUp, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Deconstructed work card (Phase 4 WS-5, rebuilt in UI-1).
 *
 * The FIRST featured project card splits into three spatial layers when it
 * pins inside a sticky zone: a glass browser frame (front), an n8n-style
 * systems layer (middle) and a results/metrics layer (back). Scroll
 * progress drives the separation via CSS 3D transforms.
 *
 * UI-1 fixes for the reported scroll bugs ("the cards that open/close
 * with scroll don't work correctly; they overlap and don't track the
 * scroll animation"):
 *
 * 1. NO CSS transitions on scroll-driven transforms. The old
 *    `transition: transform 0.15s linear` fought the per-frame rAF
 *    updates — every scroll event restarted a 150ms tween toward a
 *    target that kept moving, so the visuals lagged the scrollbar and
 *    rubber-banded when the scroll direction reversed. All layer
 *    transforms (and the label offset) are now transition-free and map
 *    1:1 to the scroll position.
 *
 * 2. Rebuilt separation geometry — an exploded cascade. The old ±112px
 *    vertical fan left only ~37px of clearance and the full-size middle
 *    card still covered the back layer's centred text, so p=1 read as a
 *    messy stack. New geometry at p=1 (perspective 1500, card 320×192,
 *    half-height 96, projection factor k = 1500/(1500 − z)):
 *
 *      front  (browser)  y −196·k(60)=−204.2  scale .90 → spans −294…−114
 *      middle (systems)  y 0                  scale .86 → spans −82.6…82.6
 *      back   (results)  y +204·k(−60)=+196.2 scale .88 → spans 115…277
 *
 *    → 31.6px clear gap front↔middle and 32.4px middle↔back (spec ≥28),
 *    with ±14px X stagger and ∓2° tilt for a hand-of-cards feel. The
 *    whole fan is ~590px tall, fitting a 720px viewport with the label.
 *
 * 3. The label offset is derived from the exact projected bottom edge of
 *    the back layer at every p (see `backBottom`), so it always sits 14px
 *    below the lowest layer (p=0 → 110px, p=0.5 → ~202px, p=1 → ~291px
 *    from the card centre) — no collision at any progress.
 *
 * 4. The explosion is confined to the PINNED phase: the raw zone
 *    progress 0→0.5 is the h-screen scene entering the viewport (card
 *    stays composed), 0.5→1 remaps to p 0→1 across exactly one viewport
 *    of pinned travel. The last pinned frame shows the complete fan;
 *    reversing scroll closes it symmetrically, 1:1.
 *
 * 5. <768px renders a static vertical stack (browser → systems →
 *    results → label) via a CSS-only `md:` duplication — phones reserve
 *    no 200vh sticky zone, and the SSR markup is identical in every
 *    locale/viewport (no hydration risk, no post-mount flip).
 *
 * Depth cues: per-layer shadow blur/offset/opacity interpolate with p;
 * the middle layer dims to 0.88 (decorative content only) and the back
 * layer to 0.95 — capped there because its sub-metric (muted-foreground
 * on the light green card) falls below WCAG AA 4.5:1 at lower opacities.
 *
 * Constraints (prompt §8): CSS 3D only (no WebGL), no scroll hijack,
 * sticky ≤ 1 screen of travel, reduced-motion → final composed state
 * (p=1) with no listener. MED-5 token discipline: light-tinted layers
 * use primary-strong / muted-foreground; the dark layer uses white/xx.
 */

// ---------------------------------------------------------------------------
// Geometry constants (see the p=1 span table in the doc comment).
// ---------------------------------------------------------------------------
const PERSPECTIVE = 1500
const CARD_W = '20rem' // 320px
const CARD_H = '12rem' // 192px → half-height 96px
const HALF_H = 96

// Cascade targets at p=1. y: +down / −up, z: +toward viewer / −away,
// x: physical px (a symmetric decorative fan, identical in LTR and RTL).
const FRONT = { y: -196, x: -14, z: 60, scale: 0.9, rot: -2 } as const
const MIDDLE = { y: 0, x: 0, z: 0, scale: 0.86, opacity: 0.88 } as const
const BACK = { y: 204, x: 14, z: -60, scale: 0.88, rot: 2, opacity: 0.95 } as const

// Gap between the back layer's projected bottom edge and the label.
const LABEL_GAP = 14

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

// ---------------------------------------------------------------------------
// Shared layer content (used by both the desktop 3D scene and the mobile
// static stack so the two compositions keep one visual language).
// ---------------------------------------------------------------------------

/** Glass browser frame — dark card, decorative mock UI (aria-safe). */
function BrowserContent() {
  return (
    <>
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="size-2 rounded-full bg-g-red/70" />
        <span className="size-2 rounded-full bg-g-yellow/70" />
        <span className="size-2 rounded-full bg-g-green/70" />
        <Chrome className="ms-2 size-3.5 text-white/40" aria-hidden="true" />
      </div>
      {/* Browser content — mock UI; the flex-1 block absorbs the remaining
          height so the frame fills the layer at any size. */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="h-2 w-3/4 rounded-full bg-white/25" />
        <div className="h-2 w-1/2 rounded-full bg-white/15" />
        <div className="flex gap-2">
          <div className="h-7 flex-1 rounded-lg bg-primary/25" />
          <div className="size-7 rounded-lg bg-g-green/20" />
        </div>
        <div className="min-h-6 flex-1 rounded-lg bg-white/5" />
        <div className="flex items-center gap-2">
          <Boxes className="size-3 text-primary/80" aria-hidden="true" />
          <span className="h-1.5 w-16 rounded-full bg-white/20" />
        </div>
      </div>
    </>
  )
}

/** Systems layer — primary-tinted card (amber), n8n-style nodes + connections. */
function SystemsContent({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Workflow className="size-6 text-primary" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-primary" />
            <span className="h-px w-12 bg-primary/30" />
            <span className="size-2.5 rounded-full bg-g-green" />
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
  compact = false,
}: {
  metric: string
  sub: string
  compact?: boolean
}) {
  return (
    <div className="text-center">
      <TrendingUp
        className={cn('mx-auto text-g-green', compact ? 'size-7' : 'size-8')}
        aria-hidden="true"
      />
      <p
        className={cn(
          'mt-2 font-bold leading-snug text-primary-strong tabular-nums',
          compact ? 'text-2xl' : 'text-3xl',
        )}
      >
        {metric}
      </p>
      {sub ? (
        <p className={cn('mt-1 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
          {sub}
        </p>
      ) : null}
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
  const [progress, setProgress] = useState(reduced ? 1 : 0)

  const metrics = t.raw(`${projectKey}.metrics`) as string[] | undefined
  const metricMain = metrics?.[0] ?? '+140%'
  const metricSub = metrics?.[1] ?? ''

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
      // UI-1: confine the explosion to the pinned phase (raw 0.5→1 ⇒
      // p 0→1). While the scene is still sliding into view the card stays
      // composed, so the layers ONLY move while pinned — the separation
      // tracks the scrollbar 1:1 in both directions.
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

  // Perspective projection factor for the back layer at translateZ(z):
  // every translated coordinate (centre AND size) scales by k = d/(d − z).
  const kBack = PERSPECTIVE / (PERSPECTIVE - lerp(0, BACK.z, p))

  // Back layer's projected bottom edge (distance from the card centre).
  // The label rides `LABEL_GAP` below this at every p, so it can never
  // collide with the fan — verify: p=0 → 96+14=110, p=0.5 → ~202,
  // p=1 → ~291 from the card centre.
  const backBottom =
    lerp(0, BACK.y, p) * kBack + HALF_H * lerp(1, BACK.scale, p) * kBack

  // Depth cues — blur/offset/opacity grow with separation, per layer.
  const frontShadow = `0 ${(14 + 30 * p).toFixed(1)}px ${(34 + 50 * p).toFixed(1)}px -16px rgba(0,0,0,${(0.45 + 0.2 * p).toFixed(2)})`
  const middleShadow = `0 ${(10 + 18 * p).toFixed(1)}px ${(26 + 30 * p).toFixed(1)}px -12px rgba(180,83,9,${(0.3 + 0.16 * p).toFixed(2)})`
  const backShadow = `0 ${(8 + 12 * p).toFixed(1)}px ${(20 + 22 * p).toFixed(1)}px -10px rgba(52,168,83,${(0.24 + 0.12 * p).toFixed(2)})`

  return (
    <div data-cursor="rotate" data-cursor-label={t('deconstructed.hint')}>
      {/* ------------------------------------------------------------- */}
      {/* Mobile (<768px): static stacked composition — no sticky zone,  */}
      {/* no 200vh scroll budget. Pure CSS duplication of the three      */}
      {/* layers, so SSR markup is identical everywhere (no hydration    */}
      {/* mismatch, no post-mount flash).                                */}
      {/* ------------------------------------------------------------- */}
      <div className="px-4 py-6 md:hidden">
        <div className="mx-auto flex w-full max-w-[20rem] flex-col gap-3">
          <div
            className="card-deep flex h-44 flex-col overflow-hidden rounded-xl border border-white/15 bg-elyra-dark/95"
            style={{ background: 'rgba(15, 23, 42, 0.95)' }}
          >
            <BrowserContent />
          </div>
          <div className="flex items-center justify-center rounded-xl border border-primary/40 bg-primary/10 p-4">
            <SystemsContent rows={3} />
          </div>
          <div className="rounded-xl border border-g-green/40 bg-g-green/5 p-4">
            <ResultsContent metric={metricMain} sub={metricSub} compact />
          </div>
          <div className="pt-1 text-center">
            <h3 className="text-lg font-semibold tracking-tight">
              {t(`${projectKey}.title`)}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`${projectKey}.desc`)}
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Desktop (≥768px): sticky scroll-driven scene. The outer div is */}
      {/* 200vh so the pin lasts exactly (200vh − 100vh) = 100vh — one   */}
      {/* viewport of scroll travel (§8).                                */}
      {/* ------------------------------------------------------------- */}
      <div ref={ref} className="relative hidden h-[200vh] md:block">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
          <div
            className="relative"
            style={{
              perspective: `${PERSPECTIVE}px`,
              width: CARD_W,
              height: CARD_H,
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
                  and back (negative Z). */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border border-g-green/40 bg-g-green/5 p-5"
                style={{
                  // NO transition — scroll-driven, 1:1 with the scrollbar.
                  transform: `translate3d(${lerp(0, BACK.x, p)}px, ${lerp(0, BACK.y, p)}px, ${lerp(0, BACK.z, p)}px) rotate(${lerp(0, BACK.rot, p)}deg) scale(${lerp(1, BACK.scale, p).toFixed(4)})`,
                  boxShadow: backShadow,
                  opacity: lerp(1, BACK.opacity, p),
                  willChange: 'transform',
                }}
              >
                <ResultsContent metric={metricMain} sub={metricSub} />
              </div>

              {/* Layer 2 (MIDDLE): Systems — n8n nodes + connections.
                  Stays near the centre of the cascade. */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-6"
                style={{
                  transform: `translate3d(${lerp(0, MIDDLE.x, p)}px, ${lerp(0, MIDDLE.y, p)}px, ${lerp(0, MIDDLE.z, p)}px) scale(${lerp(1, MIDDLE.scale, p).toFixed(4)})`,
                  boxShadow: middleShadow,
                  opacity: lerp(1, MIDDLE.opacity, p),
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
                  transform: `translate3d(${lerp(0, FRONT.x, p)}px, ${lerp(0, FRONT.y, p)}px, ${lerp(0, FRONT.z, p)}px) rotate(${lerp(0, FRONT.rot, p)}deg) scale(${lerp(1, FRONT.scale, p).toFixed(4)})`,
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

            {/* Label — lives outside the tilted preserve-3d wrapper (so
                its text never tilts) and tracks the back layer's
                projected bottom edge via transform only. */}
            <div
              className="pointer-events-none absolute -inset-x-10 top-1/2 text-center"
              style={{
                transform: `translateY(${(backBottom + LABEL_GAP).toFixed(1)}px)`,
                willChange: 'transform',
              }}
            >
              <h3 className="text-lg font-semibold tracking-tight">
                {t(`${projectKey}.title`)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`${projectKey}.desc`)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
