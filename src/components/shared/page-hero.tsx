'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeroAtmosphere } from './hero-atmosphere'

interface PageHeroProps {
  namespace: string
  ctaHref?: string
  className?: string
  /** G3-5 (SO-1): optional per-page decorative motif (aria-hidden is the
   *  CALLER's responsibility — motifs are purely presentational). Rendered
   *  absolutely inside the hero section, after the base gradient layers, so
   *  each service page can carry a signature zone without forking the
   *  generic hero. Keep it reduced-motion safe + RTL safe. */
  decorative?: React.ReactNode
  /** IA — «نَسيم الواجهات»: the living background layer (aurora +
   *  starfield + blueprint + outlined watermark). When present it
   *  replaces the legacy static radial gradient; the fig/spec strings
   *  are Latin technical chrome (homepage idiom — not catalog copy). */
  atmosphere?: {
    fig: string
    spec: string
    word: string
  }
}

/**
 * Dark page hero used across all inner pages (consistent navbar treatment,
 * dramatic design — guide §2 says all heroes are dark).
 *
 * Phase 3 (§4.1): above-the-fold content uses CSS-only entrance keyframes
 * (`hero-enter`) — framer-motion removed, so inner-page LCP paints with the
 * first server-rendered frame. h1/subtitle (LCP candidates) carry no delay.
 */
export function PageHero({ namespace, ctaHref = '/contact', className, decorative, atmosphere }: PageHeroProps) {
  const t = useTranslations(namespace)

  return (
    <section
      className={cn(
        /* MOBILE-2: `page-hero` is a stable MARKER class (zero visual
           change by itself) — the mobile rune tier's CSS in globals.css
           targets it to open the ~120px lower signature band while
           html[data-rune-mobile] is live (see the MOBILE-2 block there). */
        'page-hero',
        /* IA fix — `isolate` creates a stacking context on the section
           itself. WITHOUT it, every negative-z child (the .hero-fallback
           gradient, the atmosphere strata, the service motifs) escapes
           to the ROOT stacking context and paints BEHIND the section's
           own bg-elyra-dark fill — the literal "flat blue wall" the
           owner reported: the fallback gradient was never visible on
           inner pages. isolation:isolate contains the negative-z layer
           INSIDE the section (painted above its background, below the
           in-flow content) with zero z-index side effects on any
           descendant or sibling. */
        'relative isolate overflow-hidden bg-elyra-dark text-elyra-on-dark',
        'pt-32 pb-20 sm:pt-40 sm:pb-28',
        className
      )}
      aria-labelledby="page-hero-title"
    >
      <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
      {atmosphere ? (
        <HeroAtmosphere fig={atmosphere.fig} spec={atmosphere.spec} word={atmosphere.word} />
      ) : (
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(60% 60% at 50% 0%, rgba(66,133,244,0.18), transparent 70%)' }}
          aria-hidden="true"
        />
      )}
      {decorative}
      <div className="elyra-container max-w-4xl text-center">
        <span className="kicker kicker-on-dark hero-enter hero-enter-1">
          {t('kicker')}
        </span>
        <h1
          id="page-hero-title"
          className="hero-enter mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          // wght 700 baseline — matches the home hero's KineticHeading
          // (idle) default; 200 read as a different (thin) brand voice.
          style={{ fontVariationSettings: '"wght" 700' }}
        >
          <span className="block">{t('title')}</span>
          {t.has('titleAccent') ? (
            <span className="block text-primary">{t('titleAccent')}</span>
          ) : null}
        </h1>
        <p className="hero-enter mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
          {t('subtitle')}
        </p>
        {ctaHref && t.has('cta') ? (
          <div className="hero-enter hero-enter-2 mt-10">
            <Link
              href={ctaHref}
              data-cursor="magnet"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
            >
              {t('cta')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
