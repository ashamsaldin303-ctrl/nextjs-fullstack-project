/**
 * Elyra project calculator — pure estimation logic.
 *
 * IMPORTANT (guide §2.9): the server recomputes everything from these inputs
 * in a Serializable transaction. This module is shared between the client
 * (for live preview) and the future /api/leads route (Phase 3).
 */

export type ServiceType = 'website' | 'automation' | 'full'
export type AutomationLevel = 'essential' | 'advanced'
export type LanguageOption = 'single' | 'bilingual'
export type ThreeDOption = 'yes' | 'no'
export type IntegrationKey =
  | 'crm'
  | 'invoicing'
  | 'email'
  | 'telegram'
  | 'sheets'
  | 'ai'

/** Supported presentation locales (kept local so this pure lib stays decoupled from i18n infra). */
export type Locale = 'ar' | 'en'

export interface CalculatorInput {
  service: ServiceType
  pages: number
  languages: LanguageOption
  threeD: ThreeDOption
  integrations: IntegrationKey[]
  automationLevel: AutomationLevel
}

export interface CalcLine {
  labelKey: string
  min: number
  max: number
}

export interface CalcResult {
  min: number
  max: number
  weeksMin: number
  weeksMax: number
  breakdown: CalcLine[]
}

const BASE: Record<ServiceType, { min: number; max: number; weeksMin: number; weeksMax: number }> = {
  website: { min: 2800, max: 4200, weeksMin: 3, weeksMax: 5 },
  automation: { min: 2200, max: 3600, weeksMin: 2, weeksMax: 4 },
  full: { min: 5200, max: 8400, weeksMin: 6, weeksMax: 9 },
}

const INCLUDED_PAGES = 5
const PER_PAGE = { min: 180, max: 260 }
const BILINGUAL_MULT = 1.35
const THREE_D = { min: 1500, max: 2600 }
const PER_INTEGRATION = { min: 250, max: 450 }
const AUTOMATION_ADVANCED = { min: 900, max: 1500 }

function clampPages(n: number): number {
  // Mirrors the UI slider (min 1, max 20) and the API Zod schema — 0 is
  // not a valid project size anywhere.
  if (!Number.isFinite(n)) return 1
  const i = Math.round(n)
  return Math.max(1, Math.min(i, 20))
}

export function computeEstimate(input: CalculatorInput): CalcResult {
  const base = BASE[input.service]
  let min = base.min
  let max = base.max
  let weeksMin = base.weeksMin
  let weeksMax = base.weeksMax
  const breakdown: CalcLine[] = [
    { labelKey: 'base', min: base.min, max: base.max },
  ]

  // Pages beyond the included allowance
  const pages = clampPages(input.pages)
  const extraPages = Math.max(0, pages - INCLUDED_PAGES)
  if (extraPages > 0) {
    const addMin = extraPages * PER_PAGE.min
    const addMax = extraPages * PER_PAGE.max
    min += addMin
    max += addMax
    weeksMin += extraPages * 0.15
    weeksMax += extraPages * 0.25
    breakdown.push({
      labelKey: 'pages',
      min: addMin,
      max: addMax,
    })
  }

  // Bilingual
  if (input.languages === 'bilingual') {
    const bMin = Math.round(min * (BILINGUAL_MULT - 1))
    const bMax = Math.round(max * (BILINGUAL_MULT - 1))
    min += bMin
    max += bMax
    weeksMin += 0.5
    weeksMax += 1
    breakdown.push({ labelKey: 'bilingual', min: bMin, max: bMax })
  }

  // 3D — only meaningful for website / full
  if (input.threeD === 'yes' && input.service !== 'automation') {
    min += THREE_D.min
    max += THREE_D.max
    weeksMin += 1
    weeksMax += 2
    breakdown.push({ labelKey: 'threeD', min: THREE_D.min, max: THREE_D.max })
  }

  // Integrations
  const intCount = input.integrations.length
  if (intCount > 0) {
    const iMin = intCount * PER_INTEGRATION.min
    const iMax = intCount * PER_INTEGRATION.max
    min += iMin
    max += iMax
    weeksMin += intCount * 0.2
    weeksMax += intCount * 0.4
    breakdown.push({ labelKey: 'integrations', min: iMin, max: iMax })
  }

  // Automation level — only meaningful for automation / full
  if (
    input.automationLevel === 'advanced' &&
    input.service !== 'website'
  ) {
    min += AUTOMATION_ADVANCED.min
    max += AUTOMATION_ADVANCED.max
    weeksMin += 0.5
    weeksMax += 1.5
    breakdown.push({
      labelKey: 'advanced',
      min: AUTOMATION_ADVANCED.min,
      max: AUTOMATION_ADVANCED.max,
    })
  }

  // Round every breakdown line to the presentation grid (nearest $100)
  // FIRST, then derive the headline totals as the sums of the rounded
  // lines. INVARIANT: the displayed lines always sum to the headline —
  // previously the headline was rounded independently of the raw lines,
  // so the two could drift apart by up to ±$50 per line.
  const round100 = (n: number) => Math.round(n / 100) * 100
  const roundedBreakdown = breakdown.map((line) => ({
    ...line,
    min: round100(line.min),
    max: round100(line.max),
  }))
  const totalMin = roundedBreakdown.reduce((acc, line) => acc + line.min, 0)
  const totalMax = roundedBreakdown.reduce((acc, line) => acc + line.max, 0)

  // Ordering guarantee: BASE gives raw weeksMax − weeksMin ≥ 2 and every
  // add-on contributes at least as much to max as to min, so rounding can
  // shrink the gap by at most 1 → weeksMax ≥ weeksMin + 1 always holds.
  // (The old Math.max fallbacks were provably dead — see loop-1 audit.)
  return {
    min: totalMin,
    max: totalMax,
    weeksMin: Math.round(weeksMin),
    weeksMax: Math.round(weeksMax),
    breakdown: roundedBreakdown,
  }
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}
