'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { Logo } from '@/components/brand/logo'
import { LanguageSwitcher } from './language-switcher'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'

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
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const items = navItems(t)

  // Transparent over the hero, glass-dark once scrolled.
  const surface = scrolled
    ? 'bg-elyra-dark/70 backdrop-blur-xl border-b border-white/10'
    : 'bg-transparent border-b border-transparent'

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-colors duration-300">
      <nav
        className={cn('mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8', surface)}
        aria-label={t('nav.ariaLabel')}
      >
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          <span className="sr-only">{t('nav.home')}</span>
          <Logo variant="on-dark" />
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
                    'inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-white/80 transition-colors hover:text-white',
                    active && 'text-white'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="on-dark" className="hidden sm:inline-flex" />
          <Link
            href="/contact"
            data-cursor="magnet"
            className="hidden h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
          >
            {t('nav.cta')}
          </Link>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10 md:hidden"
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
                  className="inline-flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10"
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
                              'group relative flex min-h-11 items-center overflow-hidden rounded-xl px-4 text-base text-white/80 transition-colors hover:bg-white/5 hover:text-white',
                              active && 'bg-white/10 text-white'
                            )}
                            aria-current={active ? 'page' : undefined}
                          >
                            {item.label}
                            {/* WS-0 §3.5: active indicator — primary bottom bar */}
                            {active ? (
                              <span
                                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
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
