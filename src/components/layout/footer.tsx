import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/brand/logo'
import { LiveClock } from './live-clock'
import { CopyrightYear } from './copyright-year'
import { DamascusClock } from './damascus-clock'
import { Mail, MessageCircle, Send, Github, Linkedin, Instagram } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITE_CONTACT, SITE_SOCIAL } from '@/lib/site-config'

/* UI-5: column headings carry a tiny primary accent tick (2×12px,
   decorative) before the text — shared by all three footer columns.
   Batch 1 item 5 (dark-band contrast floor): white/50 → white/70
   (≈10.9:1 on #0F172A); text-xs uppercase tracking-wider kept. */
function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-white/70">
      <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-primary" />
      {children}
    </h2>
  )
}

/* W4-05 (plan §2 / decision D5): the footer's second moment — a giant
   stroke-only ELYRA wordmark + a one-line status readout (live Damascus
   time + studio coordinates) sitting above the utility grid. The mark is
   a sanctioned LATIN island (lang="en" dir="ltr", like the hero watermark
   and hb-labels — the universal :lang(ar) letter-spacing reset exempts
   it, so its -0.03em tracking applies in AR too, and Inter is pinned via
   the --font-inter variable so AR/EN render the identical glyph shapes).
   Decorative: aria-hidden + exempt from 4.5:1 (1px white/12% stroke; the
   @supports fallback fills at white/8% for engines without
   -webkit-text-stroke). All static SSR — the fixed clamp() guarantees
   zero CLS; the ONLY client island is DamascusClock (its
   '--:--:--' placeholder swaps to the time at the same tabular-mono
   width, exactly like the hero kicker). Reduced-motion: nothing here
   animates — the clock's tick is a text-only update (hero-verbatim
   behavior). No i18n keys: the mark is bilingual-by-design Latin. */
function FooterWordmark() {
  /* Base = the no-stroke fallback (fill white/8%); browsers that DO
     support -webkit-text-stroke flip to transparent + the 1px
     white/12% stroke — the plan's @supports-not pattern expressed
     as a positive supports-[] variant pair. */
  return (
    <div
      aria-hidden="true"
      lang="en"
      dir="ltr"
      className={cn(
        'select-none',
        '[font-family:var(--font-inter),system-ui,sans-serif]',
        '[font-size:clamp(4rem,13vw,16rem)]',
        'font-black leading-[0.8] tracking-[-0.03em]',
        'text-[rgba(255,255,255,0.08)]',
        'supports-[(-webkit-text-stroke:1px_black)]:text-transparent',
        'supports-[(-webkit-text-stroke:1px_black)]:[-webkit-text-stroke:1px_rgba(255,255,255,0.12)]'
      )}
    >
      ELYRA
    </div>
  )
}

export function Footer({ locale, className }: { locale: string; className?: string }) {
  // L6-R6 P3: the footer is now a SERVER component — useTranslations
  // resolves per-request exactly like ServiceProse/Logo (the proven
  // shared-component pattern). The only runtime-clock value (the
  // copyright year) lives in the tiny CopyrightYear client island;
  // LiveClock was already its own client component. W4-05: the status
  // line adds the DamascusClock island — the locale arrives as a prop
  // from [locale]/layout.tsx (which already awaits+validates it), so
  // this component stays sync: mixing an awaited getLocale() with the
  // sync useTranslations() hook trips React's "suspended thenable"
  // contract (measured — 500 on /ar), while the prop keeps the proven
  // RSC pattern untouched.
  const t = useTranslations()

  return (
    <footer
      className={cn(
        'bg-elyra-dark text-elyra-on-dark',
        'pb-[env(safe-area-inset-bottom)]',
        'mt-auto',
        className
      )}
    >
      {/* UI-5: gradient hairline replaces the plain border-t — a 1px
          primary glow fading out at both edges (symmetric, RTL-safe). */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />

      {/* W4-05 second moment: wordmark + status line (see FooterWordmark
          comment for the full rationale). The status line wraps below
          ~330px content (gap-y-2) so the 320px gate stays zero-overflow;
          at ≥375px it is a single row exactly per spec (gap-6). */}
      <div className="elyra-container max-w-container pt-16">
        <FooterWordmark />
        <div
          dir="ltr"
          className="elyra-mono mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55 tabular-nums"
        >
          <DamascusClock locale={locale} className="text-sm" />
          <span>33.5138° N, 36.2765° E</span>
        </div>
      </div>

      <div className="elyra-container max-w-container py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand block */}
          <div className="lg:col-span-5">
            <Logo variant="on-dark" />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
              {t('footer.tagline')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-g-green" />
                </span>
                <span className="text-white/80">{t('footer.availability')}</span>
              </span>
              <LiveClock variant="on-dark" />
            </div>
          </div>

          {/* Quick links */}
          <nav className="lg:col-span-3" aria-label={t('footer.quickLinks')}>
            <FooterHeading>{t('footer.quickLinks')}</FooterHeading>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/" className="text-white/80 transition-colors hover:text-white">
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link href="/work" className="text-white/80 transition-colors hover:text-white">
                  {t('nav.work')}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-white/80 transition-colors hover:text-white">
                  {t('nav.about')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-white/80 transition-colors hover:text-white">
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Services */}
          <nav className="lg:col-span-2" aria-label={t('footer.servicesTitle')}>
            <FooterHeading>{t('footer.servicesTitle')}</FooterHeading>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href="/services/websites" className="text-white/80 transition-colors hover:text-white">
                  {t('footer.websitesLink')}
                </Link>
              </li>
              <li>
                <Link href="/services/automation" className="text-white/80 transition-colors hover:text-white">
                  {t('footer.automationLink')}
                </Link>
              </li>
            </ul>
          </nav>

          {/* Connect */}
          <div className="lg:col-span-2">
            <FooterHeading>{t('footer.connectTitle')}</FooterHeading>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={`mailto:${SITE_CONTACT.email}`}
                  className="inline-flex items-center gap-2 text-white/80 transition-colors hover:text-white"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  {SITE_CONTACT.email}
                </a>
              </li>
              <li>
                <a
                  href={SITE_SOCIAL.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-white/80 transition-colors hover:text-white"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Telegram
                </a>
              </li>
            </ul>
            {/* L1-D P3 (fix 2-d): 44px touch targets (size-9 → size-11)
                matching the navbar/CTA standard; gap-3 → gap-2.5 compensates
                so the 5-icon row grows only 32px inside the connect column. */}
            <ul className="mt-4 flex gap-2.5">
              <li>
                <a
                  href={SITE_SOCIAL.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.social.telegram')}
                  data-cursor="external"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-g-blue/20 hover:text-white"
                >
                  <Send className="size-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_SOCIAL.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.social.whatsapp')}
                  data-cursor="external"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-g-green/20 hover:text-white"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_SOCIAL.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.social.instagram')}
                  data-cursor="external"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-g-red/20 hover:text-white"
                >
                  <Instagram className="size-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_SOCIAL.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.social.linkedin')}
                  data-cursor="external"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-primary/20 hover:text-white"
                >
                  <Linkedin className="size-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_SOCIAL.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.social.github')}
                  data-cursor="external"
                  className="inline-flex size-11 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <Github className="size-4" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Batch 1 item 5: bottom legal row lifted to the same white/70
            floor (white/50 measured ≈5.2:1 — legal text deserves the
            same margin as the headings). */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/70 sm:flex-row">
          <p><CopyrightYear /></p>
          <p>{t('footer.madeWith')}</p>
        </div>
      </div>
    </footer>
  )
}
