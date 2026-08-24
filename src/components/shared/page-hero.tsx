'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { KineticWords } from './reveal'
import { cn } from '@/lib/utils'

interface PageHeroProps {
  namespace: string
  ctaHref?: string
  className?: string
}

/**
 * Dark page hero used across all inner pages (consistent navbar treatment,
 * dramatic design — guide §2 says all heroes are dark).
 */
export function PageHero({ namespace, ctaHref = '/contact', className }: PageHeroProps) {
  const t = useTranslations(namespace)
  const reduced = useReducedMotion()

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
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.span
          className="kicker text-primary"
          initial={reduced ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {t('kicker')}
        </motion.span>
        <h1
          id="page-hero-title"
          className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ fontVariationSettings: '"wght" 200' }}
        >
          <span className="block">
            <KineticWords text={t('title')} />
          </span>
          {t.has('titleAccent') ? (
            <span className="block text-primary">
              <KineticWords text={t('titleAccent')} />
            </span>
          ) : null}
        </h1>
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg md:text-xl"
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
        >
          {t('subtitle')}
        </motion.p>
        {ctaHref && t.has('cta') ? (
          <motion.div
            className="mt-10"
            initial={reduced ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <Link
              href={ctaHref}
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
            >
              {t('cta')}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          </motion.div>
        ) : null}
      </div>
    </section>
  )
}
