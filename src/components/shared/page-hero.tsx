'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeroProps {
  namespace: string
  ctaHref?: string
  className?: string
}

/**
 * Dark page hero used across all inner pages (consistent navbar treatment,
 * dramatic design — guide §2 says all heroes are dark).
 *
 * Phase 3 (§4.1): above-the-fold content uses CSS-only entrance keyframes
 * (`hero-enter`) — framer-motion removed, so inner-page LCP paints with the
 * first server-rendered frame. h1/subtitle (LCP candidates) carry no delay.
 */
export function PageHero({ namespace, ctaHref = '/contact', className }: PageHeroProps) {
  const t = useTranslations(namespace)

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-elyra-dark text-elyra-on-dark',
        'pt-32 pb-20 sm:pt-40 sm:pb-28',
        className
      )}
      aria-labelledby="page-hero-title"
    >
      <div className="hero-fallback absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(60% 60% at 50% 0%, rgba(0,113,227,0.18), transparent 70%)' }}
        aria-hidden="true"
      />
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
        <p className="hero-enter mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl">
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
