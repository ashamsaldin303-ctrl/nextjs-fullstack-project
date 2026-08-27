import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getDir } from '@/i18n/routing'

/* Batch 3 item 16: recovery destinations — home + the 5 main routes,
   labelled with the existing nav.* keys (no new message keys; the
   labels below are nav-namespace-relative — navT is scoped to 'nav'). */
const RECOVERY_ROUTES = [
  { href: '/' as const, label: 'home' },
  { href: '/services/websites' as const, label: 'websites' },
  { href: '/services/automation' as const, label: 'automation' },
  { href: '/work' as const, label: 'work' },
  { href: '/about' as const, label: 'about' },
  { href: '/contact' as const, label: 'contact' },
]

export default async function NotFound() {
  const t = await getTranslations('common')
  const navT = await getTranslations('nav')
  const locale = await getLocale()
  const isRtl = getDir(locale) === 'rtl'
  const Arrow = isRtl ? ArrowLeft : ArrowRight

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="kicker">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
        {t('notFoundTitle')}
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t('notFoundDesc')}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground transition-transform hover:scale-105"
      >
        {t('backToHome')}
        <Arrow className="size-4" aria-hidden="true" />
      </Link>

      {/* Batch 3 item 16: recovery nav — the 404 previously dead-ended
          with only the home CTA (audit 1-b); these chips catch visitors
          who merely mistyped a section URL. Semantic <nav> labelled by
          the heading; chips are 44px touch targets (Batch 1 item 4) and
          the layout is direction-agnostic (flex + gap, no start/end
          utilities) so RTL needs no mirroring. */}
      <nav aria-labelledby="nf-recovery-heading" className="mt-12 w-full">
        <h2
          id="nf-recovery-heading"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {t('notFoundRecoveryTitle')}
        </h2>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {RECOVERY_ROUTES.map((route) => (
            <li key={route.href}>
              <Link
                href={route.href}
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {navT(route.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
