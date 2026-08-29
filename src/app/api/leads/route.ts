import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  computeEstimate,
  type IntegrationKey,
  type CalculatorInput,
} from '@/lib/calculator'
import { rateLimit, refundRateLimit } from '@/lib/rate-limit'
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
 *   429  Rate limited — `Retry-After` + IETF draft `RateLimit-Limit/-
 *        Remaining/-Reset` headers. Two tiers (Batch 2 item 10): the
 *        lenient bucket (30 req/min/IP) meters every request, while the
 *        strict bucket (5 req/min/IP) is burned only by requests that
 *        reach a persisted write.
 *   500  Generic error, zero internal detail; details go to the server log.
 *   201  Stored. Body: { reference } — 'c' + 9 random base-36 chars:
 *        cuid-shaped but collision-proof (final-board R1 — the previous
 *        id.slice(0, 8) was 'c' + 7 base-36 TIMESTAMP digits, so two
 *        leads created within the same ~36 ms bucket shared one).
 *        The same value is PERSISTED on the row (unique `reference`
 *        column, L1-B fix) so support can map it back to the lead.
 *        (Also the honeypot path: bot submissions get the same 201 shape
 *        but are silently discarded — see the POST handler.)
 *   GET  405 with `Allow: POST, OPTIONS` (RFC 9110 §15.4.6 — the
 *        framework's default 405 carries no Allow header).
 *   All validation-adjacent error bodies (400/403/413/415/429) share one
 *   envelope: { error, message, fields } — `fields` is {} when no
 *   per-field detail applies (L6-R5 P3; 500 stays with the generic
 *   handler).
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

/**
 * Caps on header-derived strings BEFORE persistence (L6-R1 P3): body
 * fields are length-validated by Zod, but the raw User-Agent header and
 * the TRUST_PROXY-derived IP string arrive with no bound — an HTTP header
 * may legally run ~16 KB and the SQLite columns are unbounded TEXT. The
 * User-Agent cap also bounds the signed webhook payload.
 */
const MAX_USER_AGENT_CHARS = 512
const MAX_IP_CHARS = 64

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
 *
 * When X-Forwarded-For carries a LIST, the LAST element is used, never the
 * first: appending proxies (nginx's default proxy_add_x_forwarded_for)
 * grow the list rightward — spoofed client-supplied entries first, the
 * proxy's own trusted observation LAST — so the first element is
 * attacker-controlled and reading it would allow rate-limit bucket
 * rotation. Under an overwriting proxy the list holds a single element,
 * where first and last coincide. Appending proxies are not supported at
 * all with TRUST_PROXY=true (see .env.example).
 */
function clientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY !== 'true') return 'anonymous'
  const xff = req.headers.get('x-forwarded-for')
  const last = xff?.split(',').pop()?.trim()
  if (last) return last
  return req.headers.get('x-real-ip') ?? 'anonymous'
}

