'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Live Damascus clock — editorial "we are here" detail.               */
/* Server renders a neutral placeholder; the real time arrives after  */
/* mount (setState-in-effect), so hydration never mismatches.         */
/* ------------------------------------------------------------------ */
/* W4-05 (plan §2 / decision D5): extracted VERBATIM from
   home/hero.tsx:26-55 — same formatter, same 1s tick, same
   hydration-safe mount gating, same span classes — so the hero kicker
   renders identically (snapshot gate). The footer's status line now
   consumes the same island. The ONE addition is the optional
   `className` prop: hero passes nothing (cn() merges nothing → the
   exact original class string), while the footer line passes text-sm
   so the clock matches its 14px status row; twMerge resolves the
   text-xs/text-sm conflict instead of stacking classes. Reduced
   motion: unchanged from the hero original — the tick is a text-only
   update (no motion), so it is intentionally NOT gated. */
export function DamascusClock({ locale, className }: { locale: string; className?: string }) {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    // L6-R4 (fix 4): ar → LATIN digits via ar-SY-u-nu-latn. The mono face
    // is loaded latin-subset-only, so the default ar-SY Arabic-Indic
    // numerals fell through to a system font (fallback glyphs + a
    // post-hydration font-swap) and clashed with the footer clock /
    // trust-bar counters that already render Latin — three numeral
    // presentations on one page. Latin digits in ar is the site's runtime
    // numeral convention (see trust-bar.tsx). en → plain Latin digits.
    const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SY-u-nu-latn' : 'en-GB', {
      timeZone: 'Asia/Damascus',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const tick = () => setTime(fmt.format(new Date()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [locale])

  return (
    <span dir="ltr" className={cn('font-mono text-xs tabular-nums text-white/55', className)}>
      {time ?? '--:--:--'}
    </span>
  )
}
