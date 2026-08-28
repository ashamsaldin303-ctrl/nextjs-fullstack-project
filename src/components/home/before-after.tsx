'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  BarChart3,
  Bell,
  Headphones,
  Heart,
  ImageOff,
  LayoutDashboard,
  MessageCircle,
  MoveHorizontal,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Star,
  TriangleAlert,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

type SceneVariant = 'site-old' | 'site-new' | 'dashboard-old' | 'dashboard-new'

/**
 * Per-project mock content for the "after" scenes. Resolved by the parents
 * (featured-work.tsx / work-grid.tsx) via t.raw(...) and narrowed through
 * toMockContent(). Every field is optional — scenes degrade to neutral
 * placeholders when a parent passes nothing.
 */
export interface MockContent {
  brand?: string
  kicker?: string
  title?: string
  sub?: string
  cta?: string
  cards?: { name: string; price: string; old?: string }[]
}

/* --------------------------------------------------------------------------
   t.raw() narrowing helpers (no `any` — eslint forbids it)
   -------------------------------------------------------------------------- */

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

interface Kpi {
  label: string
  value: string
  delta: string
}

interface SheetRow {
  ref: string
  party: string
  amount: string
  status: string
}

function asKpis(value: unknown): Kpi[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({ label: asString(r.label), value: asString(r.value), delta: asString(r.delta) }))
    .filter((k) => k.label !== '' || k.value !== '')
}

function asRows(value: unknown): SheetRow[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({
      ref: asString(r.ref),
      party: asString(r.party),
      amount: asString(r.amount),
      status: asString(r.status),
    }))
    .filter((r) => r.ref !== '' || r.party !== '')
}

/** Narrow a next-intl t.raw() catalog value into MockContent. */
export function toMockContent(raw: unknown): MockContent | undefined {
  if (!isRecord(raw)) return undefined
  const cards = Array.isArray(raw.cards)
    ? raw.cards
        .filter(isRecord)
        .map((c) => ({
          name: asString(c.name),
          price: asString(c.price),
          old: asString(c.old) || undefined,
        }))
        .filter((c) => c.name !== '' || c.price !== '')
    : undefined
  return {
    brand: asString(raw.brand) || undefined,
    kicker: asString(raw.kicker) || undefined,
    title: asString(raw.title) || undefined,
    sub: asString(raw.sub) || undefined,
    cta: asString(raw.cta) || undefined,
    cards: cards && cards.length > 0 ? cards : undefined,
  }
}

/* --------------------------------------------------------------------------
   Color helpers — accents arrive as hex strings per project
   -------------------------------------------------------------------------- */

