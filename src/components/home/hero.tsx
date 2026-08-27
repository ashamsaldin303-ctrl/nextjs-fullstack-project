'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight, Play } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { useCursorVelocity } from '@/lib/use-cursor-velocity'
import { HeroConsole } from './hero-console'
import { KineticHeading } from './kinetic-heading'

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
  // Phase 5 WS-6: ref for the primary CTA — kinetic typography with a
  // narrower wght range (600→700) so the button feels responsive to
  // cursor speed without competing with the h1's wider 600→800 range.
  const ctaPrimaryRef = useRef<HTMLAnchorElement>(null)
  const [active, setActive] = useState(true)
  const [load3D, setLoad3D] = useState(false)
  // FIX(2-c/7): both visibility signals — the IO writes this ref so the
  // visibilitychange handler can never re-enable an offscreen section.
  const intersectingRef = useRef(true)

  // Phase 5 WS-6: apply kinetic typography to the primary CTA.
  useCursorVelocity(ctaPrimaryRef, {
    minWght: 600,
    maxWght: 700,
    idleWght: 700,
    saturationVelocity: 3,
    idleMs: 200,
  })

  // Pause rendering when the hero scrolls offscreen or the tab is hidden.
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          intersectingRef.current = entry.isIntersecting
          setActive(entry.isIntersecting && !document.hidden)
        }
      },
      { threshold: 0.05 }
    )
    io.observe(el)
    const onVisibility = () => setActive(!document.hidden && intersectingRef.current)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // WS-3: spotlight Blueprint grid — pointer tracking sets --mx/--my.
  // Phase 5 P0-2: also toggle `spotlight-active` on first move so the
  // grid transitions from its dim default to full reveal opacity.
  // FIX(2-c/4): rAF-coalesced — store the latest event and perform the
  // rect read + CSS custom property write ONCE per frame instead of per
  // pointermove (input events can fire far above display frequency). No
  // new events → the callback never reschedules, so the loop goes idle.
  const spotlightActivated = useRef(false)
  const latestPointer = useRef<React.PointerEvent<HTMLElement> | null>(null)
  const spotlightRaf = useRef(0)
  const onHeroPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    latestPointer.current = e
    if (spotlightRaf.current) return
    spotlightRaf.current = requestAnimationFrame(() => {
      spotlightRaf.current = 0
      const el = heroRef.current
      const ev = latestPointer.current
      if (!el || !ev) return
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - rect.left}px`)
      el.style.setProperty('--my', `${ev.clientY - rect.top}px`)
      if (!spotlightActivated.current) {
        spotlightActivated.current = true
        el.classList.add('spotlight-active')
      }
    })
  }, [])
  useEffect(() => () => {
    if (spotlightRaf.current) cancelAnimationFrame(spotlightRaf.current)
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
      {/* Background — data-bg-layer opts out of .elyra-spotlight's
          content-lifting rule (position:relative + z-index) so this
          absolute layer keeps sizing to the section (see globals.css). */}
      <div className="absolute inset-0" data-bg-layer="">
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

        <KineticHeading
          id="hero-title"
          titleTopKey="titleTop"
          titleAccentKey="titleAccent"
          titleBottomKey="titleBottom"
          className="hero-enter mt-8"
        />

        <p className="hero-enter mt-8 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
          {t('subtitle')}
        </p>

        <div className="hero-enter hero-enter-2 mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            ref={ctaPrimaryRef}
            href="/contact"
            data-cursor="magnet"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
            // Phase 5 WS-6: bind CTA weight to --wght (default 700 when
            // hook hasn't written — covers SSR + touch + reduced).
            style={reduced ? undefined : { fontVariationSettings: '"wght" var(--wght, 700)' }}
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

        {/* WS-1: interactive command console — pure HTML/CSS, protects LCP.
            FIX(2-c/2): `active` pauses the WebGL frameloop while the hero
            is offscreen or the tab is hidden. */}
        <HeroConsole active={active} />

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
