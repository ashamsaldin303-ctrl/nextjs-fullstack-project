'use client'

import { useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Scroll-position preservation across an AR↔EN switch (Batch 2 item 11a).
 *
 * next-intl's locale navigation swaps the [locale] segment, and the App
 * Router scrolls to top on commit — the visitor previously lost their
 * place entirely (verified in audit 1-b: switching mid-/contact jumped
 * from scrollY 1567 to 0). The pending offset rides sessionStorage —
 * not component state — so the restore survives even if this subtree
 * remounts across locales: the click handler records window.scrollY
 * together with the locale it is switching FROM, and the effect below
 * (keyed on the live locale) replays the offset once the switched-to
 * locale has settled, after the router's own scroll-to-top.
 */
const SCROLL_RESTORE_KEY = 'elyra:locale-scroll'

function useLocaleSwitch() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const target = locale === 'ar' ? 'en' : 'ar'

  const switchLocale = () => {
    try {
      sessionStorage.setItem(
        SCROLL_RESTORE_KEY,
        JSON.stringify({ from: locale, y: window.scrollY, at: Date.now() })
      )
    } catch {
      /* private mode / storage disabled — restore is best-effort */
    }
    // Preserve the active query string (e.g. calculator presets)
    // WITHOUT useSearchParams — that hook forces client-render
    // bailouts on otherwise-static pages. Reading
    // window.location.search at click time is bailout-free and
    // always current (audit P2).
    const search = window.location.search
    router.replace(search ? `${pathname}${search}` : pathname, {
      locale: target,
    })
  }

  // Restore once the switched-to locale is live. The short timeout
  // defers past the router's commit-time scroll-to-top.
  //
  // StrictMode guard (reactStrictMode: true double-invokes effects in
  // dev): the sessionStorage entry is consumed INSIDE the timeout, not
  // at effect time — the first (discarded) effect run schedules the
  // restore, its cleanup cancels it, and the second run re-reads the
  // still-present entry and re-schedules. A 5s expiry discards stale
  // entries from cancelled switches on later mounts.
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = sessionStorage.getItem(SCROLL_RESTORE_KEY)
    } catch {
      raw = null
    }
    if (raw === null) return
    let from = ''
    let y = 0
    let at = 0
    try {
      const parsed = JSON.parse(raw) as { from?: unknown; y?: unknown; at?: unknown }
      if (typeof parsed.from === 'string') from = parsed.from
      if (typeof parsed.y === 'number' && Number.isFinite(parsed.y)) y = parsed.y
      if (typeof parsed.at === 'number' && Number.isFinite(parsed.at)) at = parsed.at
    } catch {
      return
    }
    // Stale entry (switch never completed) — discard, don't hijack scroll.
    if (at > 0 && Date.now() - at > 5_000) {
      try {
        sessionStorage.removeItem(SCROLL_RESTORE_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    // Only replay when the locale ACTUALLY flipped — a cancelled
    // switch or a stale entry must not hijack the scroll position.
    if (from === locale || y <= 0) return
    const id = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(SCROLL_RESTORE_KEY)
      } catch {
        /* ignore */
      }
      window.scrollTo(0, y)
    }, 150)
    return () => window.clearTimeout(id)
  }, [locale])

  return { locale, target, switchLocale }
}

export function LanguageSwitcher({
  variant = 'on-dark',
  className,
}: {
  variant?: 'on-dark' | 'on-light'
  className?: string
}) {
  const t = useTranslations('nav')
  const { switchLocale } = useLocaleSwitch()

  const onLight = variant === 'on-light'
  // Batch 1 item 4: h-11 (44px) — WCAG 2.5.5 / iOS minimum touch target.
  const base =
    'inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
  const colors = onLight
    ? 'bg-foreground/5 text-foreground hover:bg-foreground/10'
    : 'bg-white/10 text-white hover:bg-white/15'

  return (
    <button
      type="button"
      data-cursor="magnet"
      className={cn(base, colors, className)}
      aria-label={t('switchLocaleLabel')}
      onClick={switchLocale}
    >
      <Globe className="size-4" aria-hidden="true" />
      <span aria-hidden="true">{t('switchLocale')}</span>
    </button>
  )
}

/**
 * Compact AR↔EN toggle for the MOBILE navbar bar (Batch 2 item 11b).
 *
 * The full LanguageSwitcher is `hidden sm:inline-flex` in the navbar, so
 * below sm the language control was previously reachable only inside the
 * hamburger sheet (audit 1-b). This renders the TARGET locale as a short
 * label ("EN" when Arabic is active, "ع" when English is) — same real
 * navigation and scroll-restore semantics as the full switcher, in a
 * 44px icon-button footprint. Base classes keep it `sm:hidden` so the
 * full switcher takes over on desktop and the two never coexist.
 */
export function LanguageToggleCompact({ className }: { className?: string }) {
  const t = useTranslations('nav')
  const { target, switchLocale } = useLocaleSwitch()

  return (
    <button
      type="button"
      data-cursor="magnet"
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:hidden',
        className
      )}
      aria-label={t('languageToggleCompact')}
      onClick={switchLocale}
    >
      {/* Visible label is the target language only — the accessible
          name (aria-label above) carries the full action. */}
      <span aria-hidden="true" lang={target}>
        {target === 'en' ? 'EN' : 'ع'}
      </span>
    </button>
  )
}