function requestLocale(req: NextRequest): 'ar' | 'en' {
  // L6-R5 P3: normalize before comparing — header matching is
  // case-sensitive by default, so "EN"/"AR" used to fall through to
  // accept-language instead of honoring the explicit choice.
  const explicit = req.headers.get('x-elyra-locale')?.toLowerCase()
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

/**
 * Prisma P2002 (unique-constraint violation). The only realistic source
 * is the `reference` unique index (collision odds ~1e-14 per draw) — the
 * create path regenerates and retries on it (L1-B fix).
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  )
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
      { error: 'rate_limited', message: t('rateLimited'), fields: {} },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSec),
          // IETF draft RateLimit-* fields
          // (draft-ietf-httpapi-ratelimit-headers, L6-R5 P3) —
          // machine-readable quota info alongside Retry-After.
          'RateLimit-Limit': String(rl.limit),
          'RateLimit-Remaining': String(rl.remaining),
          'RateLimit-Reset': String(rl.retryAfterSec),
        },
      }
    )
  }

  // 2) Cheap header gates BEFORE any body parsing (audit P1-2) — never
  // allocate a parser for oversized or non-JSON requests.
  // Framing assumption (L1-A P3): both size gates below key off
  // Content-Length / Transfer-Encoding — the shipped HTTP/1.1 standalone
  // server (and its h1 fronting proxy) always emits one of the two, so
  // the cap holds; length-less h2 DATA forwarding would bypass it
  // (unreachable in this deployment — never expose the app over h2/h2c).
  const contentLengthHeader = req.headers.get('content-length')
  const contentLength =
    contentLengthHeader === null ? 0 : Number(contentLengthHeader)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'too_large', message: t('tooLarge'), fields: {} },
      { status: 413 }
    )
  }
  // Chunked bodies carry no content-length — without this gate an
  // attacker can stream an arbitrarily large body past the cap above
  // (verification L2-A). The site's own fetch() clients always send
  // content-length, so legitimate traffic is unaffected.
  if (req.headers.get('transfer-encoding') !== null) {
    return NextResponse.json(
      { error: 'too_large', message: t('tooLarge'), fields: {} },
      { status: 413 }
    )
  }
  // Parse the MEDIA TYPE (first ';'-separated token, case-insensitive)
  // and require exact equality with application/json (L6-R1 P3): the old
  // substring test let smuggling values like "text/plain; application/json"
  // through the documented 415 contract. +json suffixed types
  // (application/ld+json etc.) are intentionally NOT accepted — the
  // contract has always been plain application/json.
  const mediaType =
    (req.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      ?.trim()
      .toLowerCase() ?? ''
  if (mediaType !== 'application/json') {
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
      { error: 'cross_origin', message: t('crossOrigin'), fields: {} },
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
        { error: 'cross_origin', message: t('crossOrigin'), fields: {} },
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
  // L4 R1 P3: short-circuit on RAW presence — the schema is unknown-typed,
  // so any honeypot payload (short string, oversized string, wrong type,
  // null) reaches this check and gets the SAME fake 201. Only undefined or
  // an empty/whitespace string (what the real forms send) proceeds.
  const hp = input.companyWebsite
  if (hp !== undefined && (typeof hp !== 'string' || hp.trim() !== '')) {
    return NextResponse.json({ reference: randomReference() }, { status: 201 })
  }

  // 6) Strict quota (5/min/IP) — checked (and burned) immediately
  //    before the write, so ONLY requests that actually reach a
  //    persisted lead consume it. Everything above (413/415/403/400
  //    and the honeypot discard) stays on the lenient bucket alone.
  //    If the write below still FAILS, its catch refunds this hit
  //    (L1-B fix) — a storage error must not cost the visitor a slot.
  const strict = rateLimit(ip, 'strict')
  if (!strict.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: t('rateLimited'), fields: {} },
      {
        status: 429,
        headers: {
          'Retry-After': String(strict.retryAfterSec),
          // Same IETF draft RateLimit-* fields as the lenient 429 above.
          'RateLimit-Limit': String(strict.limit),
          'RateLimit-Remaining': String(strict.remaining),
          'RateLimit-Reset': String(strict.retryAfterSec),
        },
      }
    )
  }

  // 7) Persist (storage has priority over the webhook — §3.3).
  const stored = toStoredLead(input)
  // L6-R1 P2/P3: the raw User-Agent header is the only fully
  // attacker-controlled string with no charset restriction that reaches
  // both the DB row and the HMAC-signed webhook — cap it here (the body
  // fields get their Zod caps; headers got none until now). The
  // TRUST_PROXY-derived IP string is capped the same way before it is
  // persisted (only the persisted value — the rate-limit KEY stays
  // untouched so bucket behavior is unchanged).
  const userAgent =
    req.headers.get('user-agent')?.slice(0, MAX_USER_AGENT_CHARS) ?? null
  const ipForRecord =
    ip === 'anonymous' ? null : ip.slice(0, MAX_IP_CHARS)

  // Generated BEFORE the create and PERSISTED on the row (L1-B P2 fix):
  // the reference used to be minted only for the 201 response/webhook, so
  // the value shown in the success UI was untraceable — the team could
  // never map "c5tr8p13xb" back to a stored lead.
  let reference = randomReference()

  try {
    // Unique-index collision (P2002 on `reference`, odds ~1e-14 per
    // draw) regenerates and retries — max 3 attempts, then the generic 500.
    for (let attempt = 1; ; attempt++) {
      try {
        await db.lead.create({
          data: {
            reference,
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
        break
      } catch (err) {
        if (attempt < 3 && isUniqueViolation(err)) {
          reference = randomReference()
          continue
        }
        throw err
      }
    }

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
    // Refund the strict slot burned in step 6 (L1-B P3 fix): the write
    // failed, so this request never became a persisted lead — the visitor
    // must not lose one of only 5 submissions/min to a storage failure.
    // (The lenient hit stays counted: the request did reach the server.)
    refundRateLimit(ip, 'strict')
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

/**
 * GET → 405 with a proper `Allow` header (L6-R5 P3). RFC 9110 §15.4.6
 * REQUIRES a 405 to carry Allow; the framework's default GET fallback
 * returns a bare 405 with none (probed live by R5). The message strings
 * intentionally live here instead of the apiErrors catalog: this is a
 * protocol-level (method) error, not a form-validation error, and the
 * i18n parity gate stays untouched this round (712 keys).
 */
export async function GET(req: NextRequest) {
  const locale = requestLocale(req)
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message:
        locale === 'ar'
          ? 'هذه النقطة تقبل POST فقط — راجع ترويسة Allow.'
          : 'This endpoint only accepts POST — see the Allow header.',
      fields: {},
    },
    { status: 405, headers: { Allow: 'POST, OPTIONS' } }
  )
}
