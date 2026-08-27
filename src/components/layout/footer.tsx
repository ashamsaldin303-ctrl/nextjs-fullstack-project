'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/brand/logo'
import { LiveClock } from './live-clock'
import { Mail, MessageCircle, Send, Github, Linkedin, Instagram } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITE_CONTACT, SITE_SOCIAL } from '@/lib/site-config'

const subscribeNoop = () => () => {}
// Quick win (prompt §8.2): dynamic server year — hydration stays safe
// because useSyncExternalStore renders the server snapshot during
// hydration, then re-renders with the client value if it differs.
const getServerYear = () => new Date().getFullYear()

function getClientYear(): number {
  return new Date().getFullYear()
}

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

export function Footer({ className }: { className?: string }) {
  const t = useTranslations()
  // Hydration-safe year (guide §1.6 + audit P1-9): useSyncExternalStore keeps
  // the server snapshot constant (no mismatch) while the client reads the
  // real clock — and avoids setState-in-effect cascading renders.
  const year = useSyncExternalStore(subscribeNoop, getClientYear, getServerYear)

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
          <p>{t('footer.rights', { year })}</p>
          <p>{t('footer.madeWith')}</p>
        </div>
      </div>
    </footer>
  )
}
