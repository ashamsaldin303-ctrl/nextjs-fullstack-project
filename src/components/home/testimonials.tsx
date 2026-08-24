'use client'

import { useTranslations } from 'next-intl'
import { Star, Quote } from 'lucide-react'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'

const ITEMS = ['first', 'second', 'third'] as const

export function Testimonials() {
  const t = useTranslations('testimonials')

  return (
    <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="testi-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          variant="on-dark"
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {ITEMS.map((key, i) => (
            <Reveal key={key} delay={i * 0.1}>
              <figure className="relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md sm:p-8">
                <Quote className="size-8 text-primary/40" aria-hidden="true" />
                <div className="mt-4 flex gap-0.5" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} className="size-4 fill-g-yellow text-g-yellow" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-white/85">
                  “{t(`items.${key}.quote`)}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                  <div
                    className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-g-blue text-sm font-bold text-white"
                    aria-hidden="true"
                  >
                    {t(`items.${key}.name`).slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {t(`items.${key}.name`)}
                    </p>
                    <p className="text-xs text-white/60">
                      {t(`items.${key}.role`)}
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
