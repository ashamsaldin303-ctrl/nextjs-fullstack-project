import { useTranslations } from 'next-intl'
import { PackageCheck, Workflow } from 'lucide-react'
import { Reveal } from '@/components/shared/reveal'
import { SectionHeading } from '@/components/shared/section-heading'

/**
 * Service prose band — Phase 2 content enrichment (prompt §6.4).
 * Adds the two deeper paragraphs ("what's included" / "how we work") to
 * each service page without inventing new services. Server component:
 * translations resolve per-request via getTranslations in the page and
 * namespace switching through useTranslations is not needed here — the
 * parent page passes the resolved strings... but to keep both pages
 * uniform this component reads its own namespace server-side.
 */
export function ServiceProse({ namespace }: { namespace: string }) {
  const t = useTranslations(namespace)

  return (
    <section className="bg-background py-20 sm:py-24" aria-labelledby="prose-title">
      <div className="elyra-container max-w-5xl">
        <SectionHeading kicker={t('kicker')} title={t('title')} kinetic={false} titleId="prose-title" />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-3xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PackageCheck className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                {t('included.title')}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {t('included.desc')}
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="h-full rounded-3xl border border-border bg-card p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Workflow className="size-6" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">
                {t('process.title')}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {t('process.desc')}
              </p>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
