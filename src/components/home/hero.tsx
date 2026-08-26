'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Play } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { HeroConsole } from './hero-console'

const HeroCanvas = dynamic(
  () => import('./hero-canvas').then((m) => m.HeroCanvas),
  {
    ssr: false,
    loading: () => <div className="hero-fallback absolute inset-0" />,
  }
)

/**
 * Elyra hero — Phase 3 performance rework (prompt §4.1 + §4.2):
 *
 *   · Above-the-fold content (badge, h1, subtitle, CTAs) renders from the
 *     SERVER with CSS-only entrance keyframes (`hero-enter`) that start on
 *     first paint — no framer-motion, no hydration wait, LCP-safe. The h1
 *     and subtitle (LCP candidates) carry zero animation delay.
 *   · The Three.js canvas is deferred until requestIdleCallback (2.5s
 *     timeout) or the first pointer interaction, so its 231KB chunk never
 *     blocks LCP/TBT. The gradient fallback paints instantly underneath.
 *   · framer-motion is fully removed from this component.
 */
export function Hero() {
  const t = useTranslations('hero')
  const reduced = usePrefersReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(true)
  const [load3D, setLoad3D] = useState(false)

  // Pause rendering when the hero scrolls offscreen or the tab is hidden.
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) setActive(entry.isIntersecting)
      },
      { threshold: 0.05 }
    )
    io.observe(el)
    const onVisibility = () => setActive(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // WS-3: spotlight Blueprint grid — pointer tracking sets --mx/--my.
  // Phase 5 P0-2: also toggle `spotlight-active` on first move so the
  // grid transitions from its dim default to full reveal opacity.
  const spotlightActivated = useRef(false)
  const onHeroPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
    if (!spotlightActivated.current) {
      spotlightActivated.current = true
      el.classList.add('spotlight-active')
    }
  }, [])

  // Defer the Three.js chunk until after LCP (idle or first interaction).
  useEffect(() => {
    if (reduced) return
    let started = false
    const start = () => {
      if (started) return
      started = true
      setLoad3D(true)
    }
    let cancel: (() => void) | undefined
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 2500 })
      cancel = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(start, 1500)
      cancel = () => window.clearTimeout(id)
    }
    // First real interaction accelerates the load if idle hasn't fired yet.
    window.addEventListener('pointermove', start, { once: true, passive: true })
    window.addEventListener('keydown', start, { once: true, passive: true })
    return () => {
      cancel?.()
      window.removeEventListener('pointermove', start)
      window.removeEventListener('keydown', start)
    }
  }, [reduced])

  const show3D = !reduced && load3D

  return (
    <section
      ref={heroRef}
      onPointerMove={onHeroPointerMove}
      className="elyra-spotlight relative min-h-[100svh] overflow-hidden bg-elyra-deep text-elyra-on-dark"
      aria-labelledby="hero-title"
    >
      {/* Background */}
      <div className="absolute inset-0">
        {show3D ? <HeroCanvas active={active} /> : null}
        <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
        {/* vignette for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 30%, transparent, rgba(15,23,42,0.55) 80%)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Content — CSS-only entrance, LCP-safe (no JS dependency) */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col items-center justify-center px-4 pt-24 pb-20 text-center sm:px-6 lg:px-8">
        <span className="hero-enter hero-enter-1 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/85 backdrop-blur-sm sm:text-sm">
          <span className="size-1.5 rounded-full bg-g-green" aria-hidden="true" />
          {t('badge')}
        </span>

        <h1
          id="hero-title"
          className="hero-enter mt-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
          style={{ fontVariationSettings: '"wght" 200' }}
        >
          <span className="block">{t('titleTop')}</span>
          <span className="block text-primary">{t('titleAccent')}</span>
          <span className="block">{t('titleBottom')}</span>
        </h1>

        <p className="hero-enter mt-8 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
          {t('subtitle')}
        </p>

        <div className="hero-enter hero-enter-2 mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            data-cursor="magnet"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
          >
            {t('ctaPrimary')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            href="/work"
            data-cursor="magnet"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
          >
            <Play className="size-4" aria-hidden="true" />
            {t('ctaSecondary')}
          </Link>
        </div>

        {/* WS-1: interactive command console — pure HTML/CSS, protects LCP */}
        <HeroConsole />

        <div className="hero-scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50">
          <span className="flex flex-col items-center gap-1">
            <span>{t('scroll')}</span>
            <span
              className="block h-8 w-px bg-gradient-to-b from-white/40 to-transparent"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </section>
  )
}