const FALLBACK_RGB: [number, number, number] = [0, 113, 227] // #0071E3 (brand blue)

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const digits = m?.[1]
  if (!digits) return FALLBACK_RGB
  const n = Number.parseInt(digits, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Mix toward black by `amount` (0..1). */
function shadeColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(c * (1 - amount))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

/** Mix toward white by `amount` (0..1). */
function tintColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function luminance(hex: string): number {
  const ch = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

const isLightColor = (hex: string) => luminance(hex) > 0.55

/** Readable ink on top of a solid accent fill (white on dark accents,
 *  darkened accent on light ones like the gold #FBBC05). */
const onAccentColor = (hex: string) => (isLightColor(hex) ? shadeColor(hex, 0.6) : '#ffffff')

/** Readable ink on top of an accent TINT (announcement bar, chips). */
const accentInkColor = (hex: string) => shadeColor(hex, isLightColor(hex) ? 0.5 : 0.15)

/** "−18%"-style discount derived from the price pair (null → no badge). */
function discountPct(price: string, old: string | undefined): number | null {
  if (!old) return null
  const p = Number.parseInt(price.replace(/[^0-9]/g, ''), 10)
  const o = Number.parseInt(old.replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(p) || !Number.isFinite(o) || o <= 0 || p >= o) return null
  return Math.round((1 - p / o) * 100)
}

const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* Local keyframes for the 2005 blinking announcement dots + the old-site
   scrolling news ticker. The global prefers-reduced-motion kill-switch in
   globals.css freezes these (the ticker completes to -50% where its
   duplicated copy sits — content stays readable). */
const SCENE_KEYFRAMES =
  '@keyframes ba-scene-blink{0%,100%{opacity:1}50%{opacity:.2}}.ba-scene-blink{animation:ba-scene-blink 1.3s ease-in-out infinite}' +
  '@keyframes ba-scene-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}.ba-scene-ticker-track{animation:ba-scene-ticker 16s linear infinite}'

/* R8 "real screenshot" pass — shared era/scene constants. */
/** Faint graph-paper tiling behind the 2009 site body + masthead. */
const OLD_TILE_BG =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px)'
/** Prices for the old product table when no per-project mock exists. */
const OLD_PRICES = ['12,500', '8,900', '15,400']
/** Trust-bar icons (site-new) — index-aligned with the i18n trust array. */
const TRUST_ICONS = [Truck, ShieldCheck, RotateCcw, Headphones] as const
/** KPI sparkline bar heights (dashboard-new) — one set per KPI card. */
const KPI_SPARKS: ReadonlyArray<readonly number[]> = [
  [35, 55, 42, 68, 88],
  [55, 42, 60, 52, 74],
  [70, 50, 38, 46, 30],
  [40, 58, 66, 78, 92],
]
/** Excel column letters (dashboard-old) — locale-neutral chrome. */
const COL_LETTERS = ['A', 'B', 'C', 'D'] as const

/* --------------------------------------------------------------------------
   Static scene data
   -------------------------------------------------------------------------- */
/** 12 believable upward-trending points for the dashboard area chart. */
const CHART_POINTS: ReadonlyArray<readonly [number, number]> = [
  [2, 30],
  [10.7, 27],
  [19.5, 29],
  [28.2, 23],
  [36.9, 25],
  [45.6, 19],
  [54.4, 21],
  [63.1, 14],
  [71.8, 17],
  [80.5, 10],
  [89.3, 12],
  [98, 5],
]

function smoothLinePath(pts: ReadonlyArray<readonly [number, number]>): string {
  const first = pts[0]
  if (pts.length < 2 || !first) return ''
  let d = `M ${first[0]} ${first[1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const cur = pts[i]
    const next = pts[i + 1]
    if (!cur || !next) break
    d += ` Q ${cur[0]} ${cur[1]} ${(cur[0] + next[0]) / 2} ${(cur[1] + next[1]) / 2}`
  }
  const last = pts[pts.length - 1]
  if (!last) return d
  d += ` L ${last[0]} ${last[1]}`
  return d
}

const CHART_LINE = smoothLinePath(CHART_POINTS)
const CHART_LAST: readonly [number, number] = CHART_POINTS.at(-1) ?? ([98, 5] as const)
const CHART_AREA = `${CHART_LINE} L ${CHART_LAST[0]} 40 L ${CHART_POINTS[0]?.[0] ?? 2} 40 Z`

const DASH_ICONS = [LayoutDashboard, Activity, Users, BarChart3, Settings] as const

/** Literal tabular data for the old spreadsheet (sanctioned mock data —
 *  an Arabic business's sheet; dates/amounts are locale-neutral digits). */
interface OldSheetRow {
  date: string
  name: string
  amount: string
  /** render the localized "pending" status in red */
  pending?: boolean
  /** classic broken-spreadsheet artifacts */
  error?: 'ref' | 'hash'
}

const OLD_SHEET_ROWS: OldSheetRow[] = [
  { date: '03/11', name: 'احمد', amount: '14250', pending: true },
  { date: '03/11', name: 'شركة الأمل', amount: '8900' },
  { date: '02/11', name: 'منى', amount: '23100', pending: true },
  { date: '02/11', name: 'مؤسسة النور', amount: '#REF!', error: 'ref' },
  { date: '01/11', name: 'سامي', amount: '####', error: 'hash' },
  { date: '01/11', name: 'متجر الواحة', amount: '5400', pending: true },
  { date: '31/10', name: 'ليلى', amount: '12750' },
  { date: '30/10', name: 'شركة الري', amount: '9800', pending: true },
]

const SHEET_COLS = 'grid-cols-[10px_1.1fr_1fr_0.72fr_0.95fr]'

/* --------------------------------------------------------------------------
   Scene 1 — "site-new": modern e-commerce storefront
   -------------------------------------------------------------------------- */

/** Three distinct CSS-only "product photo" silhouettes so the row reads
 *  like a real catalog rather than three identical boxes. */
function ProductArt({ i }: { i: number }) {
  if (i === 0) {
    return (
      <>
        <div className="absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" />
        <div className="absolute left-1/2 top-1/2 h-[46%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-white/45" />
        <div className="absolute left-1/2 top-[36%] h-[9%] w-[13%] -translate-x-1/2 rounded-full bg-white/65" />
      </>
    )
  }
  if (i === 1) {
    return (
      <>
        <div className="absolute inset-x-[31%] top-[24%] h-[7%] rounded-[2px] bg-white/55" />
        <div className="absolute inset-x-[24%] bottom-[16%] top-[34%] rounded-t-[38%] rounded-b-[14%] bg-white/40" />
        <div className="absolute inset-x-[40%] top-[40%] h-[11%] rounded-full bg-white/55" />
      </>
    )
  }
  return (
    <>
      <div className="absolute inset-x-[38%] top-[16%] h-[15%] rounded-t-full border-[2px] border-b-0 border-white/50" />
      <div className="absolute inset-x-[26%] top-[30%] bottom-[18%] rounded-[3px] bg-white/40" />
      <div className="absolute inset-x-[32%] top-[38%] h-[9%] rounded-[2px] bg-white/60" />
    </>
  )
}

function SiteNewScene({ accent, mock }: { accent: string; mock?: MockContent }) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('site.nav'))
  const categories = asStringArray(t.raw('site.categories'))
  const trust = asStringArray(t.raw('site.trust'))
  const footerLinks = asStringArray(t.raw('site.footerLinks'))
  const payments = asStringArray(t.raw('site.payments'))
  const cards = mock?.cards && mock.cards.length > 0 ? mock.cards.slice(0, 3) : null
  const onAccent = onAccentColor(accent)
  const accentInk = accentInkColor(accent)
  const rating = t('site.rating')

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-stone-900">
      {/* announcement bar (accent-tinted) */}
      <div
        className="flex h-[13px] shrink-0 items-center justify-center px-14"
        style={{ background: rgba(accent, 0.12) }}
      >
        <span className="truncate text-[6px] font-semibold tracking-wide" style={{ color: accentInk }}>
          {t('site.announce')}
        </span>
      </div>

      {/* navbar: brand • links • search pill • wishlist • account • cart */}
      <div className="flex h-[22px] shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-2 pe-[52px]">
        <div className="flex min-w-0 items-center gap-1">
          <span className="size-[6px] shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate text-[8px] font-extrabold tracking-tight">{mock?.brand ?? ''}</span>
        </div>
        <nav className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {nav.map((l) => (
            <span key={l} className="whitespace-nowrap text-[6px] font-medium text-stone-500">
              {l}
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-0.5 rounded-full border border-stone-200 bg-stone-50 px-1.5 py-px">
            <Search className="size-[7px] shrink-0 text-stone-400" />
            <span className="whitespace-nowrap text-[6px] text-stone-400">{t('site.search')}</span>
          </span>
          <Heart className="size-[10px] shrink-0 text-stone-500" />
          <User className="size-[10px] shrink-0 text-stone-500" />
          <span className="relative block text-stone-700">
            <ShoppingBag className="size-[11px]" />
            <span
              className="absolute -end-1 -top-[3px] flex size-[9px] items-center justify-center rounded-full text-[5px] font-bold leading-none"
              style={{ background: accent, color: onAccent }}
            >
              2
            </span>
          </span>
        </div>
      </div>

      {/* category chips row — merchandising rail */}
      <div className="flex h-[15px] shrink-0 items-center gap-1 border-b border-stone-100 bg-white px-2 pe-[52px]">
        {categories.map((c, i) => (
          <span
            key={c}
            className={cn(
              'whitespace-nowrap rounded-full px-1.5 py-[1.5px] text-[5.5px] font-semibold leading-none',
              i === 0 ? 'text-white' : 'bg-stone-100 text-stone-500'
            )}
            style={i === 0 ? { background: accent } : undefined}
          >
            {c}
          </span>
        ))}
      </div>

      {/* hero: copy side + layered "photo" side */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_0.95fr] gap-1.5 px-2 py-1.5">
        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[3px]">
          {mock?.kicker ? (
            <span
              className="w-fit max-w-full truncate rounded-full px-1.5 py-px text-[6px] font-bold leading-none"
              style={{ background: rgba(accent, 0.14), color: accentInk }}
            >
              {mock.kicker}
            </span>
          ) : null}
          {mock?.title ? (
            <p className="text-[10px] font-extrabold leading-[1.15] tracking-tight">{mock.title}</p>
          ) : (
            <div className="h-[11px] w-4/5 rounded bg-stone-200" />
          )}
          {mock?.sub ? (
            <p className="line-clamp-2 text-[7px] leading-[1.3] text-stone-500">{mock.sub}</p>
          ) : (
            <div className="h-[7px] w-3/5 rounded bg-stone-200" />
          )}
          <div className="mt-[3px] flex min-w-0 items-center gap-1.5">
            {mock?.cta ? (
              <span
                className="shrink-0 rounded-md px-2 py-[3px] text-[7px] font-bold leading-none shadow-sm"
                style={{ background: accent, color: onAccent }}
              >
                {mock.cta}
              </span>
            ) : null}
            {/* social proof: overlapping avatars + rating + customer count */}
            <span className="flex min-w-0 items-center gap-1">
              <span className="flex shrink-0">
                {['bg-stone-300', 'bg-amber-200', 'bg-emerald-200', 'bg-sky-200'].map((tone, i) => (
                  <span
                    key={tone}
                    className={cn('size-[9px] rounded-full border border-white', tone)}
                    style={{ marginInlineStart: i === 0 ? 0 : '-2.5px' }}
                  />
                ))}
              </span>
              <span className="min-w-0 truncate text-[6px] font-medium text-stone-500">
                {`★ ${rating} · ${t('site.socialProof')}`}
              </span>
            </span>
          </div>
        </div>

        {/* hero image — accent gradient + radial glow + floating chips + shine */}
        <div
          className="relative min-h-0 overflow-hidden rounded-lg"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${shadeColor(accent, 0.35)} 100%)` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(60% 55% at 50% 40%, rgba(255,255,255,0.22), transparent 70%)',
            }}
          />
          <div className="absolute -top-[25%] start-[8%] size-[80%] rounded-full bg-white/15 blur-[5px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-[58%] w-[42%]">
              <div className="absolute inset-x-[24%] top-[-6%] h-[28%] rounded-t-full border-[2.5px] border-b-0 border-white/55" />
              <div className="absolute inset-x-0 top-[16%] bottom-0 rounded-[24%] bg-white/40 shadow-[inset_0_-5px_8px_rgba(0,0,0,0.12)]" />
              <div className="absolute inset-x-[20%] top-[26%] h-[13%] rounded-[30%] bg-white/65" />
            </div>
          </div>
          {/* floating chips — "new" badge + live viewers pill */}
          <span
            className="absolute start-[6%] top-[8%] rounded-[3px] px-1 py-px text-[5px] font-bold leading-none shadow-sm"
            style={{ background: '#ffffff', color: shadeColor(accent, 0.25) }}
          >
            {t('site.newBadge')}
          </span>
          <span className="absolute bottom-[10%] end-[6%] flex items-center gap-[3px] rounded-full bg-black/30 px-1.5 py-[2px] text-[5.5px] font-medium leading-none text-white backdrop-blur-sm">
            <span className="size-[3px] animate-pulse rounded-full bg-emerald-400" />
            {t('site.viewers')}
          </span>
          <div className="absolute inset-y-[-25%] start-[60%] w-[14%] rotate-[16deg] bg-white/20 blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/25" />
        </div>
      </div>

      {/* trust bar — four service promises */}
      <div className="grid h-[16px] shrink-0 grid-cols-4 gap-1 px-2">
        {trust.map((label, i) => {
          const Icon = TRUST_ICONS[i % TRUST_ICONS.length] ?? Truck
          return (
            <div
              key={label}
              className="flex min-w-0 items-center justify-center gap-[3px] rounded-md bg-stone-50 px-1"
            >
              <Icon className="size-[8px] shrink-0" style={{ color: accent }} />
              <span className="min-w-0 truncate text-[5.5px] font-medium leading-none text-stone-500">
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* product row */}
      <div className="mt-1 grid h-[27%] shrink-0 grid-cols-3 gap-1 px-2">
        {cards ? (
          cards.map((card, i) => {
            const off = discountPct(card.price, card.old)
            return (
              <div
                key={`${card.name}-${i}`}
                className="relative flex min-h-0 min-w-0 flex-col rounded-md border border-stone-200/90 bg-white p-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div
                  className="relative min-h-0 flex-1 overflow-hidden rounded-[4px]"
                  style={{
                    background: `linear-gradient(160deg, ${rgba(accent, 0.3)} 0%, ${rgba(accent, 0.1)} 100%)`,
                  }}
                >
                  <ProductArt i={i} />
                  {off !== null && (
                    <span
                      className="absolute start-[3px] top-[3px] rounded-[2px] px-[3px] py-px text-[5px] font-bold leading-none"
                      style={{ background: accent, color: onAccent }}
                    >
                      {`−${off}%`}
                    </span>
                  )}
                </div>
                <div className="mt-[2px] truncate text-[6px] font-medium leading-tight text-stone-800">
                  {card.name}
                </div>
                <div className="flex items-center justify-between gap-0.5">
                  <div className="flex min-w-0 items-baseline gap-0.5">
                    <span className="truncate text-[7px] font-bold leading-none text-stone-900">
                      {card.price}
                    </span>
                    {card.old && (
                      <span className="shrink-0 text-[5.5px] leading-none text-stone-400 line-through">
                        {card.old}
                      </span>
                    )}
                  </div>
                  <span
                    className="shrink-0 rounded-[3px] px-[4px] py-[1px] text-[6px] font-bold leading-none"
                    style={{ background: rgba(accent, 0.15), color: accentInk }}
                  >
                    {t('site.addToCart')}
                  </span>
                </div>
                <div className="mt-[1px] flex min-w-0 items-center gap-[3px] overflow-hidden">
                  <Star className="size-[5px] shrink-0 fill-amber-400 text-amber-400" />
                  <span className="shrink-0 text-[5.5px] font-bold leading-none text-stone-700">
                    {rating}
                  </span>
                  <span className="truncate text-[5.5px] leading-none text-stone-400">
                    {t('site.reviews')}
                  </span>
                </div>
              </div>
            )
          })
        ) : (
          // defensive fallback (no mock data) — keep the row visually stable
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex min-h-0 flex-col rounded-md border border-stone-200/90 bg-white p-[3px]"
            >
              <div className="min-h-0 flex-1 rounded-[4px] bg-stone-100" />
              <div className="mt-[2px] h-[5px] w-3/4 rounded-full bg-stone-200" />
              <div className="mt-[3px] h-[6px] w-1/2 rounded-full bg-stone-200" />
            </div>
          ))
        )}
      </div>

      {/* footer: service links • payment badges • copyright */}
      <div className="shrink-0 border-t border-stone-200 bg-stone-50 px-2 pb-[3px] pt-[3px]">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {footerLinks.map((l) => (
              <span key={l} className="whitespace-nowrap text-[6px] font-medium text-stone-500">
                {l}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-[3px]">
            {payments.map((p) => (
              <span
                key={p}
                dir="ltr"
                className="rounded-[3px] border border-stone-200 bg-white px-[3px] py-px text-[5px] font-bold leading-none text-stone-500"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-px truncate text-center text-[6px] text-stone-400">
          {`© ${mock?.brand ? `${mock.brand} — ` : ''}${t('site.footerNote')}`}
        </div>
      </div>

      {/* floating support bubble — the modern-site tell */}
      <span
        className="absolute bottom-[38%] end-2 z-10 flex size-[18px] items-center justify-center rounded-full shadow-md"
        style={{ background: accent }}
      >
        <MessageCircle className="size-[9px] text-white" />
      </span>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 2 — "site-old": a 2009 time capsule (ugly on purpose, rich on
   detail — masthead + banner ad, link-farm nav, scrolling news ticker,
   3-column table layout with poll/news/friends sidebars, hit counter…)
   -------------------------------------------------------------------------- */

/** The classic old-CMS module: bordered box + gray title bar. */
function OldBox({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[2px] border border-stone-400 bg-white',
        className
      )}
    >
      <div className="shrink-0 border-b border-stone-400 bg-stone-300 px-1 py-[2px] font-serif text-[6px] font-bold leading-none text-stone-800">
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-[3px]">{children}</div>
    </div>
  )
}

function SiteOldScene({ mock }: { mock?: MockContent }) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('old.nav'))
  const items = asStringArray(t.raw('old.items'))
  const categories = asStringArray(t.raw('old.categories'))
  const news = asStringArray(t.raw('old.news'))
  const friends = asStringArray(t.raw('old.friends'))
  // The "before" is the SAME business — products echo the modern catalog
  // when a per-project mock exists (the transformation story made literal).
  const products =
    mock?.cards && mock.cards.length > 0
      ? mock.cards.slice(0, 3).map((c) => ({ name: c.name, price: c.price }))
      : items.map((it, i) => ({ name: it, price: OLD_PRICES[i % OLD_PRICES.length] ?? '' }))
  const pollYesPct = 78

  return (
    <div className="flex h-full flex-col overflow-hidden bg-stone-100 font-serif text-stone-800">
      {/* garish all-caps announcement strip (blinking dots, marquee feel) */}
      <div className="flex h-[13px] shrink-0 items-center justify-center gap-1 bg-yellow-300 px-14">
        <span className="ba-scene-blink size-[4px] shrink-0 rounded-full bg-red-600" />
        <span className="truncate text-[6px] font-bold uppercase tracking-wider text-red-700">
          {t('old.announce')}
        </span>
        <span className="ba-scene-blink size-[4px] shrink-0 rounded-full bg-red-600" />
      </div>

      {/* masthead: boxed serif brand + slogan • 468×60-style banner ad */}
      <div
        className="flex h-[26px] shrink-0 items-center justify-between gap-1 border-b-2 border-stone-400 bg-stone-100 px-1.5 ps-10"
        style={{ backgroundImage: OLD_TILE_BG }}
      >
        <div className="flex min-w-0 items-center gap-1">
          <span className="flex size-[14px] shrink-0 items-center justify-center rounded-[2px] border border-stone-500 bg-yellow-200 text-[8px] leading-none text-amber-600">
            ★
          </span>
          <div className="min-w-0 leading-none">
            <span className="block truncate text-[9px] font-bold">
              {mock?.brand ?? t('old.fallbackBrand')}
            </span>
            <span className="mt-[2px] block truncate text-[5.5px] text-stone-600">{t('old.slogan')}</span>
          </div>
        </div>
        <div
          className="relative flex h-[18px] w-[34%] shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-stone-500"
          style={{ background: 'linear-gradient(90deg, #1d4ed8 0%, #7c3aed 50%, #db2777 100%)' }}
        >
          <span className="text-[5px] font-bold uppercase tracking-widest text-white/90">
            {t('old.adSpace')}
          </span>
          <span className="absolute end-px top-px bg-black/40 px-[2px] text-[4px] leading-none text-white">
            {t('old.adTag')}
          </span>
        </div>
      </div>

      {/* dense underlined link farm navbar */}
      <div className="flex h-[15px] shrink-0 flex-wrap items-center justify-center gap-x-1 overflow-hidden border-b border-stone-300 bg-stone-200 px-2">
        {nav.map((l, i) => (
          <span key={l} className="flex items-center gap-1">
            {i > 0 && <span className="text-[6px] leading-none text-stone-400">|</span>}
            <span className="whitespace-nowrap text-[6.5px] leading-none text-blue-700 underline">
              {l}
            </span>
          </span>
        ))}
      </div>

      {/* scrolling news ticker — the era's <marquee> (LTR track, Arabic
          items keep their own direction — the hero marquee pattern). */}
      <div
        className="flex h-[12px] shrink-0 items-center gap-1 overflow-hidden border-b border-stone-300 bg-yellow-100 px-1"
        dir="ltr"
      >
        <span className="shrink-0 rounded-[2px] bg-red-700 px-[3px] text-[4.5px] font-bold uppercase leading-none text-white">
          {t('old.tickerTag')}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="ba-scene-ticker-track flex w-max items-center">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
                <span className="whitespace-nowrap px-2 text-[5.5px] font-semibold leading-none text-stone-700">
                  {t('old.ticker')}
                </span>
                <span className="text-[5px] leading-none text-red-700">◆</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3-column table layout: sections sidebar • main • news sidebar */}
      <div className="flex min-h-0 flex-1 gap-[3px] p-[3px]" style={{ backgroundImage: OLD_TILE_BG }}>
        {/* start sidebar — site sections + the obligatory poll */}
        <aside className="flex w-[27%] min-w-0 shrink-0 flex-col gap-[3px]">
          <OldBox title={t('old.categoriesTitle')} className="min-h-0 flex-1">
            <div className="space-y-[3px]">
              {categories.map((c) => (
                <div key={c} className="flex items-center gap-[3px]">
                  <span className="shrink-0 text-[5px] leading-none text-red-700">▸</span>
                  <span className="min-w-0 truncate text-[5.5px] leading-tight text-blue-700 underline">
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </OldBox>
          <OldBox title={t('old.pollTitle')} className="shrink-0">
            <p className="text-center text-[5.5px] font-bold leading-snug">{t('old.pollQ')}</p>
            <div className="mt-[3px] space-y-[2px]">
              {[t('old.pollYes'), t('old.pollNo')].map((opt, i) => (
                <div key={opt} className="flex items-center gap-1">
                  <span
                    className={cn(
                      'size-[5px] shrink-0 rounded-full border border-stone-500',
                      i === 0 ? 'bg-red-700' : 'bg-white'
                    )}
                  />
                  <span className="w-[32%] shrink-0 truncate text-[5px] leading-none">{opt}</span>
                  <span className="h-[4px] min-w-0 flex-1 rounded-[1px] border border-stone-400 bg-stone-100">
                    <span
                      className={cn('block h-full', i === 0 ? 'bg-red-700' : 'bg-stone-500')}
                      style={{ width: i === 0 ? `${pollYesPct}%` : `${100 - pollYesPct}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-[3px] text-center text-[4.5px] italic leading-none text-stone-500">
              {t('old.pollVotes')}
            </p>
          </OldBox>
        </aside>

        {/* main column — welcome box + product table */}
        <main className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="shrink-0 rounded-[2px] border border-stone-400 bg-white p-1 text-center">
            <div className="flex items-start justify-center gap-1">
              <Smile className="mt-px size-3 shrink-0 text-yellow-500" />
              <p className="text-[6px] leading-snug text-stone-800">{t('old.welcome')}</p>
            </div>
            <span className="mt-1 inline-block border-2 border-t-white border-l-white border-b-stone-500 border-r-stone-500 bg-stone-300 px-2 py-[2px] text-[6.5px] font-bold leading-none text-red-700 shadow-[1px_1px_0_rgba(0,0,0,0.25)]">
              {t('old.clickHere')}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2px] border border-stone-400 bg-white">
            <div
              className="shrink-0 border-b border-stone-400 px-1 py-[2px] text-[6px] font-bold leading-none text-white"
              style={{ background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)' }}
            >
              {t('old.productsTitle')}
            </div>
            {products.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className={cn('flex items-center gap-1 px-1 py-[3px]', i > 0 && 'border-t border-stone-300')}
              >
                <span className="flex size-4 shrink-0 items-center justify-center border border-stone-400 bg-stone-200">
                  <ImageOff className="size-2 text-stone-400" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[6px] leading-none">{p.name}</span>
                <span
                  dir="ltr"
                  className="shrink-0 text-[6px] font-bold leading-none tabular-nums text-red-700"
                >
                  {p.price}
                </span>
                <span className="shrink-0 text-[5.5px] leading-none text-blue-700 underline">
                  {t('old.orderNow')}
                </span>
              </div>
            ))}
          </div>
        </main>

        {/* end sidebar — news + friends */}
        <aside className="flex w-[24%] min-w-0 shrink-0 flex-col gap-[3px]">
          <OldBox title={t('old.newsTitle')} className="min-h-0 flex-1">
            <div className="space-y-[3px]">
              {news.map((n) => (
                <div key={n} className="flex items-start gap-[3px]">
                  <span className="mt-[1px] size-[3px] shrink-0 rounded-full bg-red-700" />
                  <span className="min-w-0 text-[5px] leading-[1.4] text-stone-700">{n}</span>
                </div>
              ))}
            </div>
          </OldBox>
          <OldBox title={t('old.friendsTitle')} className="shrink-0">
            <div className="space-y-[2px]">
              {friends.map((f) => (
                <div key={f} className="truncate text-[5px] leading-tight text-blue-700 underline">
                  {f}
                </div>
              ))}
            </div>
          </OldBox>
        </aside>
      </div>

      {/* footer junk: counter + design credit • under-construction • best-viewed */}
      <div className="flex shrink-0 flex-col gap-[2px] border-t-2 border-stone-400 bg-stone-200 px-1 py-[3px]">
        <div className="flex items-center justify-between gap-1">
          <span
            className="shrink-0 rounded-[2px] bg-black px-1 py-px text-[5.5px] leading-none tracking-wider text-lime-400 shadow-[1px_1px_0_rgba(0,0,0,0.35)]"
            style={{ fontFamily: MONO_STACK }}
          >
            {t('old.counter')}
          </span>
          <span className="min-w-0 truncate text-[4.5px] italic leading-none text-stone-500">
            {t('old.credit')}
          </span>
        </div>
        <div className="flex h-[10px] w-full items-stretch overflow-hidden rounded-[2px] border border-stone-400">
          <span
            className="w-[6px] shrink-0"
            style={{
              background: 'repeating-linear-gradient(45deg, #facc15 0 3px, #1c1917 3px 6px)',
            }}
          />
          <span className="min-w-0 flex-1 truncate bg-yellow-100 px-1 text-[5.5px] font-bold leading-none text-stone-800">
            {t('old.construction')}
          </span>
          <span
            className="w-[6px] shrink-0"
            style={{
              background: 'repeating-linear-gradient(45deg, #facc15 0 3px, #1c1917 3px 6px)',
            }}
          />
        </div>
        <p className="truncate text-center text-[4.5px] italic leading-none text-stone-500">
          {t('old.bestViewed')}
        </p>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 3 — "dashboard-new": modern dark SaaS console
   -------------------------------------------------------------------------- */

function DashNewScene({ accent, brand }: { accent: string; brand?: string }) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('dash.nav'))
  const kpis = asKpis(t.raw('dash.kpis'))
  const range = asStringArray(t.raw('dash.range'))
  const tableHead = asStringArray(t.raw('dash.tableHead'))
  const rows = asRows(t.raw('dash.rows'))
  // unique per-instance gradient id (several sliders can share a page)
  const gid = `ba-chart-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const welcome = t('dash.welcome')
  // The topbar's last word is the user's name ("مساء الخير، زينب") — the
  // sidebar chip shows it next to the initial instead of skeleton bars.
  const name = welcome.trim().split(/\s+/).pop() ?? ''
  const initial = name.charAt(0) ?? ''
  const TABLE_COLS = 'grid-cols-[1fr_1.3fr_0.7fr_0.85fr]'

  return (
    <div className="flex h-full overflow-hidden bg-elyra-dark text-elyra-on-dark">
      {/* sidebar */}
      <aside className="flex w-[27%] shrink-0 flex-col gap-1 border-e border-white/10 bg-white/[0.03] p-1">
        <div
          className="flex min-w-0 items-center gap-1 rounded-md px-1 py-[3px]"
          style={{ background: rgba(accent, 0.2) }}
        >
          <span className="size-[6px] shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate text-[7px] font-bold leading-none">{brand ?? ''}</span>
        </div>
        <nav className="flex flex-col gap-[2px]">
          {nav.map((item, i) => {
            const Icon = DASH_ICONS[i % DASH_ICONS.length] ?? LayoutDashboard
            const active = i === 0
            return (
              <span
                key={item}
                className={cn(
                  'flex min-w-0 items-center gap-1 rounded-[4px] px-1 py-[3px] text-[6px] font-semibold leading-none',
                  active ? 'text-white' : 'text-white/55'
                )}
                style={active ? { background: rgba(accent, 0.22) } : undefined}
              >
                <Icon
                  className="size-[9px] shrink-0"
                  style={active ? { color: accent } : undefined}
                />
                <span className="truncate">{item}</span>
              </span>
            )
          })}
        </nav>
        {/* sidebar footer — storage meter + named user chip */}
        <div className="mt-auto flex shrink-0 flex-col gap-1">
          <div className="rounded-md border border-white/10 bg-white/[0.04] px-1 py-[3px]">
            <div className="flex items-center justify-between gap-1">
              <span className="min-w-0 truncate text-[5px] leading-none text-white/45">{t('dash.storage')}</span>
              <span
                dir="ltr"
                className="shrink-0 text-[5px] font-semibold leading-none tabular-nums text-white/70"
              >
                {t('dash.storageValue')}
              </span>
            </div>
            <div className="mt-[3px] h-[3px] overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[72%] rounded-full" style={{ background: accent }} />
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1 py-[3px]">
            <span
              className="flex size-[13px] shrink-0 items-center justify-center rounded-full text-[5px] font-bold leading-none text-white"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${tintColor(accent, 0.45)})`,
              }}
            >
              {initial}
            </span>
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="min-w-0 truncate text-[6px] font-bold leading-none">{name}</span>
              <span className="min-w-0 truncate text-[5px] leading-none text-white/45">{t('dash.role')}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar: welcome • search • bell • avatar */}
        <div className="flex h-[22px] shrink-0 items-center justify-between gap-1 border-b border-white/10 bg-white/[0.03] px-1.5 pe-[52px]">
          <span className="min-w-0 truncate text-[6px] font-semibold leading-none text-white/85">
            {welcome}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <span className="flex min-w-0 items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-1 py-px">
              <Search className="size-[8px] shrink-0 text-white/40" />
              <span className="max-w-[64px] truncate text-[6px] leading-none text-white/40">
                {t('dash.search')}
              </span>
            </span>
            <span className="relative block">
              <Bell className="size-[10px] text-white/60" />
              <span className="absolute -end-px -top-px size-[4px] rounded-full bg-red-500" />
            </span>
            <span className="max-w-[70px] truncate text-[6px] leading-none text-white/45">
              {t('dash.notifications')}
            </span>
            <span
              className="flex size-[13px] shrink-0 items-center justify-center rounded-full border border-white/25 text-[5px] font-bold leading-none"
              style={{ background: `linear-gradient(135deg, ${accent}, ${shadeColor(accent, 0.35)})` }}
            >
              {initial}
            </span>
          </div>
        </div>

        {/* content: KPIs • chart • table */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5">
          <div className="grid shrink-0 grid-cols-4 gap-1">
            {kpis.map((k, i) => {
              const up = k.delta.trim().startsWith('+')
              const spark = KPI_SPARKS[i % KPI_SPARKS.length] ?? []
              return (
                <div
                  key={k.label}
                  className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-1 py-[3px]"
                >
                  <div className="truncate text-[6px] leading-none text-white/50">{k.label}</div>
                  <div className="mt-[3px] flex items-baseline justify-between gap-0.5">
                    <span className="min-w-0 truncate text-[8px] font-bold leading-none tabular-nums">
                      {k.value}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-[3px] py-[1px] text-[5px] font-bold leading-none tabular-nums',
                        up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'
                      )}
                    >
                      {k.delta}
                    </span>
                  </div>
                  {/* mini sparkline — last bar carries the full accent */}
                  <div className="mt-[3px] flex h-[7px] items-end gap-[2px]">
                    {spark.map((h, j) => (
                      <span
                        key={j}
                        className="w-[3px] shrink-0 rounded-[1px]"
                        style={{
                          height: `${h}%`,
                          background: rgba(accent, j === spark.length - 1 ? 0.9 : 0.28),
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* area chart */}
          <div className="flex min-h-0 flex-1 flex-col rounded-md border border-white/10 bg-white/[0.04] p-1">
            <div className="flex shrink-0 items-center justify-between gap-1">
              <span className="min-w-0 truncate text-[6px] font-semibold leading-none">
                {t('dash.chartTitle')}
              </span>
              <div className="flex shrink-0 items-center gap-[3px]">
                <span className="flex items-center gap-[3px] rounded-full bg-emerald-400/10 px-1 py-[2px] text-[5px] font-bold leading-none text-emerald-300">
                  <span className="size-[3px] animate-pulse rounded-full bg-emerald-400" />
                  {t('dash.live')}
                </span>
                {range.map((r, i) => (
                  <span
                    key={r}
                    className={cn(
                      'whitespace-nowrap rounded-[3px] px-[3px] py-[1px] text-[5px] font-semibold leading-none',
                      i === range.length - 1 ? 'text-white' : 'text-white/45'
                    )}
                    style={i === range.length - 1 ? { background: rgba(accent, 0.3) } : undefined}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <svg
              className="mt-1 min-h-0 w-full flex-1"
              viewBox="0 0 100 40"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[10, 20, 30].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                />
              ))}
              <path d={CHART_AREA} fill={`url(#${gid})`} />
              <path
                d={CHART_LINE}
                fill="none"
                stroke={accent}
                strokeWidth="1.4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={CHART_LAST[0]}
                cy={CHART_LAST[1]}
                r="1.6"
                fill={accent}
                stroke="#ffffff"
                strokeWidth="0.5"
              />
            </svg>
          </div>

          {/* latest operations table */}
          <div className="shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
            <div className="flex items-center justify-between gap-1 border-b border-white/10 px-1 py-[3px]">
              <span className="min-w-0 truncate text-[6px] font-semibold leading-none">
                {t('dash.tableTitle')}
              </span>
              <span
                className="shrink-0 text-[5px] font-semibold leading-none"
                style={{ color: accent }}
              >
                {t('dash.viewAll')}
              </span>
            </div>
            <div className={cn('grid gap-1 border-b border-white/5 px-1 py-[3px]', TABLE_COLS)}>
              {tableHead.map((h) => (
                <span key={h} className="min-w-0 truncate text-[6px] leading-none text-white/40">
                  {h}
                </span>
              ))}
            </div>
            {rows.map((r) => {
              const done = /مكتمل|completed/i.test(r.status)
              return (
                <div
                  key={r.ref}
                  className={cn(
                    'grid items-center gap-1 border-b border-white/5 px-1 py-[3px] last:border-b-0',
                    TABLE_COLS
                  )}
                >
                  <span
                    dir="ltr"
                    className="min-w-0 truncate text-[6px] leading-none text-white/60"
                    style={{ fontFamily: MONO_STACK }}
                  >
                    {r.ref}
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className="size-[6px] shrink-0 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${tintColor(accent, 0.25)}, ${shadeColor(accent, 0.15)})`,
                      }}
                    />
                    <span className="min-w-0 truncate text-[6px] leading-none text-white/85">
                      {r.party}
                    </span>
                  </span>
                  <span dir="ltr" className="min-w-0 truncate text-[6px] leading-none tabular-nums text-white/85">
                    {r.amount}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 truncate rounded-full px-[4px] py-[1px] text-[6px] font-semibold leading-none',
                      done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-blue-400/15 text-blue-300'
                    )}
                  >
                    {r.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 4 — "dashboard-old": spreadsheet misery
   -------------------------------------------------------------------------- */

function OldCell({
  children,
  className,
  innerClassName,
  innerStyle,
  dir,
}: {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  innerStyle?: React.CSSProperties
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <span
      className={cn(
        'flex min-w-0 items-center border-e border-stone-400 px-[3px] last:border-e-0',
        className
      )}
    >
      <span
        dir={dir}
        className={cn('min-w-0 truncate text-[6px] leading-none', innerClassName)}
        style={innerStyle}
      >
        {children}
      </span>
    </span>
  )
}

function DashOldScene() {
  const t = useTranslations('workSection.scenes')
  const cols = asStringArray(t.raw('oldDash.cols'))
  const menubar = asStringArray(t.raw('oldDash.menubar'))
  const sheets = asStringArray(t.raw('oldDash.sheets'))

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-stone-200 text-stone-800">
      {/* window title strip (file name centered, beveled buttons) */}
      <div className="relative flex h-[14px] shrink-0 items-center justify-center border-b border-stone-500 bg-stone-300 px-14">
        <span className="min-w-0 truncate font-serif text-[6px] leading-none text-stone-800">
          {t('oldDash.file')}
        </span>
        <span className="absolute end-1 flex items-center gap-[2px]">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="size-[9px] border border-t-white border-l-white border-b-stone-500 border-r-stone-500 bg-stone-200"
            />
          ))}
          <span className="flex size-[9px] items-center justify-center border border-t-white border-l-white border-b-stone-500 border-r-stone-500 bg-stone-200">
            <X className="size-[7px] text-stone-700" />
          </span>
        </span>
      </div>

      {/* classic menu bar — ملف تحرير عرض … the unmistakable Excel tell */}
      <div className="flex h-[12px] shrink-0 items-center gap-1.5 overflow-hidden border-b border-stone-400 bg-stone-100 px-1">
        {menubar.map((m) => (
          <span
            key={m}
            className="whitespace-nowrap font-serif text-[5.5px] leading-none text-stone-800"
          >
            {m}
          </span>
        ))}
      </div>

      {/* toolbar with beveled buttons */}
      <div className="flex h-[13px] shrink-0 items-center gap-[2px] border-b border-stone-400 bg-stone-100 px-1">
        {['B', 'I', 'U'].map((ch) => (
          <span
            key={ch}
            className={cn(
              'flex size-[10px] items-center justify-center border border-t-white border-l-white border-b-stone-500 border-r-stone-500 bg-stone-300 text-[5px] leading-none text-stone-800',
              ch === 'B' && 'font-bold',
              ch === 'I' && 'italic',
              ch === 'U' && 'underline'
            )}
          >
            {ch}
          </span>
        ))}
        <span className="mx-[2px] h-[10px] w-px shrink-0 bg-stone-400" />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="size-[10px] border border-t-white border-l-white border-b-stone-500 border-r-stone-500 bg-stone-300"
          />
        ))}
      </div>

      {/* formula bar */}
      <div className="flex h-[12px] shrink-0 items-center gap-1 border-b border-stone-400 bg-stone-100 px-1">
        <span className="shrink-0 font-serif text-[6px] italic leading-none text-stone-600">fx</span>
        <span className="h-[8px] w-px shrink-0 bg-stone-400" />
        <span
          dir="ltr"
          className="min-w-0 flex-1 truncate text-[6px] leading-none text-stone-800"
          style={{ fontFamily: MONO_STACK }}
        >
          {t('oldDash.formula')}
        </span>
      </div>

      {/* sheet: column letters chrome + header row (row 1) + dense grid */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'grid shrink-0 border-b border-stone-400 bg-stone-300',
            SHEET_COLS
          )}
        >
          <span className="border-e border-stone-400" />
          {cols.map((_, i) => (
            <span
              key={i}
              dir="ltr"
              className="border-e border-stone-400 px-[3px] text-center text-[5px] leading-[10px] text-stone-600 last:border-e-0"
              style={{ fontFamily: MONO_STACK }}
            >
              {COL_LETTERS[i] ?? ''}
            </span>
          ))}
        </div>
        <div className={cn('grid shrink-0 border-b-2 border-stone-500 bg-stone-300', SHEET_COLS)}>
          <span className="flex items-center justify-center border-e border-stone-400 bg-stone-200 text-[5px] leading-none tabular-nums text-stone-500">
            1
          </span>
          {cols.map((c) => (
            <OldCell key={c} className="py-[2px]" innerClassName="font-bold text-stone-700">
              {c}
            </OldCell>
          ))}
        </div>
        {OLD_SHEET_ROWS.map((r, i) => (
          <div
            key={`${r.date}-${i}`}
            className={cn(
              'grid min-h-0 flex-1 border-b border-stone-400 bg-white last:border-b-0',
              SHEET_COLS
            )}
          >
            <span className="flex items-center justify-center border-e border-stone-400 bg-stone-100 text-[5px] leading-none tabular-nums text-stone-500">
              {i + 2}
            </span>
            <OldCell dir="ltr" innerClassName="tabular-nums text-stone-700">
              {r.date}
            </OldCell>
            <OldCell>{r.name}</OldCell>
            {/* last row's amount cell is the formula's selected cell */}
            <OldCell
              dir="ltr"
              className={i === OLD_SHEET_ROWS.length - 1 ? 'relative z-10' : undefined}
              innerClassName={cn(
                'tabular-nums',
                r.error === 'ref'
                  ? 'font-bold text-red-700'
                  : r.error === 'hash'
                    ? 'text-stone-500'
                    : 'text-stone-800'
              )}
              innerStyle={
                i === OLD_SHEET_ROWS.length - 1
                  ? { boxShadow: 'inset 0 0 0 1.5px #1d4ed8' }
                  : undefined
              }
            >
              {r.amount}
            </OldCell>
            <OldCell innerClassName={cn(r.pending && 'font-semibold text-red-700')}>
              {r.pending ? t('oldDash.status') : ''}
            </OldCell>
          </div>
        ))}
      </div>

      {/* sheet tabs + status bar — the bottom Excel chrome */}
      <div className="flex h-[13px] shrink-0 items-center gap-[2px] border-t border-stone-400 bg-stone-200 px-1">
        {sheets.map((s, i) => (
          <span
            key={s}
            className={cn(
              'flex h-full items-center border-x border-t border-stone-400 px-[4px] font-serif text-[5.5px] leading-none',
              i === 0
                ? 'bg-white font-bold text-stone-800'
                : 'bg-stone-300 text-stone-600'
            )}
          >
            {s}
          </span>
        ))}
        <span className="ms-auto shrink-0 font-serif text-[5.5px] italic leading-none text-stone-600">
          {t('oldDash.ready')}
        </span>
      </div>

      {/* unsaved-changes warning dialog overlay */}
      <div className="absolute bottom-[17px] start-1.5 end-1.5 z-10 flex items-center gap-1 rounded-[2px] border border-red-700 bg-yellow-300 px-1 py-[3px] shadow-[3px_3px_0_rgba(0,0,0,0.3)]">
        <TriangleAlert className="size-[10px] shrink-0 text-red-700" />
        <span className="min-w-0 flex-1 truncate text-[6px] font-bold leading-none text-red-700">
          {t('oldDash.warning')}
        </span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene dispatcher — purely decorative content (aria-hidden); the slider
   itself carries its own accessible name/controls.
   -------------------------------------------------------------------------- */

function Scene({ variant, accent, mock }: { variant: SceneVariant; accent: string; mock?: MockContent }) {
  return (
    <div className="size-full" aria-hidden="true">
      {variant === 'site-new' && <SiteNewScene accent={accent} mock={mock} />}
      {/* R8: the OLD scenes receive the mock too — the "before" is the SAME
          business (brand on the 2009 masthead, products echoed in the old
          table), which sells the before→after transformation. */}
      {variant === 'site-old' && <SiteOldScene mock={mock} />}
      {variant === 'dashboard-new' && <DashNewScene accent={accent} brand={mock?.brand} />}
      {variant === 'dashboard-old' && <DashOldScene />}
    </div>
  )
}

interface BeforeAfterProps {
  variant: SceneVariant
  accent?: string
  className?: string
  /** aria label prefix — REQUIRED (FIX 2-c/17): every call site passes a
   *  localized project title; no untranslated default literal. */
  label: string
  /** Per-project mock content for the "after" scene (see MockContent). */
  mock?: MockContent
}

export function BeforeAfter({
  variant,
  accent = '#0071E3',
  className,
  label,
  mock,
}: BeforeAfterProps) {
  const t = useTranslations('workSection')
  const tc = useTranslations('common') // WS-2: cursor context label
  const reduced = usePrefersReducedMotion()
  const isRtl = useIsRtl()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50) // 0-100
  const dragging = useRef(false)

  const beforeVariant: SceneVariant = variant.includes('site') ? 'site-old' : 'dashboard-old'
  const afterVariant = variant

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // pos is measured from the START edge (left in LTR, right in RTL) so the
    // reveal direction follows the reading direction (audit P1-13).
    const x = isRtl ? rect.right - clientX : clientX - rect.left
    const pct = (x / rect.width) * 100
    setPos(Math.max(2, Math.min(98, pct)))
  }, [isRtl])

  // L3 FIX (R5): rAF-coalesced drag (GlowCard pattern, bento.tsx) — the
  // rect read + setState ran on EVERY pointermove (120+ re-renders/s on
  // 120Hz hardware; every sibling surface coalesces). pointermove now just
  // stores the latest clientX in a ref and schedules ONE frame that applies
  // it; the queued frame is cancelled on unmount and on drag-end (which
  // applies the final position synchronously so the reveal never lags the
  // pointerup).
  const pendingXRef = useRef(0)
  const dragRafRef = useRef(0)
  const schedulePosFromPending = useCallback(() => {
    if (dragRafRef.current) return
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = 0
      setFromClientX(pendingXRef.current)
    })
  }, [setFromClientX])
  useEffect(
    () => () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current)
    },
    []
  )

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    setFromClientX(e.clientX) // single event — apply synchronously
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    pendingXRef.current = e.clientX
    schedulePosFromPending()
  }
  const onPointerUp = () => {
    dragging.current = false
    // Drag-end: cancel any queued frame and apply the final pending
    // position immediately (pre-fix behavior had every move applied by
    // now — this preserves the final-position guarantee).
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = 0
      setFromClientX(pendingXRef.current)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPos((p) => Math.max(2, p - (isRtl ? -step : step)))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPos((p) => Math.min(98, p + (isRtl ? -step : step)))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPos(2)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPos(98)
    }
  }

  // Clip is mirrored in RTL: pos counts from the START edge (right), so the
  // "after" layer reveals from the LEFT — matching RTL reading order where
  // "before" sits on the right and "after" on the left (audit P1-13).
  const clipAfter = isRtl ? `inset(0 ${pos}% 0 0)` : `inset(0 0 0 ${pos}%)`

  return (
    <div
      ref={containerRef}
      data-cursor="drag"
      data-cursor-label={tc('cursor.drag')}
      className={cn(
        // R8.1: taller 4/3 frame below sm — the dense mockup scenes need
        // the extra height to stay legible on phone-width cards; back to
        // the cinematic 16/10 from sm up.
        'relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-border bg-card touch-none sm:aspect-[16/10]',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* scene-local keyframes (frozen by the global reduced-motion switch) */}
      <style>{SCENE_KEYFRAMES}</style>

      {/* before layer (bottom) */}
      <div className="absolute inset-0">
        <Scene variant={beforeVariant} accent={accent} />
        <span className="absolute start-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {t('before')}
        </span>
      </div>

      {/* after layer (top, clipped) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: clipAfter, WebkitClipPath: clipAfter }}
      >
        <Scene variant={afterVariant} accent={accent} mock={mock} />
        <span className="absolute end-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground backdrop-blur-sm">
          {t('after')}
        </span>
      </div>

      {/* handle — anchored to the START edge (right in RTL) */}
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-white/80"
        style={isRtl ? { right: `${pos}%` } : { left: `${pos}%` }}
        aria-hidden="true"
      >
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/90 text-elyra-dark shadow-lg">
          <MoveHorizontal className="size-4" />
        </div>
      </div>

      {/* accessible slider control (invisible but focusable) — bounds
          match the actual clamp range (FIX 2-c/17: was 0–100 while the
          pointer/keyboard logic clamps to 2–98). */}
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={2}
        aria-valuemax={98}
        aria-valuenow={Math.round(pos)}
        aria-label={`${label}: ${t('dragHint')}`}
        aria-valuetext={`${Math.round(pos)}%`}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 z-20 w-2 cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{
          ...(isRtl ? { right: `calc(${pos}% - 4px)` } : { left: `calc(${pos}% - 4px)` }),
          touchAction: 'none',
        }}
      />

      {/* hint — CSS keyframes cycle (.ba-hint), framer-free (§4.3) */}
      {reduced ? null : (
        <div className="ba-hint pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {t('dragHint')}
        </div>
      )}
    </div>
  )
}
