'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  Bath,
  BedDouble,
  Bell,
  Building2,
  CalendarCheck,
  Check,
  Clock3,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Heart,
  ImageOff,
  LayoutDashboard,
  ListTodo,
  Lock,
  MapPin,
  MessageCircle,
  MoveHorizontal,
  Phone,
  PlayCircle,
  Plus,
  RotateCcw,
  Ruler,
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
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsRtl } from '@/lib/use-rtl'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'
import {
  asRows,
  asString,
  asStringArray,
  discountPct,
  isRecord,
  type Kpi,
  type MockContent,
} from '@/lib/catalog-guards'

// L6-R2 (fix 6): the t.raw() narrowing helpers + guarded discountPct now
// live in @/lib/catalog-guards (shared with bento/work-grid/featured-work/
// deconstructed-card/services-websites). Re-exported here so the parents'
// historical import surface (`from '@/components/home/before-after'`)
// keeps working.
export { toMockContent, type MockContent } from '@/lib/catalog-guards'

/* R9 industry scenes — each "after" archetype gets its own layout so the
 * four website projects no longer share one storefront skeleton (the
 * "مواقع متشابهة" report). The matching "before" keeps the 2009 chrome
 * but its content is flavored per industry (old.{industry}.*). */
type OldIndustry = 'store' | 'property' | 'academy' | 'dining'

type SceneVariant =
  | 'site-old'
  | 'site-new'
  | 'property-new'
  | 'academy-new'
  | 'dining-new'
  | 'kanban-new'
  | 'dashboard-old'
  | 'dashboard-new'

/**
 * Per-project mock content for the "after" scenes. Resolved by the parents
 * (featured-work.tsx / work-grid.tsx) via t.raw(...) and narrowed through
 * toMockContent(). Every field is optional — scenes degrade to neutral
 * placeholders when a parent passes nothing. (Interface + narrowers live
 * in @/lib/catalog-guards.ts — re-exported above.)
 */

/* --------------------------------------------------------------------------
   t.raw() narrowing helpers — MOVED to src/lib/catalog-guards.ts (L6-R2:
   one shared, never-throwing module instead of a private copy here while
   sibling components used unsound `as` casts). See the import above.
   -------------------------------------------------------------------------- */

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

/* discountPct ("−18%"-style, null → no badge) moved to
   @/lib/catalog-guards.ts — imported above (L6-R2 dedup). */

const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* --------------------------------------------------------------------------
   G3-4 per-scene palettes (G2-2 F2 — the sameness cure). Each /work website
   project passes a palette derived from its Stitch brand world (G2-2 prompt
   specs: لمسة warm stone/clay · عقار بلس emerald/teal · مسار terracotta ·
   بيت الشام espresso/cream/tomato). The palette lands as CSS custom
   properties on the scene root and the scene's surface/ink/border classes
   consume them — so a scene's neutrals shift with its brand world while the
   accent channel (fills/badges) keeps flowing through the `accent` prop.
   When NO palette is passed (homepage featured-work), the tokens resolve to
   the historical stone/white values — pixel-identical default look. The
   ELYRA brand tokens are untouched: they stay on the page shell (cards,
   hero, CTA) — only the mock scene interiors change.
   -------------------------------------------------------------------------- */

export interface ScenePalette {
  /** brand primary — fills, badges, chips (replaces the single accent) */
  primary: string
  /** page surface (default: pure white) */
  surface?: string
  /** muted panels — footer/trust bars/inactive chips (default: stone-50) */
  surfaceMuted?: string
  /** strong hairline (default: stone-200) */
  border?: string
  /** faint hairline (default: stone-100) */
  borderSoft?: string
  /** heading ink (default: stone-900) */
  ink?: string
  /** body ink (default: stone-800) */
  inkSoft?: string
  /** secondary ink (default: stone-500) */
  inkMuted?: string
  /** tertiary ink (default: stone-400) */
  inkFaint?: string
}

/** Neutral defaults — the exact Tailwind stone scale the scenes used as
 *  literal classes, so the no-palette path renders identically. */
const NEUTRAL_SCENE_VARS: Record<string, string> = {
  '--sc-surface': '#ffffff',
  '--sc-surface-muted': '#fafaf9',
  '--sc-border': '#e7e5e4',
  '--sc-border-soft': '#f5f5f4',
  '--sc-ink': '#1c1917',
  '--sc-ink-soft': '#292524',
  '--sc-ink-muted': '#78716c',
  '--sc-ink-faint': '#a8a29e',
}

/** Resolve a palette (or none) into the CSS var style object that the
 *  website-scene roots carry — vars cascade to every token class below. */
function sceneVars(palette?: ScenePalette): React.CSSProperties {
  const vars: Record<string, string> = { ...NEUTRAL_SCENE_VARS }
  if (palette) {
    if (palette.surface) vars['--sc-surface'] = palette.surface
    if (palette.surfaceMuted) vars['--sc-surface-muted'] = palette.surfaceMuted
    if (palette.border) vars['--sc-border'] = palette.border
    if (palette.borderSoft) vars['--sc-border-soft'] = palette.borderSoft
    if (palette.ink) vars['--sc-ink'] = palette.ink
    if (palette.inkSoft) vars['--sc-ink-soft'] = palette.inkSoft
    if (palette.inkMuted) vars['--sc-ink-muted'] = palette.inkMuted
    if (palette.inkFaint) vars['--sc-ink-faint'] = palette.inkFaint
  }
  return vars as React.CSSProperties
}

/* --------------------------------------------------------------------------
   G2-2 scene catalog narrowers — extensions of the shared catalog-guards
   shapes with fields only the /work scenes consume. Built on the same
   shared primitives (isRecord/asString) and the same never-throw,
   degrade-to-empty contract; local (not in catalog-guards.ts) to keep this
   wave's file set untouched.
   -------------------------------------------------------------------------- */

/** Per-KPI semantic direction (G2-2 F1): dash.kpis entries may carry
 *  `lowerIsBetter: true` — on such metrics a NEGATIVE delta is the GOOD
 *  outcome ("بحاجة متابعة −41%" — a 41% drop in follow-ups-needed), so the
 *  delta chip must color by semantic outcome, not by raw sign. */
interface SceneKpi extends Kpi {
  lowerIsBetter?: boolean
}

function asSceneKpis(value: unknown): SceneKpi[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({
      label: asString(r.label),
      value: asString(r.value),
      delta: asString(r.delta),
      lowerIsBetter: typeof r.lowerIsBetter === 'boolean' ? r.lowerIsBetter : undefined,
    }))
    .filter((k) => k.label !== '' || k.value !== '')
}

/** Per-product rating/review pairs (scenes.site.products) — G2-2 F4/F10:
 *  the storefront's three cards must not share one identical ★rating·count. */
interface ProductRating {
  rating: string
  reviews: string
}

function asProductRatings(value: unknown): ProductRating[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({ rating: asString(r.rating), reviews: asString(r.reviews) }))
    .filter((p) => p.rating !== '')
}

/* G2-2 F7: slim browser chrome for the four "after" website scenes —
 * traffic dots + lock + URL pill. Deliberately physical LTR (real window
 * chrome never mirrors with the page direction); the domain is a
 * per-scene Latin catalog key. The before-scenes keep their own era chrome
 * (2009 announcement strips, the Excel-2003 title bar) — this is the 2025
 * counterpart, kept subtle: these are modern sites, not 2009 time capsules. */
function BrowserChrome({ domain }: { domain: string }) {
  return (
    <div
      dir="ltr"
      className="flex h-[11px] shrink-0 items-center gap-[4px] border-b border-stone-200 bg-[#F4F4F6] px-[6px]"
    >
      <span className="size-[4px] shrink-0 rounded-full bg-[#FF5F57]" />
      <span className="size-[4px] shrink-0 rounded-full bg-[#FEBC2E]" />
      <span className="size-[4px] shrink-0 rounded-full bg-[#28C840]" />
      <span className="mx-auto flex h-[7px] min-w-0 max-w-[56%] items-center gap-[3px] rounded-full border border-stone-200 bg-white px-[5px]">
        <Lock className="size-[5px] shrink-0 text-stone-400" />
        <span className="min-w-0 truncate text-[5px] font-medium leading-none text-stone-500">
          {domain}
        </span>
      </span>
      {/* trailing counterweight keeps the URL pill optically centered */}
      <span className="w-[26px] shrink-0" />
    </div>
  )
}

/* R8 "real screenshot" pass — shared era/scene constants. */
/** Faint graph-paper tiling behind the 2009 site body + masthead. */
const OLD_TILE_BG =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px), repeating-linear-gradient(90deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 7px)'
/** Prices for the old product table when no per-project mock exists. */
const OLD_PRICES = ['12,500', '8,900', '15,400']
/** R9: per-industry old-portal accent — the shared 2009 chrome stays, but
 *  each business era-portal tints its section headers/poll bars/ad banner
 *  differently so even the "before" cards don't read as photocopies. */
const OLD_THEME: Record<OldIndustry, { header: string; ad: string; bar: string }> = {
  store: {
    header: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
    ad: 'linear-gradient(90deg, #1d4ed8 0%, #7c3aed 50%, #db2777 100%)',
    bar: '#dc2626',
  },
  property: {
    header: 'linear-gradient(180deg, #16a34a, #166534)',
    ad: 'linear-gradient(90deg, #166534 0%, #16a34a 50%, #84cc16 100%)',
    bar: '#166534',
  },
  academy: {
    header: 'linear-gradient(180deg, #7c3aed, #5b21b6)',
    ad: 'linear-gradient(90deg, #5b21b6 0%, #7c3aed 50%, #c026d3 100%)',
    bar: '#6d28d9',
  },
  dining: {
    header: 'linear-gradient(180deg, #dc2626, #991b1b)',
    ad: 'linear-gradient(90deg, #991b1b 0%, #dc2626 50%, #f59e0b 100%)',
    bar: '#b91c1c',
  },
}
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

/** G3-4: real product photography for the storefront's three cards — the
 *  wool-coat crop (from the Stitch lookbook), the leather handbag and the
 *  cashmere-scarf product photo (Stitch storefront grid / IMAGE screen).
 *  Position-aligned with pages.work.projects.p1.mock.cards. */
const SITE_PRODUCT_PHOTOS: ReadonlyArray<readonly [string, number, number]> = [
  ['/work-scenes/store-product-coat.webp', 190, 210],
  ['/work-scenes/store-product-bag.webp', 384, 512],
  ['/work-scenes/store-product-scarf.webp', 384, 512],
]

