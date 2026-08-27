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
        {/* UI-5: very subtle radial accent behind the grid — the container
            is a stacking context (elyra-spotlight forces position:relative
            + z-index:1 on direct children), so -z-10 paints it above the
            section background but below all in-flow content. Decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 mx-auto h-80 max-w-4xl rounded-full bg-primary/10 blur-3xl"
        />
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
              {/* UI-5: hover depth — border tint + gentle lift + shadow
                  deepening. Purely decorative (transition-all is collapsed
                  to ~0ms under prefers-reduced-motion by the global
                  override in globals.css). */}
              <figure className="group relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/30 hover:bg-white/[0.06] hover:shadow-[0_24px_48px_-20px_rgba(0,0,0,0.6)] sm:p-7">
                <Quote className="size-8 text-primary/40 transition-colors duration-300 group-hover:text-primary/60" aria-hidden="true" />
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
                    {/* MED-2: the amber accent carried by the legacy g-blue
                        token (#D97706) on the same surface is ≈6.3:1 ✓. */}
                    <p className="text-xs font-medium text-g-blue">
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
