'use client'

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import {
  Globe, Workflow, Boxes, Bot, Sparkles,
  Check, Play, RotateCw,
  ShoppingCart, ShoppingBag, Search, Lock,
  Inbox, Database, Send, Clock, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from '@/i18n/navigation'
import { useIsRtl } from '@/lib/use-rtl'
import { SectionHeading } from '@/components/shared/section-heading'
import { Reveal } from '@/components/shared/reveal'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import { asProducts, asStringArray, discountPct } from '@/lib/catalog-guards'

/** Bento card with cursor-following radial glow (works in RTL & LTR). */
function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // FIX(2-c/4): rAF-coalesced — the rect read + --mx/--my writes happen
  // ONCE per frame using the latest event, not once per pointermove.
  // With no new events the callback never reschedules (idle at zero cost).
  const latestPointer = useRef<React.PointerEvent<HTMLDivElement> | null>(null)
  const glowRaf = useRef(0)
  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    latestPointer.current = e
    if (glowRaf.current) return
    glowRaf.current = requestAnimationFrame(() => {
      glowRaf.current = 0
      const el = ref.current
      const ev = latestPointer.current
      if (!el || !ev) return
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - rect.left}px`)
      el.style.setProperty('--my', `${ev.clientY - rect.top}px`)
    })
  }, [])
  useEffect(
    () => () => {
      if (glowRaf.current) cancelAnimationFrame(glowRaf.current)
    },
    []
  )

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn(
        'glow-cursor group relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8',
        className
      )}
    >
      {children}
    </div>
  )
}

/* =========================================================================
   Mini interactive 1 — websites theme playground (mini e-commerce site)
   ========================================================================= */

const SITE_PALETTE = ['#0071E3', '#34A853', '#EA4335', '#4285F4'] as const

/* Contrast-safe accent derivations (module scope, pure & deterministic —
   identical on server & client, so no hydration risk).
   The mini-site CTA / badges render WHITE text on the accent and several
   strings render as accent-colored TEXT on the dark browser panel — neither
   pair passes WCAG AA for every swatch (the lighter swatches being the
   worst offenders: white on #4285F4 is ~3.1:1). Instead of a blanket dark
   overlay, each fixed palette entry is mixed toward black (white-text
   surfaces) or toward white (accent text) in 2% steps until the pair clears
   4.54:1 (AA + margin). */

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}
function mixToward(hex: string, towardWhite: boolean, f: number): string {
  const [r, g, b] = hexToRgb(hex)
  const ch = (c: number) => Math.round(towardWhite ? c + (255 - c) * f : c * (1 - f))
  return rgbToHex(ch(r), ch(g), ch(b))
}
/** Darken the accent until WHITE text on it clears AA — used for the CTA,
 *  cart badge and discount badges (keeps #0071E3 untouched: 4.5:1 already). */
function ctaSafe(hex: string): string {
  for (let f = 0; f <= 0.9; f += 0.02) {
    const c = mixToward(hex, false, f)
    if (contrastRatio(relLuminance(hexToRgb(c)), 1) >= 4.54) return c
  }
  return mixToward(hex, false, 0.9)
}
/** Lighten the accent until it reads AA as TEXT on the dark panel. The
 *  worst-case backdrop is the panel tinted 20% with the accent itself
 *  (chips / addToCart tint) — bg-elyra-dark/95 over a white card ≈ #1B2335. */
function panelTextSafe(hex: string): string {
  const [pr, pg, pb] = hexToRgb('#1B2335')
  const [ar, ag, ab] = hexToRgb(hex)
  const tinted = relLuminance([
    Math.round(pr * 0.8 + ar * 0.2),
    Math.round(pg * 0.8 + ag * 0.2),
    Math.round(pb * 0.8 + ab * 0.2),
  ])
  for (let f = 0; f <= 0.9; f += 0.02) {
    const c = mixToward(hex, true, f)
    if (contrastRatio(relLuminance(hexToRgb(c)), tinted) >= 4.54) return c
  }
  return mixToward(hex, true, 0.9)
}
const SITE_CTA = SITE_PALETTE.map(ctaSafe)
const SITE_PANEL_TEXT = SITE_PALETTE.map(panelTextSafe)

/* discountPct — now the SHARED guarded helper from @/lib/catalog-guards
   (number|null contract; L6-R2 dedup — this local copy returned 0 instead
   of null and used Number instead of parseInt). */

/* G3-6 flagship port: slim browser chrome strip for the storefront
   preview — the G3-3 before-after.tsx BrowserChrome PATTERN (physical LTR
   window chrome that never mirrors with page direction; URL pill held
   optically centered by a trailing counterweight), re-created LOCALLY at
   the MiniSite's dark-world scale: before-after's version is scene-scale
   (5px micro type, stone palette) and belongs to /work's frames. Consumes
   the same g-* traffic-light tokens the old inline chrome used, plus the
   same hardcoded mock domain — no catalog surface (inside aria-hidden). */
function BrowserChromeStrip({ domain }: { domain: string }) {
  return (
    <div
      dir="ltr"
      className="flex h-7 shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.04] px-2.5"
    >
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="size-2 rounded-full bg-g-red/90" />
        <span className="size-2 rounded-full bg-g-yellow/90" />
        <span className="size-2 rounded-full bg-g-green/90" />
      </div>
      <div className="mx-auto flex h-5 min-w-0 max-w-[60%] items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2">
        <Lock className="size-2.5 shrink-0 text-g-green" />
        <span className="min-w-0 truncate text-[9px] font-medium leading-none text-white/70">{domain}</span>
      </div>
      {/* trailing counterweight keeps the URL pill optically centered */}
      <span className="w-9 shrink-0" />
    </div>
  )
}

function MiniSite() {
  const t = useTranslations('bento.websites.mini')
  const [swatch, setSwatch] = useState(0)
  const accent = SITE_PALETTE[swatch] ?? '#0071E3'
  // L6-R2 (fix 6): runtime-narrowed catalog reads (was bare `as` casts —
  // a drifted catalog shape would crash the card instead of degrading).
  const nav = asStringArray(t.raw('nav'))
  const paletteNames = asStringArray(t.raw('palette'))
  const products = asProducts(t.raw('products'))
  // Accent-derived CSS vars: every element below restyles through these, so a
  // swatch click animates atomically via transition-colors on each consumer.
  const vars = {
    '--accent': accent,
    '--accent-cta': SITE_CTA[swatch] ?? accent,
    '--accent-text': SITE_PANEL_TEXT[swatch] ?? accent,
  } as CSSProperties

  return (
    <div>
      {/* caption zone — the playground's label + how-to. Carries the card's
          own gutters (px-6/8) so it aligns with the padded top half while the
          panel below bleeds edge-to-edge (G3-6 flagship composition). */}
      <div className="px-6 pb-4 sm:px-8">
        <p className="text-xs font-medium text-foreground/80">{t('title')}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('hint')}</p>
      </div>

      {/* The mini browser is an illustration (decorative mock storefront) —
          aria-hidden keeps its ~25 mock strings out of the SR tree; the
          interactive control is the swatch row + its real caption below.
          G3-6 flagship port: EDGE-TO-EDGE — no rounded corners or border of
          its own (the card's rounded-3xl + overflow-hidden clips the bleed),
          spanning the card's full width in its lower half. */}
      <div
        aria-hidden="true"
        className="select-none bg-elyra-dark/95 text-elyra-on-dark"
        style={vars}
      >
        {/* Slim browser chrome strip (G3-3 pattern, local — see above) */}
        <BrowserChromeStrip domain="lamsa-store.com" />

        {/* Announcement strip (doubles as the live line): accent tint +
            accent text + pulsing viewer dot */}
        <div className="flex items-center justify-center gap-1.5 border-b border-white/5 bg-[color:color-mix(in_srgb,var(--accent)_13%,transparent)] px-2 py-1 transition-colors duration-300">
          <span className="relative flex size-1.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-g-green/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-g-green" />
          </span>
          <span className="truncate text-[9px] font-bold text-[color:var(--accent-text)] transition-colors duration-300">
            {t('viewers')}
          </span>
        </div>

        {/* Navbar: brand + links + search pill + cart */}
        <div className="flex items-center gap-2.5 border-b border-white/5 px-3 py-2">
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="size-2 rounded-full bg-[color:var(--accent)] transition-colors duration-300" />
            <span className="text-[11px] font-extrabold text-white">{t('brand')}</span>
          </span>
          <nav className="hidden items-center gap-2.5 min-[440px]:flex">
            {nav.map((item) => (
              <span
                key={item}
                className="cursor-pointer text-[10px] text-white/70 transition-colors duration-300 hover:text-[color:var(--accent-text)]"
              >
                {item}
              </span>
            ))}
          </nav>
          <span className="ms-auto hidden items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 min-[400px]:flex">
            <Search className="size-2.5 shrink-0 text-white/50" />
            <span className="max-w-20 truncate text-[9px] text-white/55">{t('search')}</span>
          </span>
          <span className="relative shrink-0 text-white/80">
            <ShoppingCart className="size-3.5" />
            <span className="absolute -end-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[color:var(--accent-cta)] text-[9px] font-bold leading-none text-white transition-colors duration-300">
              2
            </span>
          </span>
        </div>

        {/* Hero: kicker chip + title + sub + CTA/link + product image block */}
        <div className="flex gap-3 px-3 pb-2.5 pt-2.5">
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--accent)_18%,transparent)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--accent-text)] transition-colors duration-300">
              {t('kicker')}
            </span>
            <p className="mt-1.5 text-[13px] font-extrabold leading-snug text-white">{t('heroTitle')}</p>
            <p className="mt-1 text-[10px] leading-snug text-white/70">{t('heroSub')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent-cta)] px-2.5 py-1 text-[10px] font-bold text-white transition-colors duration-300">
                <ShoppingBag className="size-3" />
                {t('heroCta')}
              </span>
              <span className="cursor-pointer text-[10px] text-white/80 underline decoration-[color:var(--accent)] decoration-2 underline-offset-2 transition-colors duration-300 hover:text-[color:var(--accent-text)]">
                {t('heroLink')}
              </span>
            </div>
          </div>
          <div className="relative h-[5.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-[color:color-mix(in_srgb,var(--accent)_24%,transparent)] transition-colors duration-300 sm:h-24 sm:w-20">
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.16), rgba(0,0,0,0.3))' }}
            />
            {/* CSS product silhouette — concentric rounded shapes */}
            <span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
            <span className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/10" />
            <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50" />
          </div>
        </div>

        {/* Product row */}
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
          {products.map((p, idx) => {
            const off = discountPct(p.price, p.old)
            return (
              <div key={p.name} className="min-w-0">
                <div className="relative h-12 overflow-hidden rounded-md bg-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors duration-300">
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(150deg, rgba(255,255,255,0.13), rgba(0,0,0,0.24))' }}
                  />
                  <span
                    className={cn(
                      'absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 border border-white/25',
                      idx === 1 ? 'rounded-lg bg-white/10' : 'rounded-full'
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 bg-white/40',
                      idx === 1 ? 'rounded-sm' : 'rounded-full'
                    )}
                  />
                  {off != null && off > 0 ? (
                    <span
                      dir="ltr"
                      className="absolute start-1 top-1 rounded bg-[color:var(--accent-cta)] px-1 text-[9px] font-bold leading-4 text-white transition-colors duration-300"
                    >
                      −{off}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[9px] text-white/75">{p.name}</p>
                <p className="flex items-baseline gap-1">
                  <span className="text-[10px] font-extrabold text-white">{p.price}</span>
                  {p.old ? <span className="text-[9px] text-white/50 line-through">{p.old}</span> : null}
                </p>
                {/* spans, not buttons: the whole storefront is aria-hidden,
                    so nothing inside may be focusable */}
                <span className="mt-1 block w-full cursor-pointer rounded-md border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] py-0.5 text-center text-[9px] font-bold text-[color:var(--accent-text)] transition-colors duration-300 hover:border-transparent hover:bg-[color:var(--accent-cta)] hover:text-white">
                  {t('addToCart')}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer strip */}
        <div className="border-t border-white/10 py-1.5 text-center text-[9px] text-white/55">{t('footer')}</div>
      </div>

      {/* Swatches — decorative pointer toy (FIX 2-c/12: hidden from the a11y
          tree + tab order), but the caption is REAL text and always visible.
          G3-6: the strip sits directly under the edge-to-edge panel, back
          inside the card's gutters. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3.5 sm:px-8">
        <div className="flex gap-2">
          {SITE_PALETTE.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setSwatch(i)}
              className={cn(
                'size-6 rounded-full transition-transform hover:scale-110',
                swatch === i && 'ring-2 ring-ring ring-offset-2'
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t('activeLabel')}:{' '}
          <span className="font-semibold text-foreground/80">{paletteNames[swatch] ?? ''}</span>
        </p>
      </div>
    </div>
  )
}

/* =========================================================================
   Mini interactive 2 — automation flow (3 nodes + animated connectors)
   ========================================================================= */

const FLOW_ICONS = [Inbox, Database, Send] as const

function MiniFlow() {
  const t = useTranslations('bento.automation.mini')
  const isRtl = useIsRtl()
  // L6-R2 (fix 6): runtime-narrowed catalog read (was `as string[]`).
  const nodes = asStringArray(t.raw('nodes'))
  const reduced = usePrefersReducedMotion()
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')
  // `step` = index of the node currently processing (3 = all processed).
  // `runId` remounts the traveling dots so their one-shot CSS animation
  // replays on every run.
  const [step, setStep] = useState(0)
  const [runId, setRunId] = useState(0)
  // FIX(2-c/5): keep every scheduled timeout cancellable — cleared before
  // re-arming and on unmount so a late `done` can never fire on a dead card.
  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  const run = () => {
    if (state === 'running') return
    clearTimers()
    setRunId((n) => n + 1)
    setState('running')
    setStep(0)
    const stepMs = reduced ? 400 : 700
    timers.current = [
      window.setTimeout(() => setStep(1), stepMs),
      window.setTimeout(() => setStep(2), stepMs * 2),
      window.setTimeout(() => {
        setStep(3)
        setState('done')
      }, stepMs * 3),
    ]
  }

  const nodeStatus = (i: number): 'idle' | 'active' | 'done' => {
    if (state === 'done' || step > i) return 'done'
    if (state === 'running' && step === i) return 'active'
    return 'idle'
  }
  const swept = (i: number) => state === 'done' || step > i

  return (
    <div className="mt-6">
      <p className="text-xs text-muted-foreground">{t('title')}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{t('hint')}</p>
      <div className="mt-4 rounded-xl border border-border bg-elyra-dark/95 p-3.5 text-elyra-on-dark">
        <div className="flex items-start">
          {nodes.map((label, i) => {
            const status = nodeStatus(i)
            const Icon = FLOW_ICONS[i] ?? Inbox
            return (
              <Fragment key={label}>
                <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'relative flex size-9 items-center justify-center rounded-full border-2 transition-colors duration-300',
                      status === 'active' && 'border-primary bg-primary/25',
                      status === 'done' && 'border-g-green/70 bg-g-green/15',
                      status === 'idle' && 'border-white/15 bg-white/5'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 transition-colors duration-300',
                        status === 'active' && 'text-white',
                        status === 'done' && 'text-g-green',
                        status === 'idle' && 'text-white/50'
                      )}
                    />
                    {status === 'done' ? (
                      <span className="absolute -end-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-g-green text-elyra-dark">
                        <Check className="size-2.5" />
                      </span>
                    ) : status === 'active' ? (
                      // Pulse via pure CSS (.elyra-pulse) — Phase 3 §4.3;
                      // reduced-motion gets a static shadow instead.
                      <span
                        className={cn('absolute inset-0 rounded-full', !reduced && 'elyra-pulse')}
                        style={reduced ? { boxShadow: '0 0 0 4px rgba(0,113,227,0.35)' } : undefined}
                      />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      'text-center text-[9px] leading-tight transition-colors duration-300',
                      status === 'active' && 'text-white',
                      status === 'done' && 'text-white/80',
                      status === 'idle' && 'text-white/70'
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < 2 ? (
                  <div className="relative mx-0.5 mt-[17px] h-0.5 flex-1 rounded-full bg-white/10">
                    {/* progress sweep — G2-4 F1: transformOrigin 'start'
                        is INVALID CSS (transform-origin takes PHYSICAL
                        keywords; the logical form never shipped) — CSSOM
                        silently dropped it and the sweep expanded from
                        the connector's CENTER, losing the flow
                        directionality + the RTL mirror intent. Physical
                        'left' for LTR / 'right' for RTL, matching the
                        per-direction elyra-flow-dot keyframes beside it
                        (G3F-A fix 7c pattern). */}
                    <span
                      className={cn(
                        'absolute inset-0 rounded-full bg-primary transition-transform duration-500 ease-out',
                        swept(i) ? 'scale-x-100' : 'scale-x-0'
                      )}
                      style={{ transformOrigin: isRtl ? 'right' : 'left', transitionDelay: swept(i) ? '80ms' : '0ms' }}
                    />
                    {/* traveling pulse dot along the swept connector —
                        L6-R3 (fix 7c): the dot used to animate
                        `inset-inline-start` (a LAYOUT property — layout +
                        paint every frame). It now rides a full-connector-
                        width wrapper whose translateX(%) resolves against
                        the WRAPPER (= the connector's own width), so the
                        old 0% → calc(100% - 6px) travel is exactly
                        equivalent; the visible dot sits at the start edge
                        inside the wrapper. translateX is PHYSICAL while
                        inset-inline-start was logical — hence the
                        per-direction keyframes (start edge = right in
                        RTL, so the RTL variant travels negative). */}
                    {swept(i) && !reduced ? (
                      <span
                        key={`dot-${runId}-${i}`}
                        className="absolute inset-0"
                        style={{ animation: `${isRtl ? 'elyra-flow-dot-rtl' : 'elyra-flow-dot'} 550ms ease-in-out 80ms forwards` }}
                      >
                        <span className="absolute top-1/2 start-0 size-1.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_6px_rgba(0,113,227,0.9)]" />
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
        {state === 'done' ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-[10px]">
            <span className="inline-flex items-center gap-1 font-bold text-g-green">
              <Check className="size-3" /> {t('runs')}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="inline-flex items-center gap-1 text-elyra-muted-on-dark">
              <Clock className="size-3" /> {t('saved')}
            </span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        data-cursor="magnet"
        onClick={run}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {state === 'done' ? <RotateCw className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
        {state === 'done' ? t('done') : t('title')}
      </button>
      {/* elyra-flow-dot/-rtl keyframes live in globals.css (single-owner
          convention — G2-1 F4 / G2-4 keyframe hygiene). */}
    </div>
  )
}

/* =========================================================================
   Mini interactive 3 — draggable 3D cube (CSS 3D) with idle auto-rotation
   ========================================================================= */

const CUBE_FACES: ReadonlyArray<{
  tr: string
  grad: string
  icon: typeof Globe | null
  glyph?: string
  dark?: boolean
}> = [
  { tr: 'translateZ(28px)', grad: 'linear-gradient(135deg, #4285F4, #0071E3)', icon: null, glyph: 'E' },
  { tr: 'rotateY(180deg) translateZ(28px)', grad: 'linear-gradient(135deg, #60A5FA, #4285F4)', icon: Globe },
  { tr: 'rotateY(90deg) translateZ(28px)', grad: 'linear-gradient(135deg, #4CBF6E, #1E8F41)', icon: Boxes },
  { tr: 'rotateY(-90deg) translateZ(28px)', grad: 'linear-gradient(135deg, #F0655A, #C22F23)', icon: Sparkles },
  { tr: 'rotateX(90deg) translateZ(28px)', grad: 'linear-gradient(135deg, #FFD44D, #E9A61D)', icon: Bot, dark: true },
  { tr: 'rotateX(-90deg) translateZ(28px)', grad: 'linear-gradient(135deg, #FDF8ED, #D9CDAC)', icon: null, glyph: '◆', dark: true },
]

/* L3 FIX (R3): keyboard nudge magnitudes — one firm drag gesture at the
   pointer drag's 0.5°/px mapping: ±0.15 rad (≈8.6°) yaw / ±0.1 rad
   (≈5.7°) pitch per press ≈ a 17px drag, through the SAME (unclamped)
   rotation space the drag writes. */
const KEY_YAW_DEG = (0.15 * 180) / Math.PI
const KEY_PITCH_DEG = (0.1 * 180) / Math.PI

function MiniCube() {
  const t = useTranslations('bento.threeD.mini')
  // Reduced motion: skip the CSS easing between drag rotations AND disable
  // the idle auto-rotation entirely (user-driven drags still work).
  const reduced = usePrefersReducedMotion()
  // L6-R3 (fix 5): the rotation lives in a REF now — the idle spin loop
  // used to call setRot 60×/s forever (no off-screen gate, measured still
  // spinning at page bottom), re-rendering this subtree in perpetuity.
  // Cursor-engine pattern (the manifesto.tsx:77-79 convention — never
  // setState in a per-frame loop): the rAF loop writes the transform
  // straight to the DOM; same rotation math, same drag/keyboard paths.
  // `dragging`/`spinning` remain state — they flip only on interaction
  // boundaries (transition toggle), a handful of renders per gesture.
  const rotRef = useRef({ x: -18, y: 28 })
  const cubeRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const start = useRef({ x: 0, y: 0, rx: 0, ry: 0 })
  const idleTimer = useRef(0)

  // Write the current rotation (and the yaw-derived floor shadow) directly
  // to the DOM. The JSX style props below carry only CONSTANT initial
  // values, so React's per-key style diff never rewrites these writes.
  const applyRot = useCallback(() => {
    const { x, y } = rotRef.current
    const cube = cubeRef.current
    if (cube) cube.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`
    const shadow = shadowRef.current
    if (shadow) {
      // Cheap floor-shadow approximation: an ellipse that squashes/shifts
      // with the cube's yaw so the ground reads as reacting to the rotation.
      const ryRad = (y * Math.PI) / 180
      const scale = 0.7 + 0.3 * Math.abs(Math.cos(ryRad))
      const shift = Math.sin(ryRad) * 7
      shadow.style.transform = `translateX(calc(-50% + ${shift.toFixed(3)}px)) scaleX(${scale.toFixed(4)})`
    }
  }, [])

  const stopSpin = useCallback(() => {
    setSpinning(false) // the spin-loop effect cleans its own rAF on flip
  }, [])
  // Idle auto-rotation: armed on mount and after every drag; fires ~2.5s
  // after the last interaction. Disabled entirely for reduced-motion users.
  const armIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    if (reduced) return
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = 0
      setSpinning(true)
    }, 2500)
  }, [reduced])

  // Reduced-motion flip mid-spin: the loop effect below early-returns + its
  // cleanup cancels the rAF, and armIdle() refuses to re-arm, so nothing
  // autonomous keeps running — no setState needed here (lint: no cascading
  // renders from effect bodies).
  useEffect(() => {
    if (reduced) return
    armIdle()
    return () => {
      if (idleTimer.current) {
        window.clearTimeout(idleTimer.current)
        idleTimer.current = 0
      }
    }
  }, [reduced, armIdle])

  // The spin loop — time-based (display-rate independent), clamped against
  // tab-visibility spikes, fully self-cleaning. L6-R3 (fix 5): the loop
  // writes the transform through the ref (applyRot) — ZERO setState per
  // frame, so the perpetual idle rotation no longer re-renders anything.
  useEffect(() => {
    if (!spinning || reduced) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      rotRef.current = { x: rotRef.current.x, y: (rotRef.current.y + dt * 0.012) % 360 } // ~12°/s
      applyRot()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [spinning, reduced, applyRot])

  const onDown = (e: React.PointerEvent) => {
    stopSpin()
    if (idleTimer.current) {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = 0
    }
    start.current = { x: e.clientX, y: e.clientY, rx: rotRef.current.x, ry: rotRef.current.y }
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y
    rotRef.current = { x: start.current.rx - dy * 0.5, y: start.current.ry + dx * 0.5 }
    applyRot()
  }
  const onUp = () => {
    setDragging(false)
    armIdle()
  }

  // L3 FIX (R3): keyboard path for the pointer-only drag (three-d-section
  // pattern). Arrow keys nudge the SAME rotation state the drag writes
  // (rotRef → applyRot) with the same delta signs as a same-direction drag
  // (right → +yaw, down → −pitch). preventDefault sits AFTER the switch,
  // so only handled arrows are swallowed. A press counts as an
  // interaction: it stops the idle spin and re-arms it, exactly like
  // onDown/onUp do.
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        rotRef.current = { x: rotRef.current.x, y: rotRef.current.y - KEY_YAW_DEG }
        break
      case 'ArrowRight':
        rotRef.current = { x: rotRef.current.x, y: rotRef.current.y + KEY_YAW_DEG }
        break
      case 'ArrowUp':
        rotRef.current = { x: rotRef.current.x + KEY_PITCH_DEG, y: rotRef.current.y }
        break
      case 'ArrowDown':
        rotRef.current = { x: rotRef.current.x - KEY_PITCH_DEG, y: rotRef.current.y }
        break
      default:
        return
    }
    e.preventDefault()
    applyRot()
    stopSpin()
    // L4 R3/R4 P3: only re-arm the idle spin when the pointer isn't
    // holding the cube — a mid-drag keypress would otherwise arm the 2.5s
    // timer while the pointer is still down (spin loop + absolute drag
    // writes fight over rot → jitter under a held-still pointer).
    // onPointerUp re-arms idle after every real drag anyway.
    if (!dragging) armIdle()
  }

  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground">
        {t('hint')} · {t('idle')}
      </p>
      {/* L3 FIX (R3): the STAGE is now the keyboard surface — role="img" +
          aria-label + tabIndex + arrow keys mirror three-d-section's a11y
          pattern (label moved here from the cube so it names the focusable
          element; children of role="img" are presentational). NOT gated on
          reduced motion, unlike three-d-section: MiniCube drags still work
          for reduced users (only autonomous spin + the 0.2s easing are
          disabled), so keyboard rotation stays available too — reduced
          users get instant, un-eased nudges. Focus ring follows the
          three-d-section convention (ring-ring offset elyra-dark). */}
      <div
        role="img"
        aria-label={`${t('hint')} — ${t('idle')}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        /* G2-4 F5: touch-none is scoped to the CUBE element below (the
           only element with drag handlers) — on this whole-card stage it
           made a full-card-width, 144px-tall vertical-scroll dead zone
           on touch: a finger landing beside the cube refused to scroll
           the page. The stage keeps select-none only. */
        className="relative mt-3 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-border bg-elyra-dark/95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-elyra-dark"
        style={{ perspective: '600px' }}
      >
        {/* faint accent point-glow behind the cube (depth) */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'radial-gradient(130px 90px at 50% 44%, rgba(0,113,227,0.28), transparent 70%)' }}
        />
        {/* soft elliptical floor shadow — transform is written
            imperatively by applyRot() (yaw-derived squash/shift); the
            CONSTANT initial value below matches the y=28° seed exactly
            (toFixed formats included) so the SSR paint equals the
            pre-fix first frame and React's style diff never touches
            the key afterwards (L6-R3 fix 5). */}
        <div
          ref={shadowRef}
          aria-hidden="true"
          className="absolute bottom-5 left-1/2 h-2.5 w-16 rounded-[50%] bg-black/70 blur-[5px] transition-transform duration-300"
          style={{ transform: 'translateX(calc(-50% + 3.286px)) scaleX(0.9649)' }}
        />
        <div
          ref={cubeRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          /* touch-none lives HERE (the drag surface) — see the stage
             comment above (G2-4 F5). */
          className="size-14 cursor-grab touch-none active:cursor-grabbing"
          style={{
            transformStyle: 'preserve-3d',
            // Constant initial pose (matches rotRef's seed) — applyRot()
            // owns the transform from mount on; the value never changes
            // through React, so its style diff never rewrites it.
            transform: 'rotateX(-18deg) rotateY(28deg)',
            transition: dragging || spinning || reduced ? 'none' : 'transform 0.2s ease-out',
            willChange: 'transform',
          }}
        >
          {CUBE_FACES.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={i}
                className="absolute inset-0 flex items-center justify-center rounded-[3px]"
                style={{
                  transform: f.tr,
                  background: f.grad,
                  backfaceVisibility: 'hidden',
                  // 1px inner border highlight so edges catch the light
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), inset 0 1px 0 rgba(255,255,255,0.35)',
                }}
              >
                {Icon ? (
                  <Icon
                    className={cn('size-4', f.dark ? 'text-elyra-dark/80' : 'text-white/85')}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={cn(
                      f.glyph === 'E' ? 'text-base font-black tracking-wide text-white' : 'text-[10px] text-elyra-dark/70'
                    )}
                    aria-hidden="true"
                  >
                    {f.glyph}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   Mini interactive 4 — AI prompt-response (6 cycling answers)
   ========================================================================= */

function MiniAgent() {
  const t = useTranslations('bento.ai.mini')
  // Batch 2 item 8: locale-aware router (@/i18n/navigation) — the convert
  // CTA hands the visitor's idea to the prefilled contact form.
  const router = useRouter()
  // Typewriter is a JS-driven (setInterval) animation — the global CSS
  // reduced-motion override can't stop it, so we honor the hook directly:
  // reduced-motion users get the full response instantly (audit P1-6).
  const reduced = usePrefersReducedMotion()
  // Six distinct localized answers — every click advances the index (cycling,
  // so the same answer is never shown twice in a row). `shown` counts clicks.
  // L6-R2 (fix 6): runtime-narrowed catalog read (was `as string[]`).
  const responses = asStringArray(t.raw('responses'))
  const [shown, setShown] = useState(-1)
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'typing'>('idle')
  const [chars, setChars] = useState(0)
  // Batch 2 item 8: free-text idea field below the cycling answer.
  const [idea, setIdea] = useState('')
  const len = Math.max(responses.length, 1)
  const current = shown >= 0 ? responses[shown % len] ?? '' : ''
  const complete = phase === 'typing' && current.length > 0 && chars >= current.length
  // FIX(2-c/5): hold the typewriter interval + thinking timeout in refs —
  // cleared before re-arming (a second click mid-type must not race the
  // first) and on unmount.
  const typer = useRef(0)
  const thinker = useRef(0)
  useEffect(
    () => () => {
      if (typer.current) window.clearInterval(typer.current)
      if (thinker.current) window.clearTimeout(thinker.current)
    },
    []
  )

  const ask = () => {
    if (typer.current) {
      window.clearInterval(typer.current)
      typer.current = 0
    }
    if (thinker.current) {
      window.clearTimeout(thinker.current)
      thinker.current = 0
    }
    const next = shown + 1
    const text = responses[next % len] ?? ''
    setShown(next)
    setChars(0)
    if (reduced) {
      setPhase('typing')
      setChars(text.length)
      return
    }
    setPhase('thinking')
    thinker.current = window.setTimeout(() => {
      thinker.current = 0
      setPhase('typing')
      let i = 0
      typer.current = window.setInterval(() => {
        i += 2
        setChars(i)
        if (i >= text.length) {
          window.clearInterval(typer.current)
          typer.current = 0
        }
      }, 25)
    }, 450)
  }

  /** Batch 2 item 8: convert the intent into a request — the typed idea
   *  when present, otherwise the currently shown answer. URL contract:
   *  /contact?service=agent&idea=<urlencoded> (same locale-correct
   *  router.push pattern as the automation simulator's completion CTA). */
  const convert = () => {
    const text = idea.trim() || current
    const params = new URLSearchParams({ service: 'agent' })
    if (text) params.set('idea', text)
    router.push(`/contact?${params.toString()}`)
  }

  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground">{t('hint')}</p>
      <div className="mt-3 space-y-2 rounded-xl border border-border bg-elyra-dark/95 p-3 text-elyra-on-dark">
        <button
          type="button"
          data-cursor="magnet"
          onClick={ask}
          className="flex min-h-11 w-full items-start gap-2 rounded-lg px-2 py-1.5 text-start text-xs text-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bot className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{t('prompt')}</span>
        </button>
        {/* stable min-height keeps the card from jumping between the
            thinking / typing / completed states */}
        <div className={shown >= 0 ? 'min-h-[3rem]' : undefined}>
          {phase === 'thinking' ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-2 text-xs">
              <Bot className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex items-center gap-1 py-0.5" aria-hidden="true">
                <span className="size-1 animate-bounce rounded-full bg-white/60" />
                <span className="size-1 animate-bounce rounded-full bg-white/60 [animation-delay:150ms]" />
                <span className="size-1 animate-bounce rounded-full bg-white/60 [animation-delay:300ms]" />
              </span>
            </div>
          ) : current ? (
            <div className="relative rounded-lg bg-white/5 px-2 py-1.5">
              <span
                aria-hidden="true"
                className="absolute -end-1 -top-2 rounded-md bg-g-blue/20 px-1 py-px text-[9px] font-bold text-g-blue ring-1 ring-g-blue/30"
              >
                AI
              </span>
              <div className="flex items-start gap-2 text-xs text-white/90">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-g-yellow" aria-hidden="true" />
                <span>
                  {current.slice(0, chars)}
                  {phase === 'typing' && chars < current.length ? (
                    <span className="animate-pulse">▌</span>
                  ) : null}
                </span>
              </div>
              {complete ? (
                <div className="mt-1 flex items-center gap-1 ps-5 text-[10px] text-white/50">
                  <RefreshCw className="size-2.5" aria-hidden="true" />
                  {t('retryHint')}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* one clean SR announcement per COMPLETED answer — keeps the
            typewriter's per-frame mutations out of the live region */}
        <span className="sr-only" aria-live="polite">
          {complete ? current : ''}
        </span>
        {/* Batch 2 item 8: idea input + convert CTA — Enter submits the
            form (real <form> onSubmit, not a click-only button). Compact
            and RTL-safe: flex + gap only, no directional utilities. */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            convert()
          }}
        >
          <label htmlFor="mini-agent-idea" className="sr-only">
            {t('inputPlaceholder')}
          </label>
          <input
            id="mini-agent-idea"
            type="text"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={t('inputPlaceholder')}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white transition-colors placeholder:text-white/40 focus:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            data-cursor="magnet"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Send className="size-3.5" aria-hidden="true" />
            {t('convertCta')}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---------- Mini interactive: orbiting integration initials ---------- */
// Orbit positions are static, so they're computed once at module scope.
// Offsets are pre-combined and rounded to 4 decimals and formatted to match
// the CSSOM canonical calc() form exactly — React 19's dev-mode hydration
// diff reads normalized CSSOM style values, so raw strings like
// `calc(50% + -24.00000000000002px - 14px)` would falsely "mismatch" against
// the browser-simplified `calc(50% - 38px)`.
const ORBIT_ITEMS = ['CRM', 'n8n', 'AI', 'SH', 'TG', '@'].map((label, i, arr) => {
  const angle = (i / arr.length) * Math.PI * 2
  const radius = 48
  const x = Math.round((Math.cos(angle) * radius - 14) * 1e4) / 1e4
  const y = Math.round((Math.sin(angle) * radius - 14) * 1e4) / 1e4
  return {
    label,
    left: `calc(50% ${x >= 0 ? `+ ${x}` : `- ${Math.abs(x)}`}px)`,
    top: `calc(50% ${y >= 0 ? `+ ${y}` : `- ${Math.abs(y)}`}px)`,
  }
})

function MiniOrbit() {
  const t = useTranslations('bento.integrations.mini')
  return (
    <div className="mt-6">
      <p className="text-[11px] text-muted-foreground">{t('hint')}</p>
      {/* L6-R4 (fix 8a): the whole orbit panel (rotating CRM/n8n/AI/SH/TG/@
          tokens + hub dot) is decorative chrome around the caption —
          aria-hidden keeps the bare Latin tokens out of the SR tree. */}
      <div
        aria-hidden="true"
        className="relative mt-3 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-border bg-elyra-dark/95"
      >
        <div className="absolute size-2.5 rounded-full bg-primary" />
        <div
          className="absolute inset-0"
          style={{ animation: 'elyra-orbit 14s linear infinite' }}
        >
          {ORBIT_ITEMS.map((item) => (
            <span
              key={item.label}
              className="absolute flex size-7 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[9px] font-bold text-white"
              /* G2-4 F6: counter-rotation — the token runs the SAME
                 keyframes in reverse so the ring's rotation and the
                 token's own cancel out (θ + (360 − θ) ≡ 0) and the
                 CRM/n8n/AI/... labels stay UPRIGHT through the 14s lap
                 instead of tumbling sideways. Same 14s linear duration =
                 phase-locked from the same mount; the ring + tokens stay
                 aria-hidden (decorative). Kill-switch: both rotations
                 freeze (ring parks at 360° ≡ its start pose, token at
                 0°) — the resting frame is identical. */
              style={{
                left: item.left,
                top: item.top,
                animation: 'elyra-orbit 14s linear infinite reverse',
              }}
            >
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {/* elyra-orbit keyframes live in globals.css (single-owner
          convention — G2-1 F4 / G2-4 keyframe hygiene). */}
    </div>
  )
}

/* ---------- Bento section ---------- */
export function ServicesBento() {
  const t = useTranslations('bento')

  return (
    <section className="bg-background py-20 sm:py-28" aria-labelledby="bento-title">
      <div className="elyra-container max-w-container">
        <SectionHeading
          kicker={t('kicker')}
          title={t('title')}
          subtitle={t('subtitle')}
          titleId="bento-title"
        />

        {/* G2-1 F5: lg:grid-rows-2 was a wrong mental model — the five
            cards occupy 7 track-units over THREE rows at lg (websites
            spans 2×2, AI spans 2×1), so the declaration only ever sized
            the first two tracks and row 3 was implicit auto anyway.
            Auto rows reproduce the shipped geometry honestly: the
            2×2 websites card still stretches across rows 1-2 (h-full +
            default stretch), and the single cards keep their natural
            heights. */}
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {/* Big websites card — FLAGSHIP (G3-6 Stitch port, design-lab
              bento-services reference): spans 2 cols × 2 rows as the grid's
              right-side anchor in RTL (grid col 1 = right edge under
              dir=rtl). Anatomy per the reference: padded top half (icon
              eyebrow, title, one-sentence desc, checkmark feature chips)
              + the MiniSite storefront preview bleeding EDGE-TO-EDGE
              through the card's lower half (GlowCard padding zeroed via
              p-0 overrides; the card's own rounded-3xl + overflow-hidden
              clips the bleed), anchored to the bottom with mt-auto so the
              stretch gap sits between chips and preview, never below.
              FIX(2-c/12) history: the icon eyebrow stays icon-only (no
              catalog kicker key). R2: grid-span classes live on the Reveal
              wrapper (the grid item); the zoom reveal + stagger unchanged. */}
          <Reveal variant="zoom" className="lg:col-span-2 lg:row-span-2">
            <GlowCard className="flex h-full flex-col p-0 sm:p-0">
            <div className="p-6 pb-5 sm:p-8 sm:pb-6">
            {/* G2-1 F6: the lone-icon eyebrows got a container treatment
                — the trust-bar chip (rounded-xl bg-primary/10 text-primary,
                size-10 around the existing size-5 glyph), the most
                size-harmonious of the site's three icon treatments and
                the same one the calculator service cards use. */}
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('websites.title')}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
              {t('websites.desc')}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {/* L6-R2 (fix 6): runtime-narrowed catalog read (was `as string[]`). */}
              {asStringArray(t.raw('websites.features')).map((f) => (
                <li
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-foreground/80"
                >
                  <Check className="size-3 text-g-green" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            </div>
            <div className="mt-auto">
              <MiniSite />
            </div>
            </GlowCard>
          </Reveal>

          {/* Automation */}
          <Reveal variant="zoom" delay={0.08}>
            <GlowCard className="h-full">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Workflow className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('automation.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('automation.desc')}
            </p>
            <MiniFlow />
            </GlowCard>
          </Reveal>

          {/* 3D */}
          <Reveal variant="zoom" delay={0.14}>
            <GlowCard className="h-full">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Boxes className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('threeD.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('threeD.desc')}
            </p>
            <MiniCube />
            </GlowCard>
          </Reveal>

          {/* AI — wide */}
          <Reveal variant="zoom" delay={0.2} className="lg:col-span-2">
            <GlowCard className="h-full">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
              <div>
                <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  {t('ai.title')}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('ai.desc')}
                </p>
              </div>
              <MiniAgent />
            </div>
            </GlowCard>
          </Reveal>

          {/* Integrations */}
          <Reveal variant="zoom" delay={0.26} className="lg:col-span-1">
            <GlowCard className="h-full">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
              {t('integrations.title')}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('integrations.desc')}
            </p>
            <MiniOrbit />
            </GlowCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
