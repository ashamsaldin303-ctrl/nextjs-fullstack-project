import crypto from 'node:crypto'
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
  leadNameSchema,
  leadEmailSchema,
  leadWhatsappSchema,
  leadMessageSchema,
  honeypotSchema,
} from '@/lib/lead-fields'
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
 *   403  Cross-site request (Sec-Fetch-Site / Origin mismatch).
 *   413  Body larger than 64 KB (content-length gate, pre-parse).
 *   415  Content-Type is not application/json (pre-parse).
 *   429  Rate limited — `Retry-After` header in seconds. Two tiers
 *        (Batch 2 item 10): the lenient bucket (30 req/min/IP) meters
 *        every request, while the strict bucket (5 req/min/IP) is
 *        burned only by requests that reach a persisted write.
 *   500  Generic error, zero internal detail; details go to the server log.
 *   201  Stored. Body: { reference } — 'c' + 9 random base-36 chars:
 *        cuid-shaped but collision-proof (final-board R1 — the previous
 *        id.slice(0, 8) was 'c' + 7 base-36 TIMESTAMP digits, so two
 *        leads created within the same ~36 ms bucket shared one).
 *        (Also the honeypot path: bot submissions get the same 201 shape
 *        but are silently discarded — see the POST handler.)
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

/** Hard cap on the request body — checked via content-length BEFORE parsing. */
const MAX_BODY_BYTES = 64 * 1024

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

// Field rules live in the shared module @/lib/lead-fields — the single
// source of truth for this API and both client forms (final-board
// R2-MED-1 / R6-LOW-3: the calculator's whatsapp validation had drifted).
// The name/message schemas additionally reject bidi & control characters
// (final-board R1) — those refine issues carry the field path, so the
// fieldErrors mapping below surfaces them on the right key.
const baseFields = {
  name: leadNameSchema,
  email: leadEmailSchema,
  whatsapp: leadWhatsappSchema,
  // Honeypot (audit P2-5): hidden `companyWebsite` input that real users
  // never fill but bots tend to complete. Validated, NEVER persisted — a
  // non-empty value short-circuits to a fake 201 in the POST handler.
  companyWebsite: honeypotSchema,
}

const calculatorLeadSchema = z.strictObject({
  ...baseFields,
  source: z.literal('calculator'),
  service: z.enum(['website', 'automation', 'full']),
  pages: z.number().int().min(1).max(20),
  languages: z.enum(['single', 'bilingual']),
  threeD: z.enum(['yes', 'no']),
  integrations: z
    .array(integrationKeySchema)
    .max(6)
    // Duplicate values are rejected (audit P2-3) — fieldErrors maps the
    // issue onto the `integrations` field key below.
    .refine((items) => new Set(items).size === items.length, {
      message: 'duplicate integrations are not allowed',
    }),
  automationLevel: z.enum(['essential', 'advanced']),
})

const contactLeadSchema = z.strictObject({
  ...baseFields,
  source: z.literal('contact-form'),
  message: leadMessageSchema,
})

const leadSchema = z.discriminatedUnion('source', [
  calculatorLeadSchema,
  contactLeadSchema,
])

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rate-limit key derivation (audit P1-1).
 *
 * X-Forwarded-For / X-Real-IP are trivially spoofable by any client that
 * reaches the app directly — trusting them unconditionally lets an attacker
 * rotate the header for a fresh bucket per request. They are honored ONLY
 * when TRUST_PROXY=true, i.e. behind a trusted reverse proxy that
 * OVERWRITES these headers with the real client address (the included
 * Caddyfile does). Otherwise fail closed: all callers share the single
 * 'anonymous' bucket.
 */
function clientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY !== 'true') return 'anonymous'
  const xff = req.headers.get('x-forwarded-for')
  const first = xff?.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('x-real-ip') ?? 'anonymous'
}

function requestLocale(req: NextRequest): 'ar' | 'en' {
  const explicit = req.headers.get('x-elyra-locale')
  if (explicit === 'ar' || explicit === 'en') return explicit
  const accept = req.headers.get('accept-language')
  if (accept?.toLowerCase().startsWith('en')) return 'en'
  return 'ar'
}

/**
 * Random customer reference: 'c' + 9 base-36 chars — the same LOOK as a
 * cuid prefix, but collision-proof (final-board R1: the previous
 * `id.slice(0, 8)` was 'c' + 7 base-36 TIMESTAMP digits, so two leads
 * created within the same ~36 ms bucket shared a reference — live-proven).
 * Used for BOTH the real and the honeypot path so the two shapes stay
 * indistinguishable.
 */
