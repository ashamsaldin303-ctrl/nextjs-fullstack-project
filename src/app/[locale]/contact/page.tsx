import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Mail, MessageCircle, Send, Clock } from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { Reveal } from '@/components/shared/reveal'
import { ContactForm } from '@/components/pages/contact-form'
import { Calculator } from '@/components/home/calculator'
import { buildPageMetadata } from '@/lib/seo'
import { SITE_CONTACT, SITE_SOCIAL } from '@/lib/site-config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    locale,
    namespace: 'meta.contact',
    path: '/contact',
  })
}

// Channel links read from the centralized site config (audit P1-14).
const CHANNELS = [
  { key: 'email' as const, icon: Mail, href: `mailto:${SITE_CONTACT.email}`, external: false },
  { key: 'whatsapp' as const, icon: MessageCircle, href: SITE_SOCIAL.whatsapp, external: true },
  { key: 'telegram' as const, icon: Send, href: SITE_SOCIAL.telegram, external: true },
]

export default async function ContactPage() {
  const t = await getTranslations('pages.contact')

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
                {CHANNELS.map(({ key, icon: Icon, href, external }, i) => (
                  /* li must be a direct child of ul — Reveal wraps the
                     CONTENT inside the li (Lighthouse a11y: list-item). */
                  <li key={key}>
                    <Reveal delay={i * 0.06}>
                      <a
                        href={href}
                        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
                      >
                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium text-muted-foreground">{t(`channels.${key}.title`)}</span>
                          <span className="block font-semibold">{t(`channels.${key}.value`)}</span>
                        </span>
                      </a>
                    </Reveal>
                  </li>
                ))}
              </ul>
              <Reveal delay={0.2}>
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
              <Reveal delay={0.1} className="mt-8">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
                  <ContactForm />
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
          kicker+title that the Calculator component shows anyway. */}

      <Calculator />
    </>
  )
}
