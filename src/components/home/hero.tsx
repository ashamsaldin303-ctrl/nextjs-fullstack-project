'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'
import { KineticWords } from '@/components/shared/reveal'

const HeroCanvas = dynamic(
  () => import('./hero-canvas').then((m) => m.HeroCanvas),
  {
    ssr: false,
    loading: () => <div className="hero-fallback absolute inset-0" />,
  }
)

export function Hero() {
  const t = useTranslations('hero')
  const reduced = useReducedMotion()

  const heroRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState(true)

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

  // Respect reduced-motion: render only the static gradient fallback.
  const show3D = !reduced

  return (
    <section
      ref={heroRef}
      className="relative min-h-[100svh] overflow-hidden bg-elyra-dark text-elyra-on-dark"
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

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col items-center justify-center px-4 pt-24 pb-20 text-center sm:px-6 lg:px-8">
        <motion.span
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/85 backdrop-blur-sm sm:text-sm"
          initial={reduced ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="size-1.5 rounded-full bg-g-green" aria-hidden="true" />
          {t('badge')}
        </motion.span>

        <h1
          id="hero-title"
          className="mt-8 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
          style={{ fontVariationSettings: '"wght" 200' }}
        >
          <span className="block">
            <KineticWords text={t('titleTop')} />
          </span>
          <span className="block text-primary">
            <KineticWords text={t('titleAccent')} />
          </span>
          <span className="block">
            <KineticWords text={t('titleBottom')} />
          </span>
        </h1>

        <motion.p
          className="mt-8 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl"
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {t('subtitle')}
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <Link
            href="/contact"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
          >
            {t('ctaPrimary')}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link
            href="/work"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-base font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
          >
            <Play className="size-4" aria-hidden="true" />
            {t('ctaSecondary')}
          </Link>
        </motion.div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50"
          initial={reduced ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.2 }}
        >
          <span className="flex flex-col items-center gap-1">
            <span>{t('scroll')}</span>
            <span
              className="block h-8 w-px bg-gradient-to-b from-white/40 to-transparent"
              aria-hidden="true"
            />
          </span>
        </motion.div>
      </div>
    </section>
  )
}