function randomReference(): string {
  return 'c' + Array.from({ length: 9 }, () => crypto.randomInt(36).toString(36)).join('')
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
    // Root path segment: an issue at ['integrations', 0] belongs to the
    // `integrations` field — array-index paths must surface on the owning
    // field instead of vanishing into the generic error with an empty map.
    const root = issue.path[0]
    if (typeof root === 'string' && KNOWN_FIELDS.has(root)) {
      out[root] = t(`fields.${root}`)
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

  // 1) Rate limit FIRST — but only the LENIENT bucket (30/min/IP):
  //    every request counts here (valid or not) because its only job
  //    is blunting flood/abuse spam. Rejected payloads must NOT burn
  //    the 5/min strict quota — a visitor making a few validation
  //    mistakes used to lock themselves out of ever submitting
  //    (verified in audit 1-b: 429 after a handful of 400s).
  const ip = clientIp(req)
  const rl = rateLimit(ip, 'lenient')
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

  // 2) Cheap header gates BEFORE any body parsing (audit P1-2) — never
  // allocate a parser for oversized or non-JSON requests.
  const contentLengthHeader = req.headers.get('content-length')
  const contentLength =
    contentLengthHeader === null ? 0 : Number(contentLengthHeader)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'too_large', message: t('tooLarge') },
      { status: 413 }
    )
  }
  // Chunked bodies carry no content-length — without this gate an
  // attacker can stream an arbitrarily large body past the cap above
  // (verification L2-A). The site's own fetch() clients always send
  // content-length, so legitimate traffic is unaffected.
  if (req.headers.get('transfer-encoding') !== null) {
    return NextResponse.json(
      { error: 'too_large', message: t('tooLarge') },
      { status: 413 }
    )
  }
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      { error: 'invalid', message: t('invalid'), fields: {} },
      { status: 415 }
    )
  }

  // 3) Cross-site request rejection (audit P2-2): browsers always attach
  // Sec-Fetch-Site / Origin to cross-site POSTs — this blocks cross-site
  // form-post spam while header-less clients (curl, API tools) pass.
  const secFetchSite = req.headers.get('sec-fetch-site')
  if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') {
    return NextResponse.json(
      { error: 'cross_origin', message: t('crossOrigin') },
      { status: 403 }
    )
  }
  const origin = req.headers.get('origin')
  if (origin) {
    let sameHost = false
    try {
      sameHost = new URL(origin).host === req.headers.get('host')
    } catch {
      // Malformed Origin — fail closed (treated as cross-site).
    }
    if (!sameHost) {
      return NextResponse.json(
        { error: 'cross_origin', message: t('crossOrigin') },
        { status: 403 }
      )
    }
  }

  // 4) Parse — strip known client-echo estimate fields, reject unknowns.
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

  // 5) honeypot: silently discard bot submissions — a non-empty
  // companyWebsite means a bot filled the hidden field. Return the exact
  // 201 success shape (fresh reference) so bots can't tell the difference;
  // no DB write, no webhook. The field is likewise never persisted below.
  // The fake reference comes from the SAME generator as the real one
  // ('c' + base-36 chars, like Prisma's cuid) — so the discard path is not
  // fingerprintable by reference alphabet or length (verification L2-A).
  const input = parsed.data
  if (input.companyWebsite !== undefined && input.companyWebsite.trim() !== '') {
    return NextResponse.json({ reference: randomReference() }, { status: 201 })
  }

  // 6) Strict quota (5/min/IP) — checked (and burned) immediately
  //    before the write, so ONLY requests that actually reach a
  //    persisted lead consume it. Everything above (413/415/403/400
  //    and the honeypot discard) stays on the lenient bucket alone.
  const strict = rateLimit(ip, 'strict')
  if (!strict.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: t('rateLimited') },
      {
        status: 429,
        headers: {
          'Retry-After': String(strict.retryAfterSec),
        },
      }
    )
  }

  // 7) Persist (storage has priority over the webhook — §3.3).
  const stored = toStoredLead(input)
  const userAgent = req.headers.get('user-agent')
  const ipForRecord = ip === 'anonymous' ? null : ip

  try {
    await db.lead.create({
      data: {
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp ?? null,
        // Persisted since final-board R1/R6 — previously the inquiry text
        // only rode the (optional) webhook and was silently lost.
        message: stored.message,
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

    // Collision-proof reference (final-board R1) — random, NOT derived
    // from the row id (timestamp prefix collided within ~36 ms).
    const reference = randomReference()

    // 8) Webhook — fire-and-forget, never blocks or fails the 201.
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
