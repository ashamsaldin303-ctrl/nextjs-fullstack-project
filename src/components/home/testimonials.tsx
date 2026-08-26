'use client'

import { useTranslations } from 'next-intl'
import { Star, Quote } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'

// Phase 2 content enrichment (prompt §6.3): four deeper testimonials,
// each attributed with name / role / company and results-specific quotes.
const ITEMS = ['first', 'second', 'third', 'fourth'] as const

export function Testimonials() {
  const t = useTranslations('testimonials')

  return (
    <section className="elyra-spotlight bg-elyra-deep py-20 text-elyra-on-dark sm:py-28" aria-labelledby="testi-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
          titleId="testi-title"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {ITEMS.map((key, i) => (
            <Reveal key={key} delay={i * 0.08}>
              <figure className="relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md sm:p-7">
                <Quote className="size-8 text-primary/40" aria-hidden="true" />
                {/* FIX(2-c/3): localized rating label (i18n contract: the
                    `rating` key is provided under the testimonials namespace
                    in both catalogs) — was a hardcoded English literal. */}
                <div className="mt-4 flex gap-0.5" role="img" aria-label={t('rating')}>
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} className="size-4 fill-g-yellow text-g-yellow" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-white/85">
                  “{t(`items.${key}.quote`)}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-g-blue text-sm font-bold text-white"
                    aria-hidden="true"
                  >
                    {t(`items.${key}.name`).slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {t(`items.${key}.name`)}
                    </p>
                    <p className="text-xs text-white/60">
                      {t(`items.${key}.role`)}
                    </p>
                    <p className="text-xs font-medium text-primary/90">
                      {t(`items.${key}.company`)}
                    </p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
