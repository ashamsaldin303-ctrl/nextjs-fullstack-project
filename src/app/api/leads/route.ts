import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  computeEstimate,
  type IntegrationKey,
  type CalculatorInput,
} from '@/lib/calculator'
import { rateLimit } from '@/lib/rate-limit'
import {
  sendLeadWebhook,
  type LeadWebhookPayload,
} from '@/lib/n8n-webhook'
import { getApiT } from '@/lib/api-i18n'

/**
 * POST /api/leads — the ONLY write endpoint of the site (Phase 3, §3.1–3.2).
 *
 * Contract:
 *   400  Zod validation failure — field errors translated via the
 *        `x-elyra-locale` header (falls back to accept-language, then ar).
 *   429  Rate limited (5 req/min/IP) — `Retry-After` header in seconds.
 *   500  Generic error, zero internal detail; details go to the server log.
 *   201  Stored. Body: { reference } — the first 8 chars of the lead cuid.
 *
 * Security decisions (documented in README "Phase 3 decisions"):
 *   - The budget/duration are ALWAYS recomputed server-side from the wizard
 *     options via computeEstimate. Client-sent estimate fields
 *     (minBudget/maxBudget/weeksMin/weeksMax/estimate) are recognized and
 *     silently stripped — defense in depth so a tampered client cannot
 *     inject numbers, while any other unknown field is a hard 400.
 *   - The webhook fires AFTER the row is committed and is best-effort:
 *     its failure never fails the request (fire-and-forget with the
 *     standalone server process in mind).
 */

export const runtime = 'nodejs'

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const integrationKeySchema = z.enum([
  'crm',
  'invoicing',
  'email',
  'telegram',
  'sheets',
  'ai',
])

/**
 * Known client-echo estimate fields — stripped BEFORE strict parsing.
 * The server computes these itself; a client sending them is ignored
 * (never trusted), everything else unknown is rejected with 400.
 */
const CLIENT_ECHO_FIELDS = new Set([
  'minBudget',
  'maxBudget',
  'weeksMin',
  'weeksMax',
  'estimate',
  'result',
  'breakdown',
])

const baseFields = {
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  whatsapp: z.string().trim().min(5).max(30).optional(),
}

const calculatorLeadSchema = z.strictObject({
  ...baseFields,
  source: z.literal('calculator'),
  service: z.enum(['website', 'automation', 'full']),
  pages: z.number().int().min(1).max(20),
  languages: z.enum(['single', 'bilingual']),
  threeD: z.enum(['yes', 'no']),
  integrations: z.array(integrationKeySchema).max(6),
  automationLevel: z.enum(['essential', 'advanced']),
})

const contactLeadSchema = z.strictObject({
  ...baseFields,
  source: z.literal('contact-form'),
  message: z.string().trim().min(10).max(5000),
})

const leadSchema = z.discriminatedUnion('source', [
  calculatorLeadSchema,
  contactLeadSchema,
])

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  const first = xff?.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function requestLocale(req: NextRequest): 'ar' | 'en' {
  const explicit = req.headers.get('x-elyra-locale')
  if (explicit === 'ar' || explicit === 'en') return explicit
  const accept = req.headers.get('accept-language')
  if (accept?.toLowerCase().startsWith('en')) return 'en'
  return 'ar'
}

const KNOWN_FIELDS = new Set([
  'name', 'email', 'whatsapp', 'message', 'source', 'service', 'pages',
  'languages', 'threeD', 'integrations', 'automationLevel',
])

/** Maps Zod issues to translated per-field errors. */
function fieldErrors(
  issues: z.ZodIssue[],
  t: ReturnType<typeof getApiT>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const field = issue.path.join('.')
    if (KNOWN_FIELDS.has(field)) {
      out[field] = t(`fields.${field}`)
    } else if (issue.code === 'unrecognized_keys') {
      const keys = (issue as { keys?: string[] }).keys ?? []
      for (const k of keys) out[k] = t('unknownField')
    }
  }
  return out
}

