import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Mail, MessageCircle, Send, Clock } from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { Reveal } from '@/components/shared/reveal'
import { ContactForm } from '@/components/pages/contact-form'
import { Calculator } from '@/components/home/calculator'
import { buildPageMetadata } from '@/lib/seo'

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

const CHANNELS = [
  { key: 'email' as const, icon: Mail, href: 'mailto:hello@elyra.agency', external: false },
  { key: 'whatsapp' as const, icon: MessageCircle, href: 'https://wa.me/963991000000', external: true },
  { key: 'telegram' as const, icon: Send, href: 'https://t.me/elyra_agency', external: true },
]

export default async function ContactPage() {
  const t = await getTranslations('pages.contact')

  return (
    <>
      <PageHero namespace="pages.contact.hero" />

      {/* Channels + classic form */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="channels-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                  <Reveal key={key} delay={i * 0.06}>
                    <li>
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
                    </li>
                  </Reveal>
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

      {/* Calculator as the fast lane */}
      <section className="bg-elyra-dark py-6 text-elyra-on-dark" aria-labelledby="calc-cta">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <span className="kicker text-primary">{t('calculator.kicker')}</span>
            <h2 id="calc-cta" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t('calculator.title')}
            </h2>
          </Reveal>
        </div>
      </section>

      <Calculator />
    </>
  )
}
