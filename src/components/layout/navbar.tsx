'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { Logo } from '@/components/brand/logo'
import { LanguageSwitcher, LanguageToggleCompact } from './language-switcher'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'
import { getLenis } from '@/lib/lenis-holder'

function navItems(t: ReturnType<typeof useTranslations>) {
  return [
    { href: '/services/websites' as const, label: t('nav.websites') },
    { href: '/services/automation' as const, label: t('nav.automation') },
    { href: '/work' as const, label: t('nav.work') },
    { href: '/about' as const, label: t('nav.about') },
    { href: '/contact' as const, label: t('nav.contact') },
  ]
}

export function Navbar() {
  const t = useTranslations()
  const pathname = usePathname()
  const isRtl = useIsRtl()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    // Initial read — rAF-wrapped, never setState synchronously inside the
    // effect body (react-hooks/set-state-in-effect; same idiom as
    // intro-overlay.tsx). One intentional post-mount render.
    const rafId = window.requestAnimationFrame(onScroll)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const items = navItems(t)

  // Transparent over the hero, glassy dark surface once scrolled (inline
  // utilities — the old .glass-dark class was deleted in L6-F1).
  const surface = scrolled
    ? 'bg-elyra-dark/70 backdrop-blur-xl backdrop-saturate-150 border-b border-white/10'
    : 'bg-transparent border-b border-transparent'

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-colors duration-300">
      <nav
        /* G2-1 F3 (G3-6, deferred by G3-2): the last hand-rolled
           `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` container swaps for the
           site-standard elyra-container + max-w-container system (globals.css
           §WS-0) — same fix G3-2 applied to hero.tsx/simulator-lazy.tsx.
           24/40/64px gutters + the fluid 1152→1568px cap replace the fixed
           1280px cap + 16px mobile gutters; the scrolled glass surface now
           spans the same content measure as every section below it. */
        className={cn(
          'elyra-container max-w-container flex h-16 items-center justify-between',
          surface
        )}
        aria-label={t('nav.ariaLabel')}
      >
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="sr-only">{t('nav.home')}</span>
          {/* AUDIT-A5 NIT (fix 8): aria-hidden on the Logo marks — this
              link already carries its own sr-only accessible name
              (nav.home); without this, AT announced the triple name
              «الرئيسية، إيليرا، Elyra». See logo.tsx for the prop. */}
          <Logo variant="on-dark" aria-hidden />
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative inline-flex h-11 items-center rounded-full px-3 text-sm font-medium transition-colors',
                    active
                      ? 'text-white'
                      : 'text-white/70 hover:text-white'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                  {/* Phase 5 P1-1: prominent active indicator — primary underline
                      that scales in on hover/active. Was previously just a 20%
                      text-opacity shift that VLM could not distinguish. */}
                  <span
                    className={cn(
                      'pointer-events-none absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-primary transition-all',
                      active
                        ? 'opacity-100 scale-x-100'
                        : 'opacity-0 scale-x-0 group-hover:opacity-50 group-hover:scale-x-75'
                    )}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="on-dark" className="hidden sm:inline-flex" />
          {/* Batch 2 item 11b: compact EN/ع toggle on the mobile bar — the
              full switcher only appears at sm+, and before this the
              language control lived solely inside the sheet (audit 1-b).
              Base classes include sm:hidden so it never coexists with
              the full switcher. */}
          <LanguageToggleCompact />
          {/* SOUND-2: the mute toggle was removed — the ambient sound engine
              is now always-on (armed at the first user gesture) and mounts
              app-wide from the root layout (sensory/sound-auto.tsx), not
              here. */}
          <Link
            href="/contact"
            data-cursor="magnet"
            className="hidden h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
          >
            {t('nav.cta')}
          </Link>

          {/* Mobile menu */}
          {/* AUDIT-A5 HIGH (fix 2b) — single-writer scroll discipline for
              the mobile sheet. Radix locks body overflow, but Lenis's
              programmatic wheel writes bypass that lock (live-verified at
              600×800: wheel over the open sheet drove the background
              1500→2665, ESC-close yanked +1500px to Lenis's accumulated
              stale target — the SCROLL-FIX-3 bug class). Pausing Lenis on
              open freezes it AT the real position (stop() runs an internal
              reset(): target = actual, tail killed), and close — ESC,
              backdrop click, SheetClose, ALL routed through onOpenChange —
              also restores it. Belt-and-braces with data-lenis-prevent on
              the sheet surfaces (ui/sheet.tsx), which keeps the sheet's
              own wheel native while open. */}
          <Sheet
            open={open}
            onOpenChange={(next) => {
              if (next) getLenis()?.stop()
              else getLenis()?.start()
              setOpen(next)
            }}
          >
            <SheetTrigger
              className="inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10 md:hidden"
              aria-label={t('nav.openMenu')}
              aria-expanded={open}
            >
              <Menu className="size-5" aria-hidden="true" />
            </SheetTrigger>
            <SheetContent
              side={isRtl ? 'left' : 'right'}
              className="w-[88vw] max-w-sm border-white/10 bg-elyra-dark text-elyra-on-dark sm:w-[420px]"
            >
              <SheetHeader className="flex flex-row items-center justify-between">
                <SheetTitle>
                  <Logo variant="on-dark" />
                </SheetTitle>
                <SheetClose
                  className="inline-flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
                  aria-label={t('nav.closeMenu')}
                >
                  <X className="size-5" aria-hidden="true" />
                </SheetClose>
              </SheetHeader>
              <div className="mt-6 flex h-full flex-col">
                <ul className="flex flex-col gap-1">
                  {items.map((item) => {
                    const active = pathname === item.href
                    return (
                      <li key={item.href}>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            data-cursor="magnet"
                            className={cn(
                              'group relative flex min-h-12 items-center overflow-hidden rounded-xl px-4 py-3 text-base transition-colors',
                              active
                                /* MED-2: token-driven active pill. The g-* names
                                   are palette-neutral aliases — --g-blue now
                                   resolves to Google blue (#4285F4) after the
                                   blue palette revert, so the pill and
                                   its ring auto-followed the rebrand with no
                                   change here. Text stays full white: the tinted
                                   pill over #0F172A is a low-contrast surface,
                                   so white (~14.7:1) keeps AA and mirrors the
                                   desktop active treatment (white text +
                                   colored indicator). */
                                ? 'bg-g-blue/15 text-white ring-1 ring-g-blue/40'
                                : 'text-white/80 hover:bg-white/5 hover:text-white'
                            )}
                            aria-current={active ? 'page' : undefined}
                          >
                            {item.label}
                            {/* Phase 5 P1-1: prominent active indicator — thick
                                primary bar on the start side (RTL-correct via
                                inset-inline-start) with a soft glow. Was h-0.5
                                (2px) at bottom which VLM could not see. */}
                            {active ? (
                              <span
                                className="pointer-events-none absolute inset-y-2 start-0 w-1 rounded-full bg-g-blue shadow-[0_0_12px_var(--color-g-blue)]"
                                aria-hidden="true"
                              />
                            ) : null}
                          </Link>
                        </SheetClose>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-auto flex flex-col gap-3 pt-6">
                  <LanguageSwitcher variant="on-dark" />
                  <SheetClose asChild>
                    <Link
                      href="/contact"
                      className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-base font-medium text-primary-foreground"
                    >
                      {t('nav.cta')}
                    </Link>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