function toStoredLead(input: z.infer<typeof leadSchema>): {
  service: string
  pages: number
  languages: string
  threeD: string
  integrationsJson: string
  automationLevel: string
  message: string | null
  estimate: { minBudget: number; maxBudget: number; weeksMin: number; weeksMax: number }
} {
  if (input.source === 'calculator') {
    // SERVER-SIDE RECOMPUTE — client numbers were never accepted (§3.1).
    const calcInput: CalculatorInput = {
      service: input.service,
      pages: input.pages,
      languages: input.languages,
      threeD: input.threeD,
      integrations: input.integrations satisfies IntegrationKey[],
      automationLevel: input.automationLevel,
    }
    const result = computeEstimate(calcInput)
    return {
      service: input.service,
      pages: input.pages,
      languages: input.languages,
      threeD: input.threeD,
      integrationsJson: JSON.stringify({
        source: input.source,
        items: input.integrations,
      }),
      automationLevel: input.automationLevel,
      message: null,
      estimate: {
        minBudget: result.min,
        maxBudget: result.max,
        weeksMin: result.weeksMin,
        weeksMax: result.weeksMax,
      },
    }
  }

  // Contact-form lead: no estimate was requested — zeros, not fake numbers.
  return {
    service: 'contact',
    pages: 0,
    languages: 'single',
    threeD: 'no',
    integrationsJson: JSON.stringify({ source: input.source, items: [] }),
    automationLevel: 'essential',
    message: input.message,
    estimate: { minBudget: 0, maxBudget: 0, weeksMin: 0, weeksMax: 0 },
  }
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const locale = requestLocale(req)
  const t = getApiT(locale)

  // 1) Rate limit FIRST — invalid payloads still burn the quota.
  const ip = clientIp(req)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: t('rateLimited') },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSec),
        },
      }
    )
  }

  // 2) Parse — strip known client-echo estimate fields, reject unknowns.
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid', message: t('invalid'), fields: {} },
      { status: 400 }
    )
  }

  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>
    for (const key of Object.keys(record)) {
      if (CLIENT_ECHO_FIELDS.has(key)) delete record[key]
    }
  }

  const parsed = leadSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid',
        message: t('invalid'),
        fields: fieldErrors(parsed.error.issues, t),
      },
      { status: 400 }
    )
  }

  // 3) Persist (storage has priority over the webhook — §3.3).
  const input = parsed.data
  const stored = toStoredLead(input)
  const userAgent = req.headers.get('user-agent')
  const ipForRecord = ip === 'unknown' ? null : ip

  try {
    const lead = await db.lead.create({
      data: {
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp ?? null,
        service: stored.service,
        pages: stored.pages,
        languages: stored.languages,
        threeD: stored.threeD,
        integrations: stored.integrationsJson,
        automationLevel: stored.automationLevel,
        minBudget: stored.estimate.minBudget,
        maxBudget: stored.estimate.maxBudget,
        weeksMin: stored.estimate.weeksMin,
        weeksMax: stored.estimate.weeksMax,
        ipAddress: ipForRecord,
        userAgent,
      },
    })

    const reference = lead.id.slice(0, 8)

    // 4) Webhook — fire-and-forget, never blocks or fails the 201.
    const payload: LeadWebhookPayload = {
      event: 'lead.created',
      reference,
      source: input.source,
      locale,
      lead: {
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp ?? null,
        message: stored.message,
      },
      project: {
        service: stored.service,
        pages: stored.pages,
        languages: stored.languages,
        threeD: stored.threeD,
        integrations: input.source === 'calculator' ? input.integrations : [],
        automationLevel: stored.automationLevel,
      },
      estimate: { ...stored.estimate, currency: 'USD' },
      meta: {
        receivedAt: new Date().toISOString(),
        userAgent,
      },
    }
    void sendLeadWebhook(payload).catch(() => {
      /* silent by contract */
    })

    return NextResponse.json({ reference }, { status: 201 })
  } catch (err) {
    // Details to the server log only — never to the client (§3.1).
    console.error('[elyra:api/leads] storage failed:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: 'server_error', message: t('serverError') },
      { status: 500 }
    )
  }
}

// OPTIONS for dev convenience / CORS-less same-origin POSTs.
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
    },
  })
}
