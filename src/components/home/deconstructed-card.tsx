'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chrome, Boxes, TrendingUp } from 'lucide-react'
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
 * Constraints (prompt §8): CSS 3D only (no WebGL), no scroll hijack,
 * sticky ≤ 1 screen. <768px: static stacked composition. Reduced-motion:
 * final composed state.
 */

export function DeconstructedCard({ projectKey }: { projectKey: string }) {
  const t = useTranslations('workSection')
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when the section top hits the viewport top, 1 when bottom leaves
      const raw = (vh - rect.top) / (vh + rect.height)
      setProgress(Math.max(0, Math.min(1, raw)))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [reduced])

  const p = reduced ? 1 : progress
  const z = (layer: number) => (layer * p * 80) // px depth
  const rotX = (1 - p) * 25 // degrees, 0 when fully open

  return (
    <div ref={ref} className="relative h-screen max-h-[800px]">
      {/* Sticky inner — pins for one screen */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div
          className="relative"
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Layer 3 (back): Results — metric slides */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border border-g-green/30 bg-g-green/5 p-6"
            style={{
              transform: `translateZ(${z(0)}px) rotateX(${rotX}deg)`,
              width: '24rem',
              height: '16rem',
              transition: 'transform 0.1s linear',
            }}
          >
            <div className="text-center">
              <TrendingUp className="mx-auto size-8 text-g-green" aria-hidden="true" />
              <p className="mt-3 text-3xl font-bold text-g-green">
                {t.raw(`${projectKey}.metrics`)?.[0] ?? '+140%'}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t.raw(`${projectKey}.metrics`)?.[1] ?? ''}
              </p>
            </div>
          </div>

          {/* Layer 2 (middle): Systems — n8n nodes + connections */}
          <div
            className="absolute flex items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-6"
            style={{
              transform: `translateZ(${z(1)}px) translateY(${(1 - p) * 20}px)`,
              width: '22rem',
              height: '14rem',
              transition: 'transform 0.1s linear',
            }}
          >
            <div className="flex items-center gap-3">
              <Boxes className="size-6 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary/60" />
                    <span className="h-px w-12 bg-primary/20" />
                    <span className="size-2 rounded-full bg-g-green/60" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Layer 1 (front): Glass interface — browser frame */}
          <div
            className={cn(
              'absolute flex flex-col rounded-2xl border border-white/15 bg-elyra-dark/90 shadow-2xl',
              'card-deep'
            )}
            style={{
              transform: `translateZ(${z(2)}px) translateY(${(1 - p) * -10}px)`,
              width: '20rem',
              transition: 'transform 0.1s linear',
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
              <div className="h-2 w-3/4 rounded-full bg-white/20" />
              <div className="h-2 w-1/2 rounded-full bg-white/10" />
              <div className="mt-3 flex gap-2">
                <div className="h-8 flex-1 rounded-lg bg-primary/15" />
                <div className="h-8 w-8 rounded-lg bg-g-green/15" />
              </div>
              <div className="h-12 rounded-lg bg-white/5" />
            </div>
          </div>

          {/* Label */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 text-center">
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
