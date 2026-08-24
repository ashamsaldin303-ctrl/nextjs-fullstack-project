import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { type LucideIcon } from 'lucide-react'
import {
  Users, FileText, Mail, Send, Table, Bot, CreditCard, Database,
} from 'lucide-react'
import { PageHero } from '@/components/shared/page-hero'
import { CTA } from '@/components/shared/cta'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { AutomationSimulator } from '@/components/home/automation-simulator'
import { buildPageMetadata } from '@/lib/seo'

const INTEGRATIONS: { key: string; icon: LucideIcon }[] = [
  { key: 'crm', icon: Users },
  { key: 'invoicing', icon: FileText },
  { key: 'email', icon: Mail },
  { key: 'telegram', icon: Send },
  { key: 'sheets', icon: Table },
  { key: 'ai', icon: Bot },
  { key: 'payments', icon: CreditCard },
  { key: 'databases', icon: Database },
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return buildPageMetadata({
    locale,
    namespace: 'meta.automation',
    path: '/services/automation',
  })
}

export default async function AutomationPage() {
  const t = await getTranslations('pages.automation')

  return (
    <>
      <PageHero namespace="pages.automation.hero" />

      {/* Integrations grid */}
      <section className="bg-background py-20 sm:py-28" aria-labelledby="int-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker={t('integrations.kicker')}
            title={t('integrations.title')}
            subtitle={t('integrations.note')}
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INTEGRATIONS.map(({ key, icon: Icon }, i) => (
              <Reveal key={key} delay={(i % 4) * 0.06}>
                <article className="group h-full rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-semibold">{t(`integrations.items.${key}.title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`integrations.items.${key}.desc`)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* "This site runs on n8n" */}
      <section className="bg-elyra-dark py-20 text-elyra-on-dark sm:py-28" aria-labelledby="n8n-title">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            kicker={t('runsOnN8n.kicker')}
            title={t('runsOnN8n.title')}
            subtitle={t('runsOnN8n.desc')}
            variant="on-dark"
          />
          <Reveal className="mt-12">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              {[
                { label: t('runsOnN8n.flow.request'), color: 'bg-primary/20 border-primary/40' },
                { label: t('runsOnN8n.flow.webhook'), color: 'bg-g-yellow/15 border-g-yellow/40' },
                { label: t('runsOnN8n.flow.actions'), color: 'bg-g-green/15 border-g-green/40' },
              ].map((node, i, arr) => (
                <div key={node.label} className="flex flex-1 items-center gap-3">
                  <div className={`flex-1 rounded-2xl border ${node.color} px-4 py-5 text-center text-sm font-medium backdrop-blur-sm`}>
                    {node.label}
                  </div>
                  {i < arr.length - 1 ? (
                    <span className="hidden text-white/40 sm:inline" aria-hidden="true">→</span>
                  ) : null}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15} className="mt-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-g-green/30 bg-g-green/10 px-4 py-1.5 text-sm text-g-green">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-g-green" />
              </span>
              {t('runsOnN8n.badge')}
            </span>
          </Reveal>
        </div>
      </section>

      {/* Extended simulator with scenarios */}
      <AutomationSimulator showScenarioPicker />

      <CTA namespace="pages.automation.cta" />
    </>
  )
}