function SiteNewScene({
  accent,
  palette,
  mock,
}: {
  accent: string
  palette?: ScenePalette
  mock?: MockContent
}) {
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
  const productRatings = asProductRatings(t.raw('site.products'))

  return (
    <div
      className="@container relative flex h-full flex-col overflow-hidden bg-[var(--sc-surface)] text-[var(--sc-ink)]"
      style={sceneVars(palette)}
    >
      {/* G2-2 F7: browser chrome — traffic dots + lock + URL pill */}
      <BrowserChrome domain={t('site.domain')} />

      {/* announcement bar (accent-tinted) — its px-14 also keeps the centered
          text clear of the AFTER chip, which rides on the chrome + this row */}
      <div
        className="flex h-[13px] shrink-0 items-center justify-center px-14"
        style={{ background: rgba(accent, 0.12) }}
      >
        <span className="truncate text-[6px] font-semibold tracking-wide" style={{ color: accentInk }}>
          {t('site.announce')}
        </span>
      </div>

      {/* navbar: brand • links • search pill • wishlist • account • cart
          (G2-2 F9: the old pe-[52px] reservation is gone — with the browser
          chrome above, the AFTER chip (y≈8–27) covers chrome + announcement
          only; nothing overlays this row or the chips row below) */}
      <div className="flex h-[22px] shrink-0 items-center justify-between gap-2 border-b border-[var(--sc-border)] bg-[var(--sc-surface)] px-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="size-[6px] shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate text-[8px] font-extrabold tracking-tight">{mock?.brand ?? ''}</span>
        </div>
        <nav className="flex min-w-0 items-center gap-1.5 overflow-hidden">
          {nav.map((l) => (
            <span key={l} className="whitespace-nowrap text-[6px] font-medium text-[var(--sc-ink-muted)]">
              {l}
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-0.5 rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-1.5 py-px">
            <Search className="size-[7px] shrink-0 text-[var(--sc-ink-faint)]" />
            <span className="whitespace-nowrap text-[6px] text-[var(--sc-ink-faint)]">{t('site.search')}</span>
          </span>
          <Heart className="size-[10px] shrink-0 text-[var(--sc-ink-muted)]" />
          <User className="size-[10px] shrink-0 text-[var(--sc-ink-muted)]" />
          <span className="relative block text-[var(--sc-ink-soft)]">
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
      <div className="flex h-[15px] shrink-0 items-center gap-1 border-b border-[var(--sc-border-soft)] bg-[var(--sc-surface)] px-2">
        {categories.map((c, i) => (
          <span
            key={c}
            className={cn(
              'whitespace-nowrap rounded-full px-1.5 py-[1.5px] text-[5.5px] font-semibold leading-none',
              i === 0 ? 'text-white' : 'bg-[var(--sc-surface-muted)] text-[var(--sc-ink-muted)]'
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
          {/* G2-2 F5: display type scales with the CARD (container query),
              10px → up to 18px — the miniature reads like a real site
              screenshot scaled down instead of a dollhouse diorama. Spans
              (not <p>): the unlayered :lang(ar) p rule would force 1.8
              line-height over the designed 1.12/1.3 and blow the hero
              budget at small cards. */}
          {mock?.title ? (
            <span className="line-clamp-2 text-[length:clamp(10px,3cqw,18px)] font-extrabold leading-[1.12] tracking-tight">
              {mock.title}
            </span>
          ) : (
            <div className="h-[19px] w-4/5 rounded bg-[var(--sc-border)]" />
          )}
          {mock?.sub ? (
            <span className="line-clamp-2 text-[7px] leading-[1.3] text-[var(--sc-ink-muted)]">{mock.sub}</span>
          ) : (
            <div className="h-[7px] w-3/5 rounded bg-[var(--sc-border)]" />
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
              <span className="min-w-0 truncate text-[6px] font-medium text-[var(--sc-ink-muted)]">
                {`★ ${rating} · ${t('site.socialProof')}`}
              </span>
            </span>
          </div>
        </div>

        {/* hero image — real lookbook photo (G3-4: the Stitch storefront
            hero — model in a camel wool coat) over the accent-gradient
            fallback; floating chips + shine ride on top */}
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
          {/* decorative mock imagery — aria-hidden via the Scene wrapper */}
          <img
            src="/work-scenes/store-hero.webp"
            alt=""
            loading="lazy"
            width={382}
            height={512}
            className="absolute inset-0 size-full object-cover object-[50%_20%]"
          />
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
              className="flex min-w-0 items-center justify-center gap-[3px] rounded-md bg-[var(--sc-surface-muted)] px-1"
            >
              <Icon className="size-[8px] shrink-0" style={{ color: accent }} />
              <span className="min-w-0 truncate text-[5.5px] font-medium leading-none text-[var(--sc-ink-muted)]">
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
                className="relative flex min-h-0 min-w-0 flex-col rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] p-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
              >
                <div
                  className="relative min-h-0 flex-1 overflow-hidden rounded-[4px]"
                  style={{
                    background: `linear-gradient(160deg, ${rgba(accent, 0.3)} 0%, ${rgba(accent, 0.1)} 100%)`,
                  }}
                >
                  {/* G3-4: real product photo over the tint fallback — the
                      three cards map to coat / bag / scarf shots */}
                  {(() => {
                    const photo = SITE_PRODUCT_PHOTOS[i % SITE_PRODUCT_PHOTOS.length]
                    return photo ? (
                      <img
                        src={photo[0]}
                        alt=""
                        loading="lazy"
                        width={photo[1]}
                        height={photo[2]}
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : null
                  })()}
                  {off !== null && (
                    <span
                      className="absolute start-[3px] top-[3px] rounded-[2px] px-[3px] py-px text-[5px] font-bold leading-none"
                      style={{ background: accent, color: onAccent }}
                    >
                      {`−${off}%`}
                    </span>
                  )}
                </div>
                <div className="mt-[2px] truncate text-[6px] font-medium leading-tight text-[var(--sc-ink-soft)]">
                  {card.name}
                </div>
                <div className="flex items-center justify-between gap-0.5">
                  <div className="flex min-w-0 items-baseline gap-0.5">
                    <span className="truncate text-[7px] font-bold leading-none text-[var(--sc-ink)]">
                      {card.price}
                    </span>
                    {card.old && (
                      <span className="shrink-0 text-[5.5px] leading-none text-[var(--sc-ink-faint)] line-through">
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
                {/* G2-2 F4/F10: per-product rating + review count
                    (scenes.site.products) — the three cards no longer share
                    one identical "★4.9 · 312 تقييمًا" line. */}
                <div className="mt-[1px] flex min-w-0 items-center gap-[3px] overflow-hidden">
                  <Star className="size-[5px] shrink-0 fill-amber-400 text-amber-400" />
                  <span className="shrink-0 text-[5.5px] font-bold leading-none text-[var(--sc-ink-soft)]">
                    {productRatings[i]?.rating ?? rating}
                  </span>
                  <span className="truncate text-[5.5px] leading-none text-[var(--sc-ink-faint)]">
                    {productRatings[i]?.reviews}
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
              className="flex min-h-0 flex-col rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] p-[3px]"
            >
              <div className="min-h-0 flex-1 rounded-[4px] bg-[var(--sc-surface-muted)]" />
              <div className="mt-[2px] h-[5px] w-3/4 rounded-full bg-[var(--sc-border)]" />
              <div className="mt-[3px] h-[6px] w-1/2 rounded-full bg-[var(--sc-border)]" />
            </div>
          ))
        )}
      </div>

      {/* footer: service links • payment badges • copyright */}
      <div className="shrink-0 border-t border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-2 pb-[3px] pt-[3px]">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            {footerLinks.map((l) => (
              <span key={l} className="whitespace-nowrap text-[6px] font-medium text-[var(--sc-ink-muted)]">
                {l}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-[3px]">
            {payments.map((p) => (
              <span
                key={p}
                dir="ltr"
                className="rounded-[3px] border border-[var(--sc-border)] bg-[var(--sc-surface)] px-[3px] py-px text-[5px] font-bold leading-none text-[var(--sc-ink-muted)]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-px truncate text-center text-[6px] text-[var(--sc-ink-faint)]">
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
   Scene 1b — "property-new": real-estate marketplace (R9 industry scene).
   Signature elements: the fat search bar (location / type / budget), filter
   chips, listing cards with skyline "photos", verified agent sidebar.
   -------------------------------------------------------------------------- */

/** Skyline "photo" art — three distinguishable building silhouettes. */
function PropertyArt({ i, accent }: { i: number; accent: string }) {
  const windows = (color: string) =>
    `repeating-linear-gradient(to bottom, transparent 0 2px, ${color} 2px 3.5px)`
  if (i === 0) {
    // apartment block: wide slab + side tower
    return (
      <>
        <div className="absolute inset-x-[18%] bottom-0 top-[22%] rounded-[2px]" style={{ background: windows('rgba(255,255,255,0.4)'), backgroundColor: 'rgba(30,41,59,0.55)' }} />
        <div className="absolute inset-x-[58%] bottom-0 top-[8%] rounded-t-[3px]" style={{ background: windows('rgba(255,255,255,0.5)'), backgroundColor: 'rgba(15,23,42,0.7)' }} />
        <div className="absolute inset-x-0 bottom-0 h-[8%] bg-emerald-900/50" />
      </>
    )
  }
  if (i === 1) {
    // villa: pitched roof + low body + tree
    return (
      <>
        <div className="absolute inset-x-[24%] bottom-[14%] top-[42%] rounded-[2px] bg-stone-700/60" style={{ background: windows('rgba(255,255,255,0.35)'), backgroundColor: 'rgba(120,113,108,0.55)' }} />
        <div className="absolute inset-x-[20%] bottom-[46%] h-[16%] bg-stone-800/60" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
        <div className="absolute inset-x-[70%] bottom-[14%] h-[26%] rounded-full bg-emerald-800/40" />
        <div className="absolute inset-x-[62%] bottom-[12%] h-[6%] bg-stone-800/40" />
        <div className="absolute inset-x-0 bottom-0 h-[12%] bg-emerald-900/40" />
      </>
    )
  }
  // office tower: narrow glass high-rise
  return (
    <>
      <div className="absolute inset-x-[38%] bottom-0 top-[6%] rounded-t-[4px]" style={{ background: `repeating-linear-gradient(to right, transparent 0 3px, rgba(255,255,255,0.35) 3px 4.5px)`, backgroundColor: 'rgba(15,23,42,0.65)' }} />
      <div className="absolute inset-x-[30%] bottom-0 top-[30%] rounded-[2px]" style={{ background: windows('rgba(255,255,255,0.3)'), backgroundColor: 'rgba(30,41,59,0.5)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[7%] bg-emerald-900/50" />
      <span className="absolute end-[8%] top-[10%] size-[6px] rounded-full" style={{ background: accent, opacity: 0.85 }} />
    </>
  )
}

const PROPERTY_SPECS: ReadonlyArray<readonly [string, string, string]> = [
  // G3-4: order follows the reordered p2 mock cards — the featured hero
  // listing is the villa (matching the real listing photo), then the
  // apartment + office compact cards.
  ['5', '3', '310'],
  ['3', '2', '210'],
  ['2', '1', '85'],
]

function PropertyNewScene({
  accent,
  palette,
  mock,
}: {
  accent: string
  palette?: ScenePalette
  mock?: MockContent
}) {
  const t = useTranslations('workSection.scenes')
  const filters = asStringArray(t.raw('property.filters'))
  const stats = asStringArray(t.raw('property.stats'))
  const cards = mock?.cards && mock.cards.length > 0 ? mock.cards.slice(0, 3) : null
  const onAccent = onAccentColor(accent)
  const accentInk = accentInkColor(accent)
  const specs = (i: number) => PROPERTY_SPECS[i % PROPERTY_SPECS.length] ?? ['3', '2', '180']

  return (
    <div
      className="@container relative flex h-full flex-col overflow-hidden bg-[var(--sc-surface)] text-[var(--sc-ink)]"
      style={sceneVars(palette)}
    >
      {/* G2-2 F7: browser chrome — traffic dots + lock + URL pill */}
      <BrowserChrome domain={t('property.domain')} />

      {/* topbar: brand • location chip • phone CTA (no nav row — portals keep it sparse) */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-2 border-b border-[var(--sc-border)] bg-[var(--sc-surface)] px-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="flex size-[7px] shrink-0 items-center justify-center rounded-[2px]" style={{ background: accent }}>
            <span className="size-[3px] rounded-[1px] bg-white/90" />
          </span>
          <span className="truncate text-[8px] font-extrabold tracking-tight">{mock?.brand ?? ''}</span>
        </div>
        <span className="flex min-w-0 items-center gap-[3px] rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-1.5 py-px">
          <MapPin className="size-[7px] shrink-0" style={{ color: accent }} />
          <span className="truncate text-[6px] font-medium text-[var(--sc-ink-muted)]">{t('property.searchPlaceholder')}</span>
        </span>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[6.5px] font-bold leading-none"
          style={{ background: accent, color: onAccent }}
        >
          <Phone className="size-[8px]" />
          {t('property.contact')}
        </span>
      </div>

      {/* the fat search bar — the marketplace signature */}
      <div className="shrink-0 border-b border-[var(--sc-border-soft)] bg-[var(--sc-surface-muted)] px-2 py-[5px]">
        <div className="flex items-stretch gap-[3px]">
          <span className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] px-1.5 py-[3px]">
            <Search className="size-[8px] shrink-0 text-[var(--sc-ink-faint)]" />
            <span className="truncate text-[6px] text-[var(--sc-ink-faint)]">{t('property.searchPlaceholder')}</span>
          </span>
          <span className="flex w-[24%] shrink-0 items-center justify-between gap-[2px] rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] px-1.5 py-[3px]">
            <span className="truncate text-[6px] text-[var(--sc-ink-muted)]">{filters[1] ?? ''}</span>
            <span className="text-[5px] text-[var(--sc-ink-faint)]">▾</span>
          </span>
          {/* G2-2 F9 + F8: always rendered (a screenshot must not mutate with
              the visitor's window — was `hidden … sm:flex`) and localized
              budget label — was the Latin literal "$50k+" (Arabic convention:
              Latin digits + trailing $). */}
          <span className="flex w-[22%] shrink-0 items-center justify-between gap-[2px] rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] px-1.5 py-[3px]">
            <span className="truncate text-[6px] text-[var(--sc-ink-muted)]">{t('property.budget')}</span>
            <span className="text-[5px] text-[var(--sc-ink-faint)]">▾</span>
          </span>
          <span
            className="flex shrink-0 items-center rounded-md px-2.5 text-[6.5px] font-bold leading-none shadow-sm"
            style={{ background: accent, color: onAccent }}
          >
            {t('property.searchBtn')}
          </span>
        </div>
      </div>

      {/* filter chips */}
      <div className="flex h-[14px] shrink-0 items-center gap-1 border-b border-[var(--sc-border-soft)] bg-[var(--sc-surface)] px-2">
        {filters.map((f, i) => (
          <span
            key={f}
            className={cn(
              'whitespace-nowrap rounded-full px-1.5 py-px text-[5.5px] font-semibold leading-none',
              i === 0 ? 'text-white' : 'border border-[var(--sc-border)] bg-[var(--sc-surface)] text-[var(--sc-ink-muted)]'
            )}
            style={i === 0 ? { background: accent } : undefined}
          >
            {f}
          </span>
        ))}
      </div>

      {/* listings + agent sidebar */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-1.5 p-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-1.5">
          {/* hero listing — G3-4: real villa photo (the Stitch property
              listing shot) over the old skyline gradient, which stays as
              the tint fallback behind it */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[var(--sc-border)]">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #DBEAFE 0%, #EFF6FF 55%, #F0FDF4 100%)' }}>
              <div className="absolute inset-0">
                <PropertyArt i={0} accent={accent} />
              </div>
            </div>
            <img
              src="/work-scenes/property-villa.webp"
              alt=""
              loading="lazy"
              width={512}
              height={382}
              className="absolute inset-0 size-full object-cover"
            />
            {/* G2-2 F5: the hero listing's price is this scene's display
                figure (portals lead with money, not headlines) — 7px → 10px. */}
            <span
              className="absolute start-[4%] top-[6%] rounded-md px-1.5 py-[2px] text-[10px] font-extrabold leading-none shadow-md"
              style={{ background: '#ffffff', color: '#0f172a' }}
            >
              {cards?.[0]?.price ?? ''}
            </span>
            <span
              className="absolute end-[4%] top-[6%] flex items-center gap-[3px] rounded-full px-1.5 py-[2px] text-[5.5px] font-bold leading-none"
              style={{ background: accent, color: onAccent }}
            >
              <ShieldCheck className="size-[7px]" />
              {t('property.forSale')}
            </span>
            <span className="absolute bottom-[4%] start-[4%] flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-[2px] text-[5.5px] font-medium leading-none text-white backdrop-blur-sm">
              <MapPin className="size-[7px] text-white/80" />
              {cards?.[0]?.name ?? ''}
            </span>
          </div>
          {/* spec strip + compact listings */}
          <div className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface)] px-2 py-[3px]">
            <span className="flex items-center gap-[3px] text-[5.5px] font-medium text-[var(--sc-ink-muted)]">
              <BedDouble className="size-[9px]" style={{ color: accent }} />
              {specs(0)[0]} {t('property.beds')}
              <Bath className="ms-1 size-[9px]" style={{ color: accent }} />
              {specs(0)[1]} {t('property.baths')}
              <Ruler className="ms-1 size-[9px]" style={{ color: accent }} />
              {specs(0)[2]} {t('property.area')}
            </span>
            <span className="shrink-0 rounded-full px-2 py-[2px] text-[5.5px] font-bold leading-none" style={{ background: rgba(accent, 0.12), color: accentInk }}>
              {t('property.newBadge')}
            </span>
          </div>
          <div className="grid h-[26%] shrink-0 grid-cols-2 gap-1.5">
            {[1, 2].map((idx) => {
              const card = cards?.[idx]
              const s = specs(idx)
              return (
                <div key={idx} className="relative flex min-h-0 min-w-0 overflow-hidden rounded-lg border border-[var(--sc-border)]">
                  <div className="relative w-[34%] shrink-0" style={{ background: 'linear-gradient(180deg, #E0E7FF 0%, #F0F9FF 100%)' }}>
                    <PropertyArt i={idx} accent={accent} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-[2px] p-[5px]">
                    <span className="truncate text-[6px] font-bold leading-none text-[var(--sc-ink-soft)]">{card?.name ?? ''}</span>
                    <span className="flex items-center gap-[3px] text-[5px] leading-none text-[var(--sc-ink-muted)]">
                      <BedDouble className="size-[7px]" style={{ color: accent }} />{s[0]}
                      <Bath className="size-[7px]" style={{ color: accent }} />{s[1]}
                      <Ruler className="size-[7px]" style={{ color: accent }} />{s[2]}
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span dir="ltr" className="truncate text-[6.5px] font-extrabold leading-none text-[var(--sc-ink)]">{card?.price ?? ''}</span>
                      {card?.old ? (
                        <span className="shrink-0 rounded-[3px] px-1 py-px text-[4.5px] font-bold leading-none text-white" style={{ background: '#dc2626' }}>
                          {t('property.priceCut')}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* sidebar: verified agent + platform stats */}
        <aside className="flex min-h-0 min-w-0 flex-col gap-1.5">
          <div className="shrink-0 rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface-muted)] p-[6px]">
            <p className="text-[5.5px] font-bold uppercase tracking-wide text-[var(--sc-ink-faint)]">{t('property.featuredTitle')}</p>
            <div className="mt-[4px] flex items-center gap-1.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[7px] font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${shadeColor(accent, 0.35)})` }}>
                {t('property.featuredName').slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[6.5px] font-bold leading-tight text-[var(--sc-ink-soft)]">{t('property.featuredName')}</p>
                <p className="truncate text-[5px] leading-tight text-[var(--sc-ink-muted)]">{t('property.featuredRole')}</p>
              </div>
            </div>
            <span className="mt-[5px] flex items-center justify-center gap-1 rounded-md py-[3px] text-[6px] font-bold leading-none text-white" style={{ background: accent }}>
              <Phone className="size-[7px]" />
              {t('property.contact')}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-[5px] rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface)] p-[6px]">
            {stats.map((s, i) => (
              <div key={s} className="flex min-w-0 items-center gap-1.5">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full" style={{ background: rgba(accent, 0.12) }}>
                  {i === 0 ? <Building2 className="size-[9px]" style={{ color: accent }} /> : i === 1 ? <ShieldCheck className="size-[9px]" style={{ color: accent }} /> : <PlayCircle className="size-[9px]" style={{ color: accent }} />}
                </span>
                <span className="min-w-0 truncate text-[6px] font-medium leading-none text-[var(--sc-ink-muted)]">{s}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* footer */}
      <div className="flex h-[13px] shrink-0 items-center justify-between gap-2 border-t border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-2">
        <span className="truncate text-[5.5px] font-medium text-[var(--sc-ink-muted)]">{t('property.results')}</span>
        <span className="truncate text-[5.5px] text-[var(--sc-ink-faint)]">
          {`© ${mock?.brand ? `${mock.brand} — ` : ''}${t('property.footerNote')}`}
        </span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 1c — "academy-new": online course platform (R9 industry scene).
   Signature elements: dark video player with progress, curriculum checklist
   + "تقدّمك في الدورة" (your progress) treatment, instructor chip, course
   cards in pure catalog state (price/discount — G2-2 F6).
   -------------------------------------------------------------------------- */

/* G2-2 F6: single aggregate completion for the "تقدّمك في الدورة" (your
 * progress) treatment in the curriculum row. The per-card 72/38/12 bars were
 * removed — course cards now carry catalog state only (price/discount),
 * never enrolled state; the enrolled state lives where it is labeled. */
const YOUR_PROGRESS = 72

/** G3-4: real food photography for the three dish cards (the Stitch
 *  restaurant's menu grid). Position-aligned with
 *  pages.work.projects.p4.mock.cards — fattoush / shish tawook / knafeh. */
const DINING_DISH_PHOTOS: ReadonlyArray<readonly [string, number, number]> = [
  ['/work-scenes/dining-fattoush.webp', 384, 257],
  ['/work-scenes/dining-tawook.webp', 384, 257],
  ['/work-scenes/dining-knafeh.webp', 384, 257],
]

function AcademyNewScene({
  accent,
  palette,
  mock,
}: {
  accent: string
  palette?: ScenePalette
  mock?: MockContent
}) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('academy.nav'))
  const cards = mock?.cards && mock.cards.length > 0 ? mock.cards.slice(0, 3) : null
  const onAccent = onAccentColor(accent)
  const accentInk = accentInkColor(accent)

  return (
    <div
      className="@container relative flex h-full flex-col overflow-hidden bg-[var(--sc-surface)] text-[var(--sc-ink)]"
      style={sceneVars(palette)}
    >
      {/* G2-2 F7: browser chrome — traffic dots + lock + URL pill */}
      <BrowserChrome domain={t('academy.domain')} />

      {/* navbar: brand • links • enroll CTA */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-2 border-b border-[var(--sc-border)] bg-[var(--sc-surface)] px-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="flex size-[8px] shrink-0 items-center justify-center rounded-full" style={{ background: accent }}>
            <GraduationCap className="size-[6px] text-white" />
          </span>
          <span className="truncate text-[8px] font-extrabold tracking-tight">{mock?.brand ?? ''}</span>
        </div>
        <nav className="flex min-w-0 items-center gap-2 overflow-hidden">
          {nav.map((l) => (
            <span key={l} className="whitespace-nowrap text-[6px] font-medium text-[var(--sc-ink-muted)]">{l}</span>
          ))}
        </nav>
        <span
          className="shrink-0 rounded-full px-2 py-[3px] text-[6.5px] font-bold leading-none shadow-sm"
          style={{ background: accent, color: onAccent }}
        >
          {t('academy.enroll')}
        </span>
      </div>

      {/* hero: video player + pitch column */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_1fr] gap-1.5 p-2">
        <div className="relative min-h-0 overflow-hidden rounded-lg bg-slate-900">
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(70% 60% at 50% 42%, ${rgba(accent, 0.28)}, transparent 75%)` }}
          />
          {/* G3-4: real video poster — the UI-course instructor at her desk
              (Stitch academy hero frame) replaces the abstract lesson-slide
              bars; the player chrome (duration chip, play button, progress)
              rides on top of the photo */}
          <img
            src="/work-scenes/academy-instructor.webp"
            alt=""
            loading="lazy"
            width={512}
            height={286}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/25" />
          <span className="absolute end-[5%] top-[6%] rounded-[3px] bg-black/50 px-1 py-px text-[5px] font-bold leading-none text-white/90" dir="ltr">
            {t('academy.duration')}
          </span>
          <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg" style={{ background: accent }}>
            <PlayCircle className="size-4 text-white" />
          </span>
          <div className="absolute inset-x-[5%] bottom-[7%]">
            <div className="flex items-center justify-between text-[4.5px] font-medium text-white/70" dir="ltr">
              <span>03:12</span>
              <span className="truncate px-1">{t('academy.lecture')}</span>
              <span>{t('academy.duration')}</span>
            </div>
            <div className="mt-[3px] h-[3px] w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-1/4 rounded-full" style={{ background: accent }} />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[3px]">
          {mock?.kicker ? (
            <span
              className="w-fit max-w-full truncate rounded-full px-1.5 py-px text-[5.5px] font-bold leading-none"
              style={{ background: rgba(accent, 0.14), color: accentInk }}
            >
              {mock.kicker}
            </span>
          ) : null}
          {/* G2-2 F5: display scale (see SiteNewScene) — spans so the
              :lang(ar) p line-height floor can't inflate the leading. */}
          {mock?.title ? (
            <span className="line-clamp-2 text-[length:clamp(10px,3cqw,17px)] font-extrabold leading-[1.12] tracking-tight">
              {mock.title}
            </span>
          ) : null}
          {mock?.sub ? (
            <span className="line-clamp-2 text-[6.5px] leading-[1.35] text-[var(--sc-ink-muted)]">{mock.sub}</span>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-[2px]">
              <Star className="size-[7px] fill-amber-400 text-amber-400" />
              <span className="text-[6px] font-bold leading-none text-[var(--sc-ink-soft)]">{t('academy.rating')}</span>
            </span>
            <span className="truncate text-[5.5px] leading-none text-[var(--sc-ink-muted)]">{t('academy.students')}</span>
            {/* G2-2 F9: always rendered — the scene is a fixed-frame
                screenshot; it must not mutate with the visitor's window. */}
            <span className="shrink-0 text-[5.5px] leading-none text-[var(--sc-ink-faint)]">{t('academy.reviews')}</span>
          </div>
          <div className="mt-[2px] flex min-w-0 items-center gap-1.5">
            {mock?.cta ? (
              <span
                className="shrink-0 rounded-md px-2 py-[3px] text-[6.5px] font-bold leading-none shadow-sm"
                style={{ background: accent, color: onAccent }}
              >
                {mock.cta}
              </span>
            ) : null}
            <span className="shrink-0 rounded-md border border-[var(--sc-border)] px-1.5 py-[3px] text-[5.5px] font-semibold leading-none text-[var(--sc-ink-muted)]">
              {t('academy.preview')}
            </span>
            {cards?.[0]?.price ? (
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="truncate text-[8px] font-extrabold leading-none text-[var(--sc-ink)]">{cards[0].price}</span>
                {cards[0].old ? <span className="shrink-0 text-[5.5px] leading-none text-[var(--sc-ink-faint)] line-through">{cards[0].old}</span> : null}
              </span>
            ) : null}
          </div>
          <span className="mt-[2px] flex w-fit items-center gap-1 rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-1.5 py-px text-[5px] font-medium leading-none text-[var(--sc-ink-muted)]">
            <Award className="size-[8px]" style={{ color: accent }} />
            {t('academy.certificate')}
          </span>
        </div>
      </div>

      {/* curriculum checklist + your progress + instructor (G2-2 F6) */}
      <div className="flex h-[38px] shrink-0 items-center gap-1.5 border-t border-[var(--sc-border-soft)] px-2 py-1">
        {/* "تقدّمك في الدورة" — the ENROLLED state lives here, explicitly
            labeled; the course cards below stay pure catalog. */}
        <div className="flex w-[76px] shrink-0 flex-col gap-[3px]">
          <div className="flex min-w-0 items-center justify-between gap-1">
            <span className="min-w-0 truncate text-[5px] font-bold leading-none text-[var(--sc-ink-soft)]">
              {t('academy.yourProgress')}
            </span>
            <span
              dir="ltr"
              className="shrink-0 text-[4.5px] font-bold leading-none tabular-nums"
              style={{ color: accentInk }}
            >
              {`${YOUR_PROGRESS}%`}
            </span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--sc-border)]">
            <div className="h-full rounded-full" style={{ width: `${YOUR_PROGRESS}%`, background: accent }} />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex min-w-0 items-center gap-1 rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] px-1 py-[3px]">
              <span
                className="flex size-[9px] shrink-0 items-center justify-center rounded-full"
                style={{ background: i === 0 ? accent : rgba(accent, 0.12) }}
              >
                {i === 0 ? <Check className="size-[6px] text-white" /> : <span className="size-[3px] rounded-full" style={{ background: accent }} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[5.5px] font-bold leading-none text-[var(--sc-ink-soft)]">
                  {`${t('academy.module')} ${i + 1}`}
                </p>
                <p className="mt-px truncate text-[4.5px] leading-none text-[var(--sc-ink-faint)]">{t('academy.lessons')}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--sc-border)] bg-[var(--sc-surface-muted)] py-px pe-1.5 ps-px">
          <span className="flex size-[14px] items-center justify-center rounded-full text-[6px] font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${shadeColor(accent, 0.35)})` }}>
            {t('academy.instructorName').slice(0, 1)}
          </span>
          <div className="min-w-0 leading-none">
            <p className="truncate text-[5.5px] font-bold text-[var(--sc-ink-soft)]">{t('academy.instructorName')}</p>
            <p className="mt-px truncate text-[4.5px] text-[var(--sc-ink-muted)]">{t('academy.instructorRole')}</p>
          </div>
        </div>
      </div>

      {/* course cards — catalog state ONLY (G2-2 F6 removed the completion
          bars; the enrolled progress lives in the labeled treatment above) */}
      <div className="grid h-[26%] shrink-0 grid-cols-3 gap-1 px-2 pb-1">
        {(cards ?? []).map((card, i) => (
          <div key={`${card.name}-${i}`} className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] p-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[4px]" style={{ background: `linear-gradient(150deg, ${rgba(accent, 0.28)} 0%, ${rgba(accent, 0.08)} 100%)` }}>
              <span className="absolute left-1/2 top-1/2 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-sm">
                <PlayCircle className="size-3" style={{ color: accent }} />
              </span>
              <span className="absolute bottom-[4%] start-[4%] rounded-[2px] bg-black/40 px-1 py-px text-[4.5px] font-bold leading-none text-white" dir="ltr">
                {['12h', '8h', '16h'][i % 3]}
              </span>
            </div>
            <div className="mt-[2px] truncate text-[5.5px] font-semibold leading-tight text-[var(--sc-ink-soft)]">{card.name}</div>
            <div className="flex items-center justify-between gap-0.5">
              <span className="truncate text-[6px] font-bold leading-none text-[var(--sc-ink)]">{card.price}</span>
              {card.old ? <span className="shrink-0 text-[4.5px] leading-none text-[var(--sc-ink-faint)] line-through">{card.old}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* footer */}
      <div className="flex h-[12px] shrink-0 items-center justify-between border-t border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-2">
        <span className="truncate text-[5.5px] text-[var(--sc-ink-faint)]">{t('academy.level')}</span>
        <span className="truncate text-[5.5px] text-[var(--sc-ink-faint)]">{`© ${mock?.brand ? `${mock.brand} — ` : ''}${t('academy.footerNote')}`}</span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 1d — "dining-new": restaurant site (R9 industry scene).
   Signature elements: hero dish photo + menu tabs + dish cards and a live
   reservation strip — warm espresso/cream/tomato palette (G3-4: the dish
   imagery is now the real Stitch food photography — the old CSS plate art
   was removed with the imagery port).
   -------------------------------------------------------------------------- */

function DiningNewScene({
  accent,
  palette,
  mock,
}: {
  accent: string
  palette?: ScenePalette
  mock?: MockContent
}) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('dining.nav'))
  const tabs = asStringArray(t.raw('dining.menuTabs'))
  const cards = mock?.cards && mock.cards.length > 0 ? mock.cards.slice(0, 3) : null
  const onAccent = onAccentColor(accent)
  const accentInk = accentInkColor(accent)

  return (
    <div
      className="@container relative flex h-full flex-col overflow-hidden bg-[var(--sc-surface)] text-[var(--sc-ink)]"
      style={sceneVars(palette)}
    >
      {/* G2-2 F7: browser chrome — traffic dots + lock + URL pill */}
      <BrowserChrome domain={t('dining.domain')} />

      {/* navbar: brand • links • order phone */}
      <div className="flex h-[20px] shrink-0 items-center justify-between gap-2 border-b border-[var(--sc-border)] bg-[var(--sc-surface)] px-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="flex size-[8px] shrink-0 items-center justify-center rounded-[2px]" style={{ background: accent }}>
            <UtensilsCrossed className="size-[6px] text-white" />
          </span>
          <span className="truncate text-[8px] font-extrabold tracking-tight">{mock?.brand ?? ''}</span>
        </div>
        <nav className="flex min-w-0 items-center gap-2 overflow-hidden">
          {nav.map((l) => (
            <span key={l} className="whitespace-nowrap text-[6px] font-medium text-[var(--sc-ink-muted)]">{l}</span>
          ))}
        </nav>
        <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[6.5px] font-bold leading-none" style={{ background: accent, color: onAccent }}>
          <Phone className="size-[8px]" />
          {t('dining.delivery')}
        </span>
      </div>

      {/* hero: dish photo + copy */}
      <div className="grid min-h-0 flex-1 grid-cols-[0.9fr_1.1fr] gap-1.5 p-2">
        <div className="relative min-h-0 overflow-hidden rounded-xl" style={{ background: 'linear-gradient(160deg, #FEF3C7 0%, #FFF7ED 60%, #FFEDD5 100%)' }}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 50% 45%, rgba(255,255,255,0.5), transparent 70%)' }} />
          {/* G3-4: the real hero dish — the Stitch mixed-grill platter
              (charcoal skewers on the wooden table) replaces the CSS plate
              art, which stays beneath as the tint fallback */}
          <img
            src="/work-scenes/dining-grill.webp"
            alt=""
            loading="lazy"
            width={512}
            height={286}
            className="absolute inset-0 size-full object-cover"
          />
          <span className="absolute bottom-[6%] start-[6%] flex items-center gap-[3px] rounded-full bg-black/45 px-1.5 py-[2px] text-[5.5px] font-medium leading-none text-white backdrop-blur-sm">
            <Clock3 className="size-[7px] text-white/80" />
            {t('dining.delivery')}
          </span>
          <span className="absolute end-[6%] top-[6%] flex items-center gap-[3px] rounded-full px-1.5 py-[2px] text-[5.5px] font-bold leading-none" style={{ background: accent, color: onAccent }}>
            <Flame className="size-[7px]" />
            {t('dining.minOrder')}
          </span>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col justify-center gap-[3px]">
          {mock?.kicker ? (
            <span
              className="w-fit max-w-full truncate rounded-full px-1.5 py-px text-[5.5px] font-bold leading-none"
              style={{ background: rgba(accent, 0.14), color: accentInk }}
            >
              {mock.kicker}
            </span>
          ) : null}
          {/* G2-2 F5: display scale (see SiteNewScene) — spans so the
              :lang(ar) p line-height floor can't inflate the leading. */}
          {mock?.title ? (
            <span className="line-clamp-2 text-[length:clamp(10px,3cqw,17px)] font-extrabold leading-[1.12] tracking-tight">
              {mock.title}
            </span>
          ) : null}
          {mock?.sub ? (
            <span className="line-clamp-2 text-[6.5px] leading-[1.35] text-[var(--sc-ink-muted)]">{mock.sub}</span>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-[2px]">
              <Star className="size-[7px] fill-amber-400 text-amber-400" />
              <span className="text-[6px] font-bold leading-none text-[var(--sc-ink-soft)]">{t('dining.rating')}</span>
            </span>
            <span className="truncate text-[5.5px] leading-none text-[var(--sc-ink-muted)]">{t('dining.reviewsCount')}</span>
          </div>
          <div className="mt-[2px] flex min-w-0 items-center gap-1.5">
            {mock?.cta ? (
              <span
                className="shrink-0 rounded-md px-2 py-[3px] text-[6.5px] font-bold leading-none shadow-sm"
                style={{ background: accent, color: onAccent }}
              >
                {mock.cta}
              </span>
            ) : null}
            <span className="shrink-0 rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] px-1.5 py-[3px] text-[5.5px] font-semibold leading-none text-[var(--sc-ink-muted)]">
              {tabs[0] ?? ''}
            </span>
          </div>
        </div>
      </div>

      {/* menu tabs */}
      <div className="flex h-[14px] shrink-0 items-center gap-1 border-t border-[var(--sc-border)] px-2">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={cn(
              'whitespace-nowrap rounded-full px-2 py-[2px] text-[5.5px] font-semibold leading-none',
              i === 0 ? 'text-white' : 'border border-[var(--sc-border)] bg-[var(--sc-surface)] text-[var(--sc-ink-muted)]'
            )}
            style={i === 0 ? { background: accent } : undefined}
          >
            {tab}
          </span>
        ))}
        <span className="ms-auto shrink-0 text-[5px] text-[var(--sc-ink-faint)]">{t('dining.openHours')}</span>
      </div>

      {/* dish cards */}
      <div className="mt-1 grid h-[27%] shrink-0 grid-cols-3 gap-1 px-2">
        {(cards ?? []).map((card, i) => {
          // L6-F1: gate on the computed discount, not just `card.old` —
          // discountPct can return null (unparseable/equal prices) and the
          // old check printed a literal "−null%" badge. Mirrors SiteNewScene.
          const off = discountPct(card.price, card.old)
          return (
            <div key={`${card.name}-${i}`} className="relative flex min-h-0 min-w-0 flex-col rounded-md border border-[var(--sc-border)] bg-[var(--sc-surface)] p-[3px] shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[4px]" style={{ background: 'linear-gradient(160deg, #FEF3C7 0%, #FFF7ED 100%)' }}>
                {(() => {
                  const photo = DINING_DISH_PHOTOS[i % DINING_DISH_PHOTOS.length]
                  return photo ? (
                    <img
                      src={photo[0]}
                      alt=""
                      loading="lazy"
                      width={photo[1]}
                      height={photo[2]}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : null
                })()}
                {off !== null && (
                  <span className="absolute start-[3px] top-[3px] rounded-[2px] px-[3px] py-px text-[5px] font-bold leading-none text-white" style={{ background: '#dc2626' }}>
                    {`−${off}%`}
                  </span>
                )}
              </div>
              <div className="mt-[2px] truncate text-[6px] font-medium leading-tight text-[var(--sc-ink-soft)]">{card.name}</div>
              <div className="flex items-center justify-between gap-0.5">
                <span className="truncate text-[7px] font-bold leading-none text-[var(--sc-ink)]">{card.price}</span>
                <span
                  className="shrink-0 rounded-[3px] px-[4px] py-[1px] text-[6px] font-bold leading-none"
                  style={{ background: rgba(accent, 0.15), color: accentInk }}
                >
                  {t('dining.orderDish')}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* live reservation strip */}
      <div className="mt-1 flex h-[22px] shrink-0 items-center justify-between gap-1.5 rounded-lg border border-[var(--sc-border)] bg-[var(--sc-surface)] px-2">
        <span className="flex min-w-0 items-center gap-1 text-[5.5px] font-medium text-[var(--sc-ink-muted)]">
          <CalendarCheck className="size-[9px] shrink-0" style={{ color: accent }} />
          <span className="truncate">{t('dining.dateTime')}</span>
          {/* G2-2 F9: always rendered — the scene is a fixed-frame
              screenshot; it must not mutate with the visitor's window. */}
          <span className="h-3 w-px shrink-0 bg-[var(--sc-border)]" />
          <Users className="size-[8px] shrink-0" style={{ color: accent }} />
          <span className="truncate">{t('dining.guests')}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-2.5 py-[3px] text-[6px] font-bold leading-none"
          style={{ background: accent, color: onAccent }}
        >
          {t('dining.reserve')}
        </span>
      </div>

      {/* footer */}
      <div className="mt-[3px] flex h-[12px] shrink-0 items-center justify-center border-t border-[var(--sc-border)] bg-[var(--sc-surface-muted)] px-2">
        <span className="truncate text-[5.5px] text-[var(--sc-ink-faint)]">
          {`© ${mock?.brand ? `${mock.brand} — ` : ''}${t('dining.footerNote')}`}
        </span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Scene 2 — "site-old": a 2009 time capsule (ugly on purpose, rich on
   detail — masthead + banner ad, link-farm nav, scrolling news ticker,
   3-column table layout with poll/news/friends sidebars, hit counter…)
   R9: content is now flavored per industry (old.{industry}.*) — store /
   property / academy / dining — while the shared 2009 chrome stays.
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

function SiteOldScene({ mock, industry }: { mock?: MockContent; industry: OldIndustry }) {
  const t = useTranslations('workSection.scenes')
  // R9: per-industry content (old.{industry}.*) — nav, ticker, sections,
  // poll, product table, news, friends all change with the business, so
  // the four "before" cards no longer read as one recycled portal.
  const nav = asStringArray(t.raw(`old.${industry}.nav`))
  const items = asStringArray(t.raw(`old.${industry}.items`))
  const categories = asStringArray(t.raw(`old.${industry}.categories`))
  const news = asStringArray(t.raw(`old.${industry}.news`))
  const friends = asStringArray(t.raw(`old.${industry}.friends`))
  // The "before" is the SAME business — products echo the modern catalog
  // when a per-project mock exists (the transformation story made literal).
  const products =
    mock?.cards && mock.cards.length > 0
      ? mock.cards.slice(0, 3).map((c) => ({ name: c.name, price: c.price }))
      : items.map((it, i) => ({ name: it, price: OLD_PRICES[i % OLD_PRICES.length] ?? '' }))
  const pollYesPct = 78
  const oldTheme = OLD_THEME[industry]

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
              {mock?.brand ?? t(`old.${industry}.fallbackBrand`)}
            </span>
            <span className="mt-[2px] block truncate text-[5.5px] text-stone-600">{t('old.slogan')}</span>
          </div>
        </div>
        <div
          className="relative flex h-[18px] w-[34%] shrink-0 items-center justify-center overflow-hidden rounded-[2px] border border-stone-500"
          style={{ background: oldTheme.ad }}
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
                  {t(`old.${industry}.ticker`)}
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
          <OldBox title={t(`old.${industry}.categoriesTitle`)} className="min-h-0 flex-1">
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
            <p className="text-center text-[5.5px] font-bold leading-snug">{t(`old.${industry}.pollQ`)}</p>
            <div className="mt-[3px] space-y-[2px]">
              {[t(`old.${industry}.pollYes`), t(`old.${industry}.pollNo`)].map((opt, i) => (
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
                      style={{
                        width: i === 0 ? `${pollYesPct}%` : `${100 - pollYesPct}%`,
                        ...(i === 0 ? { background: oldTheme.bar } : null),
                      }}
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
              style={{ background: oldTheme.header }}
            >
              {t(`old.${industry}.productsTitle`)}
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
                  {t(`old.${industry}.orderNow`)}
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
   Scene 3 — "dashboard-new": modern SaaS console. R9: a `tone` prop gives
   the two automation projects distinct skins — p5 keeps the signature dark
   console, p6 (creative studio) renders the same proven layout in LIGHT
   mode so no two cards on /work read as twins.
   -------------------------------------------------------------------------- */

function DashNewScene({
  accent,
  brand,
  tone = 'dark',
}: {
  accent: string
  brand?: string
  tone?: 'dark' | 'light'
}) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('dash.nav'))
  const kpis = asSceneKpis(t.raw('dash.kpis'))
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

  // Tone tokens — every surface/text class routes through here.
  const light = tone === 'light'
  const k = {
    shell: light ? 'bg-stone-100 text-stone-900' : 'bg-elyra-dark text-elyra-on-dark',
    side: light ? 'border-stone-200 bg-white' : 'border-white/10 bg-white/[0.03]',
    topbar: light ? 'border-stone-200 bg-white' : 'border-white/10 bg-white/[0.03]',
    panel: light ? 'border-stone-200 bg-white' : 'border-white/10 bg-white/[0.04]',
    softPanel: light ? 'border-stone-200 bg-stone-50' : 'border-white/10 bg-white/[0.04]',
    chip: light ? 'border-stone-200 bg-stone-50' : 'border-white/10 bg-white/5',
    border: light ? 'border-stone-200' : 'border-white/10',
    rowBorder: light ? 'border-stone-100' : 'border-white/5',
    strong: light ? 'text-stone-900' : 'text-white',
    semi: light ? 'text-stone-700' : 'text-white/85',
    muted: light ? 'text-stone-500' : 'text-white/50',
    faint: light ? 'text-stone-400' : 'text-white/40',
    ghost: light ? 'text-stone-400' : 'text-white/45',
    navIdle: light ? 'text-stone-500' : 'text-white/55',
    track: light ? 'bg-stone-200' : 'bg-white/10',
    avatarRing: light ? 'border-stone-300' : 'border-white/25',
    upChip: light
      ? 'bg-emerald-500/10 text-emerald-700'
      : 'bg-emerald-400/15 text-emerald-300',
    downChip: light
      ? 'bg-red-500/10 text-red-700'
      : 'bg-red-400/15 text-red-300',
    doneChip: light
      ? 'bg-emerald-500/10 text-emerald-700'
      : 'bg-emerald-400/15 text-emerald-300',
    pendingChip: light
      ? 'bg-sky-500/10 text-sky-700'
      : 'bg-blue-400/15 text-blue-300',
    liveChip: light
      ? 'bg-emerald-500/10 text-emerald-700'
      : 'bg-emerald-400/10 text-emerald-300',
    gridLine: light ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
    /* L6-F1: the halo ring around the chart's last data point — it must
       blend with the surface behind it so the accent dot reads as cleanly
       separated from the line in BOTH tones (was a dead white/white
       ternary; the circle below now consumes the token). Light tone: the
       opaque white chart card. Dark tone: the shell tone sits within a few
       units of the card's translucent blend (white/4% over the shell) —
       imperceptible on a 0.5-unit stroke. */
    lastPointRing: light ? '#ffffff' : '#0F172A',
  }

  return (
    <div className={cn('flex h-full overflow-hidden', k.shell)}>
      {/* sidebar */}
      <aside className={cn('flex w-[27%] shrink-0 flex-col gap-1 border-e p-1', k.side)}>
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
                  active ? k.strong : k.navIdle
                )}
                style={active ? { background: rgba(accent, light ? 0.12 : 0.22) } : undefined}
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
          <div className={cn('rounded-md border px-1 py-[3px]', k.panel)}>
            <div className="flex items-center justify-between gap-1">
              <span className={cn('min-w-0 truncate text-[5px] leading-none', k.ghost)}>{t('dash.storage')}</span>
              <span
                dir="ltr"
                className={cn('shrink-0 text-[5px] font-semibold leading-none tabular-nums', k.semi)}
              >
                {t('dash.storageValue')}
              </span>
            </div>
            <div className={cn('mt-[3px] h-[3px] overflow-hidden rounded-full', k.track)}>
              <div className="h-full w-[72%] rounded-full" style={{ background: accent }} />
            </div>
          </div>
          <div className={cn('flex min-w-0 items-center gap-1 rounded-md border px-1 py-[3px]', k.panel)}>
            <span
              className="flex size-[13px] shrink-0 items-center justify-center rounded-full text-[5px] font-bold leading-none text-white"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${tintColor(accent, 0.45)})`,
              }}
            >
              {initial}
            </span>
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className={cn('min-w-0 truncate text-[6px] font-bold leading-none', k.strong)}>{name}</span>
              <span className={cn('min-w-0 truncate text-[5px] leading-none', k.ghost)}>{t('dash.role')}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar: welcome • search • bell • avatar */}
        <div className={cn('flex h-[22px] shrink-0 items-center justify-between gap-1 border-b px-1.5 pe-[52px]', k.topbar)}>
          <span className={cn('min-w-0 truncate text-[6px] font-semibold leading-none', k.semi)}>
            {welcome}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <span className={cn('flex min-w-0 items-center gap-0.5 rounded-full border px-1 py-px', k.chip)}>
              <Search className={cn('size-[8px] shrink-0', k.faint)} />
              <span className={cn('max-w-[64px] truncate text-[6px] leading-none', k.faint)}>
                {t('dash.search')}
              </span>
            </span>
            <span className="relative block">
              <Bell className={cn('size-[10px]', light ? 'text-stone-500' : 'text-white/60')} />
              <span className="absolute -end-px -top-px size-[4px] rounded-full bg-red-500" />
            </span>
            <span className={cn('max-w-[70px] truncate text-[6px] leading-none', k.ghost)}>
              {t('dash.notifications')}
            </span>
            <span
              className={cn('flex size-[13px] shrink-0 items-center justify-center rounded-full border text-[5px] font-bold leading-none text-white', k.avatarRing)}
              style={{ background: `linear-gradient(135deg, ${accent}, ${shadeColor(accent, 0.35)})` }}
            >
              {initial}
            </span>
          </div>
        </div>

        {/* content: KPIs • chart • table */}
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5">
          <div className="grid shrink-0 grid-cols-4 gap-1">
            {kpis.map((kpi, i) => {
              const up = kpi.delta.trim().startsWith('+')
              // G2-2 F1: semantic direction — on lower-is-better KPIs
              // (dash.kpis[].lowerIsBetter, e.g. "بحاجة متابعة −41%") a DROP
              // is the good outcome; the chip colors by outcome, not by
              // sign. Both p5 dark + p6 light tones route through the same
              // k.upChip/k.downChip tokens, so the fix covers both.
              const good = kpi.lowerIsBetter ? !up : up
              const spark = KPI_SPARKS[i % KPI_SPARKS.length] ?? []
              return (
                <div
                  key={kpi.label}
                  className={cn('min-w-0 rounded-md border px-1 py-[3px]', k.panel)}
                >
                  <div className={cn('truncate text-[6px] leading-none', k.muted)}>{kpi.label}</div>
                  <div className="mt-[3px] flex items-baseline justify-between gap-0.5">
                    <span className={cn('min-w-0 truncate text-[8px] font-bold leading-none tabular-nums', k.strong)}>
                      {kpi.value}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-[3px] py-[1px] text-[5px] font-bold leading-none tabular-nums',
                        good ? k.upChip : k.downChip
                      )}
                    >
                      {kpi.delta}
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
          <div className={cn('flex min-h-0 flex-1 flex-col rounded-md border p-1', k.panel)}>
            <div className="flex shrink-0 items-center justify-between gap-1">
              <span className={cn('min-w-0 truncate text-[6px] font-semibold leading-none', k.semi)}>
                {t('dash.chartTitle')}
              </span>
              <div className="flex shrink-0 items-center gap-[3px]">
                <span className={cn('flex items-center gap-[3px] rounded-full px-1 py-[2px] text-[5px] font-bold leading-none', k.liveChip)}>
                  <span className="size-[3px] animate-pulse rounded-full bg-emerald-400" />
                  {t('dash.live')}
                </span>
                {range.map((r, i) => (
                  <span
                    key={r}
                    className={cn(
                      'whitespace-nowrap rounded-[3px] px-[3px] py-[1px] text-[5px] font-semibold leading-none',
                      i === range.length - 1 ? k.strong : k.ghost
                    )}
                    style={i === range.length - 1 ? { background: rgba(accent, light ? 0.14 : 0.3) } : undefined}
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
                  stroke={k.gridLine}
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
                stroke={k.lastPointRing}
                strokeWidth="0.5"
              />
            </svg>
          </div>

          {/* latest operations table */}
          <div className={cn('shrink-0 overflow-hidden rounded-md border', k.panel)}>
            <div className={cn('flex items-center justify-between gap-1 border-b px-1 py-[3px]', k.border)}>
              <span className={cn('min-w-0 truncate text-[6px] font-semibold leading-none', k.semi)}>
                {t('dash.tableTitle')}
              </span>
              <span
                className="shrink-0 text-[5px] font-semibold leading-none"
                style={{ color: accent }}
              >
                {t('dash.viewAll')}
              </span>
            </div>
            <div className={cn('grid gap-1 border-b px-1 py-[3px]', k.rowBorder, TABLE_COLS)}>
              {tableHead.map((h) => (
                <span key={h} className={cn('min-w-0 truncate text-[6px] leading-none', k.faint)}>
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
                    'grid items-center gap-1 border-b px-1 py-[3px] last:border-b-0',
                    k.rowBorder,
                    TABLE_COLS
                  )}
                >
                  <span
                    dir="ltr"
                    className={cn('min-w-0 truncate text-[6px] leading-none', k.muted)}
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
                    <span className={cn('min-w-0 truncate text-[6px] leading-none', k.semi)}>
                      {r.party}
                    </span>
                  </span>
                  <span dir="ltr" className={cn('min-w-0 truncate text-[6px] leading-none tabular-nums', k.semi)}>
                    {r.amount}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 truncate rounded-full px-[4px] py-[1px] text-[6px] font-semibold leading-none',
                      done ? k.doneChip : k.pendingChip
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
   Scene 3b — "kanban-new": the p6 creative-studio ops board (G3-4 — the
   p5/p6 twin cure: DashNewScene stays the dark SaaS console for p5; this is
   Bassam's LIGHT warm-graphite planner with one amber accent). RTL: the
   nav sidebar sits at the START (right) edge and the columns flow
   right-to-left with the reading order. Conventions per G3-3: no browser
   chrome (an internal app, not a website mock), fixed micro UI type like
   DashNewScene (a board is dense ops tooling — no display clamp), and the
   whole region is aria-hidden mock content via the Scene wrapper.
   -------------------------------------------------------------------------- */

/** p6 brand world (Stitch reference + G2-2 spec): warm graphite ink on a
 *  warm paper-white surface, ONE amber accent — a well-loved planner, warm
 *  and tactile, never corporate blue. Scene-local by design: the kanban is
 *  the only consumer. */
const KANBAN_PALETTE = {
  surface: '#F7F5F0',
  panel: '#FDFCF9',
  well: '#EFECE3',
  border: '#E3DFD3',
  ink: '#2A2A28',
  inkSoft: '#57534A',
  inkMuted: '#8A857B',
  inkFaint: '#B5B0A5',
} as const

/** Per-column badge treatments — gray (triage) / amber (in progress) /
 *  blue-gray (with client) / green (approved). */
const KANBAN_BADGES: ReadonlyArray<{ bg: string; ink: string; dot: string }> = [
  { bg: '#ECE9E0', ink: '#6B675D', dot: '#B5B0A5' },
  { bg: 'rgba(217,119,6,0.16)', ink: '#A05A08', dot: '#D97706' },
  { bg: '#E6EAEE', ink: '#5A6B7E', dot: '#8496A8' },
  { bg: '#E3F0E6', ink: '#2E7D4A', dot: '#4CAF70' },
]

/** G3-4: photographic card thumbnails — crops of the Stitch design-work
 *  collage (website comp on a laptop, clinic app screen, printed brand
 *  guide, menu mockup, business cards). */
const KANBAN_THUMBS: ReadonlyArray<readonly [string, number, number]> = [
  ['/work-scenes/kanban-thumb-website.webp', 220, 257],
  ['/work-scenes/kanban-thumb-app.webp', 120, 112],
  ['/work-scenes/kanban-thumb-brandguide.webp', 260, 100],
  ['/work-scenes/kanban-thumb-menu.webp', 240, 138],
  ['/work-scenes/kanban-thumb-cards.webp', 120, 62],
]

/** Card→thumb map per column (positional — client names live in the
 *  catalog, the work-type imagery is visual and locale-neutral). */
const KANBAN_COLUMN_THUMBS: ReadonlyArray<ReadonlyArray<number>> = [
  [4, 3], // بريف: identity cards · storefront work
  [0, 1, 2], // قيد التصميم: website comp · app · presentation
  [3, 0], // مراجعة العميل: packaging · site comp
  [2, 4], // جاهز للتسليم: brand guide · identity cards
]

interface KanbanCard {
  client: string
  task: string
  chip: string
}

interface KanbanColumn {
  title: string
  badge: string
  cards: KanbanCard[]
}

/** scenes.kanban.columns narrower — same never-throw, degrade-to-empty
 *  contract as the other scene catalog readers. */
function asKanbanColumns(value: unknown): KanbanColumn[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((col) => {
      const rawCards = col['cards']
      const cards: KanbanCard[] = Array.isArray(rawCards)
        ? rawCards
            .filter(isRecord)
            .map((c) => ({
              client: asString(c['client']),
              task: asString(c['task']),
              chip: asString(c['chip']),
            }))
            .filter((c) => c.client !== '')
        : []
      return { title: asString(col['title']), badge: asString(col['badge']), cards }
    })
    .filter((col) => col.title !== '')
}

const KANBAN_NAV_ICONS = [LayoutDashboard, FileText, ListTodo, BarChart3, Archive] as const

function StudioKanbanScene({ accent, mock }: { accent: string; mock?: MockContent }) {
  const t = useTranslations('workSection.scenes')
  const nav = asStringArray(t.raw('kanban.nav'))
  const columns = asKanbanColumns(t.raw('kanban.columns'))
  const K = KANBAN_PALETTE
  const onAccent = onAccentColor(accent)
  // avatars rendered as letterless warm-gradient circles — at 8px letters
  // read as noise; the cluster (3 heads) carries the meaning
  const AVATAR_TONES = ['#C98A5B', '#8A9B77', '#A98FA6'] as const

  return (
    <div className="flex h-full overflow-hidden" style={{ background: K.surface, color: K.ink }}>
      {/* right sidebar (RTL start edge) — nav + capacity widget */}
      <aside
        className="flex w-[62px] shrink-0 flex-col gap-1 border-e p-1"
        style={{ borderColor: K.border, background: K.panel }}
      >
        <div
          className="flex min-w-0 items-center gap-1 rounded-md px-1 py-[3px]"
          style={{ background: 'rgba(217,119,6,0.14)' }}
        >
          <span className="size-[6px] shrink-0 rounded-full" style={{ background: accent }} />
          <span className="truncate text-[6.5px] font-bold leading-none">
            {mock?.brand ?? ''} · {t('kanban.ops')}
          </span>
        </div>
        <nav className="flex flex-col gap-[2px]">
          {nav.map((item, i) => {
            const Icon = KANBAN_NAV_ICONS[i % KANBAN_NAV_ICONS.length] ?? LayoutDashboard
            const active = i === 0
            return (
              <span
                key={item}
                className={cn(
                  'relative flex min-w-0 items-center gap-1 rounded-[4px] px-1 py-[3px] text-[5.5px] font-semibold leading-none',
                  active ? 'text-[#2A2A28]' : 'text-[#8A857B]'
                )}
                style={active ? { background: 'rgba(217,119,6,0.12)' } : undefined}
              >
                {active && (
                  // amber activity bar on the START (right) edge — the RTL idiom
                  <span
                    className="absolute inset-y-[2px] start-0 w-[2px] rounded-full"
                    style={{ background: accent }}
                  />
                )}
                <Icon
                  className="size-[9px] shrink-0"
                  style={{ color: active ? accent : '#B5B0A5' }}
                />
                <span className="truncate">{item}</span>
              </span>
            )
          })}
        </nav>
        {/* capacity widget */}
        <div className="mt-auto flex shrink-0 flex-col gap-[3px] rounded-md border px-1 py-[3px]" style={{ borderColor: K.border }}>
          <span className="truncate text-[4.5px] font-semibold leading-none" style={{ color: K.inkMuted }}>
            {t('kanban.capacity')}
          </span>
          <div className="flex items-center justify-between gap-1">
            <span dir="ltr" className="shrink-0 text-[5px] font-bold leading-none tabular-nums" style={{ color: K.ink }}>
              {t('kanban.capacityValue')}
            </span>
            <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: '#E3DFD3' }}>
              <div className="h-full w-2/3 rounded-full" style={{ background: accent }} />
            </div>
          </div>
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar: greeting • search • + new brief • avatars • bell
            (pe-[52px] keeps the row clear of the AFTER chip — DashNewScene
            convention) */}
        <div
          className="flex h-[22px] shrink-0 items-center justify-between gap-1 border-b px-1.5 pe-[52px]"
          style={{ borderColor: K.border, background: K.panel }}
        >
          <span className="min-w-0 truncate text-[6px] font-semibold leading-none" style={{ color: K.inkSoft }}>
            {t('kanban.greeting')}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <span
              className="flex min-w-0 items-center gap-0.5 rounded-full border px-1 py-px"
              style={{ borderColor: K.border, background: K.surface }}
            >
              <Search className="size-[8px] shrink-0" style={{ color: K.inkFaint }} />
              <span className="max-w-[56px] truncate text-[5.5px] leading-none" style={{ color: K.inkFaint }}>
                {t('kanban.search')}
              </span>
            </span>
            <span
              className="flex shrink-0 items-center gap-[2px] rounded-md px-1.5 py-[2.5px] text-[5.5px] font-bold leading-none shadow-sm"
              style={{ background: accent, color: onAccent }}
            >
              <Plus className="size-[8px]" />
              {t('kanban.newBrief')}
            </span>
            {/* avatar cluster */}
            <span className="flex shrink-0">
              {AVATAR_TONES.map((tone, i) => (
                <span
                  key={tone}
                  className="size-[10px] rounded-full border"
                  style={{
                    background: `linear-gradient(135deg, ${tone}, ${shadeColor(tone, 0.3)})`,
                    borderColor: K.panel,
                    marginInlineStart: i === 0 ? 0 : '-2.5px',
                  }}
                />
              ))}
            </span>
            <span className="relative block">
              <Bell className="size-[10px]" style={{ color: K.inkMuted }} />
              <span className="absolute -end-0.5 -top-0.5 size-[4px] rounded-full" style={{ background: accent }} />
            </span>
          </div>
        </div>

        {/* brief intake strip — the ops-tool signature */}
        <div
          className="flex h-[18px] shrink-0 items-center gap-1 border-b px-1.5 py-[2px]"
          style={{ borderColor: K.border, background: K.panel }}
        >
          <span
            className="flex min-w-0 flex-1 items-center gap-1 rounded-md border px-1.5 py-[2px]"
            style={{ borderColor: K.border, background: K.surface }}
          >
            <FileText className="size-[7px] shrink-0" style={{ color: K.inkFaint }} />
            <span className="truncate text-[5px] leading-none" style={{ color: K.inkFaint }}>
              {t('kanban.intakeTitle')}
            </span>
          </span>
          <span
            className="flex w-[19%] shrink-0 items-center justify-between gap-[2px] rounded-md border px-1 py-[2px]"
            style={{ borderColor: K.border, background: K.surface }}
          >
            <span className="truncate text-[5px] leading-none" style={{ color: K.inkMuted }}>
              {t('kanban.intakeClient')}
            </span>
            <span className="text-[4px]" style={{ color: K.inkFaint }}>▾</span>
          </span>
          <span
            dir="ltr"
            className="flex shrink-0 items-center rounded-md px-1 py-[2px] text-[5px] font-semibold leading-none tabular-nums"
            style={{ background: 'rgba(217,119,6,0.14)', color: '#A05A08' }}
          >
            {t('kanban.intakeBudget')}
          </span>
          <span
            className="flex w-[15%] shrink-0 items-center gap-[2px] rounded-md border px-1 py-[2px]"
            style={{ borderColor: K.border, background: K.surface }}
          >
            <CalendarCheck className="size-[7px] shrink-0" style={{ color: K.inkMuted }} />
            <span className="truncate text-[5px] leading-none" style={{ color: K.inkMuted }}>
              {t('kanban.intakeDeadline')}
            </span>
          </span>
          <span
            className="flex shrink-0 items-center rounded-md px-1.5 py-[2.5px] text-[5px] font-bold leading-none"
            style={{ background: accent, color: onAccent }}
          >
            {t('kanban.intakeAdd')}
          </span>
        </div>

        {/* the board — 4 columns flowing right-to-left */}
        <div className="flex min-h-0 flex-1 gap-1 p-1.5">
          {columns.map((col, ci) => {
            const badge = KANBAN_BADGES[ci % KANBAN_BADGES.length] ?? {
              bg: '#ECE9E0',
              ink: '#6B675D',
              dot: '#B5B0A5',
            }
            return (
              <div
                key={col.title}
                className="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden rounded-lg border p-[3px]"
                style={{ borderColor: K.border, background: K.well }}
              >
                {/* column header: dot • title • count chip */}
                <div className="flex shrink-0 items-center gap-[3px] pe-[2px]">
                  <span className="size-[4px] shrink-0 rounded-full" style={{ background: badge.dot }} />
                  <span className="min-w-0 truncate text-[5.5px] font-bold leading-none" style={{ color: K.ink }}>
                    {col.title}
                  </span>
                  <span
                    dir="ltr"
                    className="ms-auto shrink-0 rounded-full px-[4px] py-px text-[4.5px] font-bold leading-none tabular-nums"
                    style={{ background: K.panel, color: K.inkMuted, border: `1px solid ${K.border}` }}
                  >
                    {col.cards.length}
                  </span>
                </div>
                {/* cards */}
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                  {col.cards.map((card, i) => {
                    const thumbIdx = KANBAN_COLUMN_THUMBS[ci]?.[i] ?? i % KANBAN_THUMBS.length
                    const thumb =
                      KANBAN_THUMBS[thumbIdx] ??
                      (['/work-scenes/kanban-thumb-website.webp', 220, 257] as const)
                    return (
                      <div
                        key={`${card.client}-${i}`}
                        className="shrink-0 rounded-[4px] border p-[3px] shadow-[0_1px_2px_rgba(42,42,40,0.06)]"
                        style={{ borderColor: K.border, background: K.panel }}
                      >
                        <div className="flex min-w-0 items-start gap-[3px]">
                          <img
                            src={thumb[0]}
                            alt=""
                            loading="lazy"
                            width={thumb[1]}
                            height={thumb[2]}
                            className="h-[24px] w-[32px] shrink-0 rounded-[3px] object-cover"
                          />
                          <div className="min-w-0 leading-none">
                            <p className="truncate text-[5.5px] font-bold" style={{ color: K.ink }}>
                              {card.client}
                            </p>
                            <p className="mt-[2px] truncate text-[4.5px]" style={{ color: K.inkMuted }}>
                              {card.task}
                            </p>
                          </div>
                        </div>
                        <div className="mt-[3px] flex items-center justify-between gap-[3px]">
                          <span className="min-w-0 truncate text-[4.5px] leading-none" style={{ color: K.inkFaint }}>
                            {card.chip}
                          </span>
                          <span
                            className="shrink-0 whitespace-nowrap rounded-full px-[4px] py-[1px] text-[4.5px] font-bold leading-none"
                            style={{ background: badge.bg, color: badge.ink }}
                          >
                            {col.badge}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
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

function Scene({
  variant,
  accent,
  palette,
  mock,
  industry,
  tone,
}: {
  variant: SceneVariant
  accent: string
  /** G3-4: per-scene brand palette — consumed by the website "after"
   *  scenes (CSS var tokens on their roots); the old/dashboard/kanban
   *  scenes ignore it (era-authentic / own token systems). */
  palette?: ScenePalette
  mock?: MockContent
  industry: OldIndustry
  tone?: 'dark' | 'light'
}) {
  return (
    <div className="size-full" aria-hidden="true">
      {variant === 'site-new' && <SiteNewScene accent={accent} palette={palette} mock={mock} />}
      {variant === 'property-new' && <PropertyNewScene accent={accent} palette={palette} mock={mock} />}
      {variant === 'academy-new' && <AcademyNewScene accent={accent} palette={palette} mock={mock} />}
      {variant === 'dining-new' && <DiningNewScene accent={accent} palette={palette} mock={mock} />}
      {variant === 'kanban-new' && <StudioKanbanScene accent={accent} mock={mock} />}
      {/* R8: the OLD scenes receive the mock too — the "before" is the SAME
          business (brand on the 2009 masthead, products echoed in the old
          table), which sells the before→after transformation. R9: the old
          site's CONTENT is flavored per industry (nav/ticker/sections/poll
          /news/friends) so each project's "before" reads as its own era
          portal, not a recycled one. */}
      {variant === 'site-old' && <SiteOldScene mock={mock} industry={industry} />}
      {variant === 'dashboard-new' && <DashNewScene accent={accent} brand={mock?.brand} tone={tone} />}
      {variant === 'dashboard-old' && <DashOldScene />}
    </div>
  )
}

interface BeforeAfterProps {
  variant: SceneVariant
  accent?: string
  /** G3-4: per-scene brand palette (work-grid passes one per project;
   *  featured-work's bare calls keep the neutral default look). */
  palette?: ScenePalette
  className?: string
  /** aria label prefix — REQUIRED (FIX 2-c/17): every call site passes a
   *  localized project title; no untranslated default literal. */
  label: string
  /** Per-project mock content for the "after" scene (see MockContent). */
  mock?: MockContent
  /** R9: dashboard "after" skin — 'dark' (default, p5 SaaS) or 'light'
   *  (p6 creative studio) so the two automation cards don't read as twins. */
  tone?: 'dark' | 'light'
}

export function BeforeAfter({
  variant,
  accent = '#0071E3',
  palette,
  className,
  label,
  mock,
  tone,
}: BeforeAfterProps) {
  const t = useTranslations('workSection')
  const tc = useTranslations('common') // WS-2: cursor context label
  const reduced = usePrefersReducedMotion()
  const isRtl = useIsRtl()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50) // 0-100
  const dragging = useRef(false)

  // G3-4: the palette's primary IS the scene accent when a palette is
  // provided (single source of truth); bare callers keep the accent prop.
  const sceneAccent = palette?.primary ?? accent

  // R9: every site archetype keeps the 2009 "before" (industry-flavored);
  // dashboard projects keep the Excel-2003 before.
  const SITE_AFTER_VARIANTS: readonly SceneVariant[] = ['site-new', 'property-new', 'academy-new', 'dining-new']
  const beforeVariant: SceneVariant = SITE_AFTER_VARIANTS.includes(variant) ? 'site-old' : 'dashboard-old'
  const afterVariant = variant
  const industry: OldIndustry =
    variant === 'property-new'
      ? 'property'
      : variant === 'academy-new'
        ? 'academy'
        : variant === 'dining-new'
          ? 'dining'
          : 'store'

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
        // L6-R4 (fix 3): touch-pan-y replaces touch-none — the horizontal
        // drag stays captured by the pointer handlers below (the browser
        // only owns the vertical pan), so six full-width cards on /work
        // are no longer dead zones for vertical page scrolling on touch.
        'relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-border bg-card touch-pan-y sm:aspect-[16/10]',
        className
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* before layer (bottom) */}
      <div className="absolute inset-0">
        <Scene variant={beforeVariant} accent={sceneAccent} mock={mock} industry={industry} />
        <span className="absolute start-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {t('before')}
        </span>
      </div>

      {/* after layer (top, clipped) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: clipAfter, WebkitClipPath: clipAfter }}
      >
        <Scene variant={afterVariant} accent={sceneAccent} palette={palette} mock={mock} industry={industry} tone={tone} />
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
