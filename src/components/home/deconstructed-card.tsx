'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chrome, Boxes, TrendingUp, Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * Deconstructed work card (Phase 4 WS-5, prompt §8, proposal B simplified).
 *
 * The FIRST featured project card splits into three spatial layers when it
 * enters a sticky zone: a glass browser frame, a systems layer (n8n-style
 * nodes + connections), and a results layer (metric slides). Scroll
 * progress drives the Z separation via CSS 3D transforms.
 *
 * Phase 5 P1-2 fix: the original implementation's translateZ was ±28px at
 * mid-scroll — too subtle for VLM to detect layer separation. The
 * perspective was 1000px with the layers all positive (0, +28, +56), so
 * the depth range was only 56px — visually flattened by the wide camera.
 * Now: layers spread AROUND z=0 (-50, 0, +50) at p=1, perspective raised
 * to 1500, transition linear (no jumps). Each layer gets distinct visual
 * language so the three-plane separation reads at a glance.
 *
 * Constraints (prompt §8): CSS 3D only (no WebGL), no scroll hijack,
 * sticky ≤ 1 screen. <768px: static stacked composition. Reduced-motion:
 * final composed state.
 */

// Phase 5 P1-2: depth per layer at full scroll progress — ±50px around 0
// (was 0/+28/+56, all-positive — the depth delta was too small for the
// eye to register three separate planes).
const LAYER_Z_FRONT = 50
const LAYER_Z_MIDDLE = 0
const LAYER_Z_BACK = -50

export function DeconstructedCard({ projectKey }: { projectKey: string }) {
  const t = useTranslations('workSection')
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        const rect = el.getBoundingClientRect()
        const vh = window.innerHeight
        // Linear progress: 0 when section top hits the viewport top,
        // 1 when its bottom leaves the viewport. No easing on the
        // transform itself — keep the depth change linear so there
        // are no jumps (Phase 5 P1-2 criterion).
        const raw = (vh - rect.top) / (vh + rect.height)
        setProgress(Math.max(0, Math.min(1, raw)))
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [reduced])

  const p = reduced ? 1 : progress
  // Layer Z at current progress — interpolates from 0 (collapsed) to
  // the full ±50px separation at p=1.
  const layerZ = (target: number) => target * p
  const rotX = (1 - p) * 18 // gentle tilt, 0 when fully open

  // Cap card dimensions for the 3D scene — keeps layers overlapping
  // at the start (collapsed state) and visible at full separation.
  const cardW = '22rem'
  const cardH = '15rem'

  return (
    <div ref={ref} className="relative h-[200vh]" data-cursor="rotate" data-cursor-label={t('deconstructed.hint')}>
      {/* Sticky inner — pins for ONE viewport of scroll. The outer is
          200vh so the sticky effect lasts (200vh - 100vh) = 100vh of
          scroll, giving the Z separation plenty of time to read. */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div
          className="relative"
          style={{
            // Phase 5 P1-2: 1000 → 1500 perspective so the ±50px Z
            // separation reads with proper foreshortening (was too flat).
            perspective: '1500px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Layer 3 (BACK): Results — metric slides */}
          <div
            className="absolute flex items-center justify-center rounded-2xl border border-g-green/40 bg-g-green/5 p-6 shadow-[0_8px_32px_-8px_rgba(52,168,83,0.4)]"
            style={{
              transform: `translateZ(${layerZ(LAYER_Z_BACK)}px) rotateX(${rotX}deg)`,
              width: cardW,
              height: cardH,
              transition: 'transform 0.15s linear',
            }}
          >
            <div className="text-center">
              <TrendingUp className="mx-auto size-9 text-g-green" aria-hidden="true" />
              <p className="mt-3 text-4xl font-bold text-g-green tabular-nums">
                {t.raw(`${projectKey}.metrics`)?.[0] ?? '+140%'}
              </p>
              <p className="mt-1 text-xs text-elyra-on-dark/70">
                {t.raw(`${projectKey}.metrics`)?.[1] ?? ''}
              </p>
            </div>
          </div>

          {/* Layer 2 (MIDDLE): Systems — n8n nodes + connections */}
          <div
            className="absolute flex items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 p-6 shadow-[0_8px_32px_-8px_rgba(0,113,227,0.5)]"
            style={{
              transform: `translateZ(${layerZ(LAYER_Z_MIDDLE)}px) translateY(${(1 - p) * 12}px)`,
              width: cardW,
              height: cardH,
              transition: 'transform 0.15s linear',
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <Workflow className="size-6 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary" />
                    <span className="h-px w-12 bg-primary/30" />
                    <span className="size-2.5 rounded-full bg-g-green" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Layer 1 (FRONT): Glass interface — browser frame */}
          <div
            className={cn(
              'absolute flex flex-col rounded-2xl border border-white/15 bg-elyra-dark/95 shadow-[0_12px_40px_-4px_rgba(0,0,0,0.6)]',
              'card-deep'
            )}
            style={{
              transform: `translateZ(${layerZ(LAYER_Z_FRONT)}px) translateY(${(1 - p) * -12}px)`,
              width: cardW,
              transition: 'transform 0.15s linear',
            }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
              <span className="size-2 rounded-full bg-g-red/70" />
              <span className="size-2 rounded-full bg-g-yellow/70" />
              <span className="size-2 rounded-full bg-g-green/70" />
              <Chrome className="ms-2 size-3.5 text-white/40" aria-hidden="true" />
            </div>
            {/* Browser content — mock UI */}
            <div className="space-y-2 p-4">
              <div className="h-2 w-3/4 rounded-full bg-white/25" />
              <div className="h-2 w-1/2 rounded-full bg-white/15" />
              <div className="mt-3 flex gap-2">
                <div className="h-8 flex-1 rounded-lg bg-primary/25" />
                <div className="h-8 w-8 rounded-lg bg-g-green/20" />
              </div>
              <div className="h-12 rounded-lg bg-white/5" />
              <div className="flex items-center gap-2 pt-1">
                <Boxes className="size-3 text-primary/80" aria-hidden="true" />
                <span className="h-1.5 w-16 rounded-full bg-white/20" />
              </div>
            </div>
          </div>

          {/* Label */}
          <div className="pointer-events-none absolute -bottom-16 left-1/2 -translate-x-1/2 text-center">
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
  )
}
