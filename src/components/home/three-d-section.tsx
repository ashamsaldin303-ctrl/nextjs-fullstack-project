'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { MousePointer2 } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
// Type-only import (erased at compile time — keeps the lazy chunk boundary
// intact) for the imperative rotation handle exposed by CapabilityScene.
import type { CapabilitySceneHandle } from '@/components/three/capability-scene'

const CapabilityScene = dynamic(
  () => import('@/components/three/capability-scene').then((m) => m.CapabilityScene),
  {
    ssr: false,
    loading: () => <div className="hero-fallback absolute inset-0" />,
  }
)

export function ThreeDSection() {
  const t = useTranslations('pages.websites.threeD')
  const tc = useTranslations('common') // WS-2: cursor context label
  const reduced = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)
  // FIX(2-b, L1-D P3): keyboard path for the 3D drag — CapabilityScene
  // exposes an imperative nudge handle via React 19's ref-as-prop (the ref
  // passes through next/dynamic → React.lazy because ref is a regular prop
  // in React 19; verified against the installed react-dom 19.2.3
  // lazy-component mount path). Arrow keys rotate the scene through the
  // same ±0.01 rad/px mapping the pointer drag uses (16 "drag pixels"
  // ≈ 0.16 rad ≈ 9° per press); preventDefault stops the page from
  // scrolling while the visitor is rotating the scene.
  const sceneRef = useRef<CapabilitySceneHandle | null>(null)
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const nudge = sceneRef.current?.nudge
    if (!nudge) return
    const step = 16
    switch (e.key) {
      case 'ArrowLeft':
        nudge(-step, 0)
        break
      case 'ArrowRight':
        nudge(step, 0)
        break
      case 'ArrowUp':
        nudge(0, -step)
        break
      case 'ArrowDown':
        nudge(0, step)
        break
      default:
        return
    }
    e.preventDefault()
  }, [])
  // FIX(2-c/7): the IO writes this ref so the visibilitychange handler
  // can never re-enable rendering while the section is offscreen.
  const intersectingRef = useRef(true)
  // Phase 3 §4.2: the Three.js chunk only loads when the section actually
  // approaches the viewport — below-fold sections never pay the cost up front.
  const [nearViewport, setNearViewport] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          intersectingRef.current = entry.isIntersecting
          setActive(entry.isIntersecting && !document.hidden)
          if (entry.isIntersecting) setNearViewport(true)
        }
      },
      { rootMargin: '200px 0px', threshold: 0.1 }
    )
    io.observe(el)
    const onVis = () => setActive(!document.hidden && intersectingRef.current)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="threeD-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
          titleId="threeD-title"
        />

        <Reveal className="mt-12">
          {/* FIX(2-b, L1-D P3): role="img" + aria-label (was aria-label on a
              role-less div — ignored by most AT) and a keyboard drag path:
              tabIndex + arrow keys (handler above). Focusable only while the
              WebGL scene can actually rotate (!reduced — reduced-motion
              renders the static fallback, nothing to rotate). Focus ring
              mirrors the hero CTA pattern (ring-ring on elyra-dark offset). */}
          <div
            ref={ref}
            data-cursor="rotate"
            data-cursor-label={tc('cursor.rotate')}
            role="img"
            aria-label={t('hint')}
            tabIndex={!reduced ? 0 : undefined}
            onKeyDown={onKeyDown}
            className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark sm:aspect-[16/8]"
          >
            {!reduced && nearViewport ? <CapabilityScene ref={sceneRef} active={active} /> : null}
            <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
            <div className="pointer-events-none absolute bottom-4 start-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
              <MousePointer2 className="size-3.5" aria-hidden="true" />
              {t('hint')}
            </div>
            {reduced ? (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
                {t('fallback')}
              </p>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
