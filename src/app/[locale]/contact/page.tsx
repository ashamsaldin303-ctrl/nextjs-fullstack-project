import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { Mail, MessageCircle, Send, Clock, Star, Quote } from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { Reveal } from '@/components/shared/reveal'
import { ContactForm, type ContactServiceId } from '@/components/pages/contact-form'
import { CalculatorLazy } from '@/components/home/calculator-lazy'
import { buildPageMetadata } from '@/lib/seo'
import { SITE_CONTACT, SITE_SOCIAL, whatsappDeepLink } from '@/lib/site-config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  // Narrow string → Locale for buildPageMetadata (validity is already
  // guaranteed by the proxy for every reachable route).
  if (!hasLocale(routing.locales, locale)) notFound()
  return buildPageMetadata({
    locale,
    namespace: 'meta.contact',
    path: '/contact',
  })
}

/* ------------------------------------------------------------------ */
/* Prefill URL contract (Batch 2 items 6 + 7a)                         */
/* /contact?service=store|booking|agent|dashboard|automation|websites  */
/*            &idea=<urlencoded text>                                  */
/* ------------------------------------------------------------------ */

const SERVICE_PARAMS: readonly ContactServiceId[] = [
  'store',
  'booking',
  'agent',
  'dashboard',
  'automation',
  'websites',
]

/**
 * Reads + sanitizes the prefill params. `idea` is stripped of the bidi /
 * control characters the lead message schema forbids (a hostile URL must
 * not seed an un-submittable template) and clamped to 300 chars; unknown
 * `service` values are dropped rather than trusted.
 */
function parsePrefill(
  sp: Record<string, string | string[] | undefined>
): { service?: ContactServiceId; idea?: string } {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const rawService = pick(sp.service)
  const service = SERVICE_PARAMS.find((s) => s === rawService)
  const rawIdea = pick(sp.idea)
  const idea = rawIdea?.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 300)
  return { service, idea: idea || undefined }
}

// Channel chip styles read from the centralized site config (audit P1-14).
// UI-5: chipClass gives each channel a static brand-tinted icon chip
// (decorative — icons are aria-hidden; labels/values stay untouched).
// The channel LIST itself is built inside the page because the WhatsApp
// href is now a click-to-chat deep link carrying the localized greeting
// (Batch 2 item 7e).
const CHANNELS = [
  { key: 'email' as const, icon: Mail, href: `mailto:${SITE_CONTACT.email}`, external: false, chipClass: 'bg-primary/10 text-primary group-hover:bg-primary/15' },
  { key: 'whatsapp' as const, icon: MessageCircle, external: true, chipClass: 'bg-g-green/10 text-g-green group-hover:bg-g-green/15' },
  { key: 'telegram' as const, icon: Send, href: SITE_SOCIAL.telegram, external: true, chipClass: 'bg-g-blue/10 text-g-blue group-hover:bg-g-blue/15' },
]

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations('pages.contact')
  // Testimonial + rating copy is reused from the existing catalog
  // (Batch 2 item 7d) — no duplicated content.
  const tTesti = await getTranslations('testimonials')

  const { service, idea } = parsePrefill(await searchParams)

  const channels = CHANNELS.map((c) =>
    c.key === 'whatsapp'
      ? { ...c, href: whatsappDeepLink(t('channels.whatsapp.greeting')) }
      : c
  )

  return (
    <>
      <PageHero namespace="pages.contact.hero" />

      {/* Channels + classic form */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="channels-title">
        <div className="elyra-container max-w-container">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Channels */}
            <div>
              <Reveal>
                <span className="kicker">{t('channels.kicker')}</span>
                <h2 id="channels-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t('channels.title')}
                </h2>
              </Reveal>
              <ul className="mt-8 space-y-3">
                {channels.map(({ key, icon: Icon, href, external, chipClass }, i) => (
                  /* li must be a direct child of ul — Reveal wraps the
                     CONTENT inside the li (Lighthouse a11y: list-item). */
                  <li key={key}>
                    <Reveal delay={i * 0.06}>
                      <a
                        href={href}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                      >
                        <span className={`flex size-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${chipClass}`}>
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-muted-foreground">{t(`channels.${key}.title`)}</span>
                          {/* MED-7: UAX#9 bidi isolation for the value —
                              phone groups and the @handle reorder inside
                              an RTL paragraph. The dir="ltr" sits on an
                              INNER inline span so the outer block keeps
                              the page-direction (start) alignment — a
                              dir on the block itself would left-align
                              the value under a right-aligned label. */}
                          <span className="block font-semibold"><span dir="ltr">{t(`channels.${key}.value`)}</span></span>
                        </span>
                      </a>
                    </Reveal>
                  </li>
                ))}
              </ul>
              <Reveal delay={0.2} variant="right">
                <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  {t('channels.responseNote')}
                </p>
              </Reveal>
            </div>

            {/* Classic form */}
            <div>
              <Reveal>
                <span className="kicker">{t('form.kicker')}</span>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t('form.title')}</h2>
              </Reveal>

              {/* Social proof next to the form (Batch 2 item 7d) — one
                  testimonial reused verbatim from the testimonials catalog
                  plus two case metric badges («متجر لمسة» / «عقار بلس»).
                  RTL-safe: no directional utilities, values isolated via
                  <bdi>. */}
              <Reveal delay={0.06} variant="zoom">
                <figure className="mt-8 rounded-3xl border border-border bg-card p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex gap-0.5" role="img" aria-label={tTesti('rating')}>
                      {[0, 1, 2, 3, 4].map((s) => (
                        <Star key={s} className="size-4 fill-primary text-primary" aria-hidden="true" />
                      ))}
                    </div>
                    <Quote className="size-6 text-primary/40" aria-hidden="true" />
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-foreground/80">
                    “{tTesti('items.first.quote')}”
                  </blockquote>
                  <figcaption className="mt-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{tTesti('items.first.name')}</span>
                    {' · '}
                    {tTesti('items.first.role')}
                    {' · '}
                    {tTesti('items.first.company')}
                  </figcaption>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                    <div className="rounded-2xl bg-primary/5 px-3 py-2.5 text-center">
                      <p className="text-xs font-medium text-muted-foreground">{t('socialProof.metrics.lamsa.company')}</p>
                      <p className="mt-0.5 text-xl font-bold text-primary">
                        <bdi>{t('socialProof.metrics.lamsa.value')}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">{t('socialProof.metrics.lamsa.label')}</p>
                    </div>
                    <div className="rounded-2xl bg-g-green/10 px-3 py-2.5 text-center">
                      <p className="text-xs font-medium text-muted-foreground">{t('socialProof.metrics.aqar.company')}</p>
                      <p className="mt-0.5 text-xl font-bold text-green-700">
                        <bdi>{t('socialProof.metrics.aqar.value')}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">{t('socialProof.metrics.aqar.label')}</p>
                    </div>
                  </div>
                </figure>
              </Reveal>

              <Reveal delay={0.12} className="mt-6">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <ContactForm prefillService={service} prefillIdea={idea} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator as the fast lane — directly embedded, no separate
          dark CTA band needed (the Calculator component already renders
          its own SectionHeading). Phase 5 P1-3: removed the redundant
          133px-tall dark divider band that VLM flagged as "awkward
          horizontal bar with no content" — it duplicated the calculator
          kicker+title that the Calculator component shows anyway.
          Phase 5 WS-8: lazy-loaded to keep framer-motion out of the
          initial bundle on /contact. */}

      <CalculatorLazy />
    </>
  )
}
