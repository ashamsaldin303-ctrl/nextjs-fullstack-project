'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { probeWebGL } from '@/lib/use-webgl'
// Type-only import (erased at compile time — keeps the lazy chunk boundary
// intact) for the imperative handle exposed by CityScene.
import type { CitySceneHandle } from '@/components/three/city/city-scene'

const CityScene = dynamic(
  () => import('@/components/three/city/city-scene').then((m) => m.CityScene),
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
  // Keyboard path for the city camera — CityScene exposes an imperative
  // nudge handle via React 19's ref-as-prop (the ref passes through
  // next/dynamic → React.lazy because ref is a regular prop in React 19).
  // Arrow keys rotate through the same ±0.0048 rad/px mapping the pointer
  // drag applies (16 "drag pixels" ≈ 0.077 rad ≈ 4.4° per press); Escape
  // deselects the current landmark. preventDefault stops the page from
  // scrolling while the visitor is rotating the model.
  const sceneRef = useRef<CitySceneHandle | null>(null)
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const handle = sceneRef.current
    if (!handle) return
    if (e.key === 'Escape') {
      handle.deselect()
      e.preventDefault()
      return
    }
    const step = 16
    switch (e.key) {
      case 'ArrowLeft':
        handle.nudge(-step, 0)
        break
      case 'ArrowRight':
        handle.nudge(step, 0)
        break
      case 'ArrowUp':
        handle.nudge(0, -step)
        break
      case 'ArrowDown':
        handle.nudge(0, step)
        break
      default:
        return
    }
    e.preventDefault()
  }, [])
  // The IO writes this ref so the visibilitychange handler can never
  // re-enable rendering while the section is offscreen.
  const intersectingRef = useRef(true)
  // The Three.js chunk only loads when the section actually approaches the
  // viewport — below-fold sections never pay the cost up front.
  const [nearViewport, setNearViewport] = useState(false)
  // WebGL gate (FIX(2-b) for L1-C/L1-D P3): probe ACTUAL context creation,
  // rAF-deferred so no synchronous GL work happens inside the effect body;
  // hard-locked false once the probe fails (no WebGL → static fallback).
  const [glAvailable, setGlAvailable] = useState(true)
  useEffect(() => {
    let cancelled = false
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setGlAvailable(probeWebGL())
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

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

        {/* MOBILE-FS polish: zoom variant — the showcase box scales in from
            0.92 (stronger than the default rise) so the city section reads
            as a centerpiece reveal, matching the bento/featured-work cards. */}
        <Reveal className="mt-12" variant="zoom">
          {/* role="img" + aria-label on the wrapper and a keyboard camera
              path: tabIndex + arrow keys (handler above). Focusable only
              while the WebGL scene can actually rotate (!reduced && WebGL —
              the reduced-motion / no-WebGL states render the static
              fallback, nothing to rotate). Focus ring mirrors the hero CTA
              pattern (ring-ring on elyra-dark offset). */}
          <div
            ref={ref}
            data-cursor="rotate"
            data-cursor-label={tc('cursor.rotate')}
            role="img"
            aria-label={t('hint')}
            tabIndex={!reduced && glAvailable ? 0 : undefined}
            onKeyDown={onKeyDown}
            className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark sm:aspect-[16/9]"
          >
            {!reduced && nearViewport && glAvailable ? (
              <CityScene ref={sceneRef} active={active} />
            ) : null}
            <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
            {reduced ? (
              <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
                {t('fallback')}
              </p>
            ) : null}
            {!glAvailable ? (
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
