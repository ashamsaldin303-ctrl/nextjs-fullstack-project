/* Shared runtime-narrowing guards for next-intl `t.raw()` catalog values.
 *
 * L6-R2 (P2): the narrowing discipline used to live ONLY inside
 * before-after.tsx while ten sibling sites asserted `t.raw(...) as
 * string[]` / `as {...}[]` — a drifted catalog shape would have crashed
 * at render time instead of degrading. Every guard here degrades to an
 * empty result and NEVER throws; no `any` (eslint forbids it).
 *
 * Consumers: before-after.tsx (scene mocks + dashboards), bento.tsx
 * (MiniSite/MiniFlow/MiniAgent/features), work-grid.tsx,
 * featured-work.tsx, deconstructed-card.tsx and the /services/websites
 * page — plus the shared discountPct that bento and before-after used
 * to duplicate with divergent contracts (0 vs null).
 */

export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

export interface Kpi {
  label: string
  value: string
  delta: string
}

export interface SheetRow {
  ref: string
  party: string
  amount: string
  status: string
}

export function asKpis(value: unknown): Kpi[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({ label: asString(r.label), value: asString(r.value), delta: asString(r.delta) }))
    .filter((k) => k.label !== '' || k.value !== '')
}

export function asRows(value: unknown): SheetRow[] {
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

/** Per-project mock content for the before/after "after" scenes. Every
 *  field is optional — scenes degrade to neutral placeholders when the
 *  catalog provides nothing (moved verbatim from before-after.tsx). */
export interface MockContent {
  brand?: string
  kicker?: string
  title?: string
  sub?: string
  cta?: string
  cards?: { name: string; price: string; old?: string }[]
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

/** MiniSite storefront product row (bento.websites.mini.products). */
export interface CatalogProduct {
  name: string
  price: string
  old: string
}

export function asProducts(value: unknown): CatalogProduct[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((r) => ({
      name: asString(r.name),
      price: asString(r.price),
      old: asString(r.old),
    }))
    .filter((p) => p.name !== '' || p.price !== '')
}

/** "−18%"-style discount derived from a price pair (null → no badge).
 *  Single shared implementation (was duplicated bento↔before-after with
 *  divergent contracts — 0 vs null, Number vs parseInt). */
export function discountPct(price: string, old: string | undefined): number | null {
  if (!old) return null
  const p = Number.parseInt(price.replace(/[^0-9]/g, ''), 10)
  const o = Number.parseInt(old.replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(p) || !Number.isFinite(o) || o <= 0 || p >= o) return null
  return Math.round((1 - p / o) * 100)
}
