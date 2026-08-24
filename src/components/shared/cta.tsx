'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { Reveal } from './reveal'
import { cn } from '@/lib/utils'

interface CTAProps {
  namespace: string
  variant?: 'on-light' | 'on-dark'
  href?: string
  className?: string
}

/**
 * Reusable end-of-page call-to-action. Reads title/subtitle/button from a
 * given i18n namespace path, e.g. "pages.websites.cta".
 *
 * The section is named implicitly by its <h2> (no redundant aria-label —
 * audit P1-5), and the button uses a single ArrowRight glyph that flips via
 * `rtl:rotate-180` (audit P1-8: no double-reversal).
 */
export function CTA({
  namespace,
  variant = 'on-light',
  href = '/contact',
  className,
}: CTAProps) {
  const t = useTranslations(namespace)
  const onDark = variant === 'on-dark'

  return (
    <section
      className={cn(
        'py-20 sm:py-24',
        onDark ? 'bg-elyra-dark text-elyra-on-dark' : 'bg-background text-foreground',
        className
      )}
    >
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2
            className={cn(
              'text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl',
              onDark ? 'text-white' : 'text-foreground'
            )}
          >
            {t('title')}
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p
            className={cn(
              'mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg',
              onDark ? 'text-white/70' : 'text-muted-foreground'
            )}
          >
            {t('subtitle')}
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <Link
            href={href}
            data-cursor="magnet"
            className={cn(
              'group mt-8 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-medium transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              onDark
                ? 'bg-primary text-primary-foreground focus-visible:ring-offset-elyra-dark'
                : 'bg-primary text-primary-foreground focus-visible:ring-offset-background'
            )}
          >
            {t('button')}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
