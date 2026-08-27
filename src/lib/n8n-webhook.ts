/**
 * Elyra → n8n signed webhook sender (Phase 3, prompt §3.3).
 *
 * Signing scheme (the receiving n8n workflow verifies — see the README
 * "Webhook verification recipe" section for the timingSafeEqual snippet):
 *
 *   signature = HMAC-SHA256(secret, `${timestamp}.${nonce}.${body}`)
 *
 *   X-Elyra-Signature: sha256=<hex>
 *   X-Elyra-Timestamp: unix seconds (receiver rejects ±5 min)
 *   X-Elyra-Nonce:     crypto.randomUUID (receiver tracks 10-min TTL)
 *
 * Delivery contract:
 *   - secrets come ONLY from env vars; if either is missing (or the secret
 *     is shorter than 32 chars) the webhook is disabled with a single log
 *     line — never an error, never a fake send;
 *   - fetch timeout of 5s via AbortController;
 *   - exactly ONE retry, and only for network-level failures;
 *   - silent failure: the lead stays stored, the API response stays 201.
 */

import crypto from 'node:crypto'

const WEBHOOK_TIMEOUT_MS = 5_000
const MIN_SECRET_LENGTH = 32

export interface LeadWebhookPayload {
  event: 'lead.created'
  reference: string
  source: 'calculator' | 'contact-form'
  locale: string
  lead: {
    name: string
    email: string
    whatsapp: string | null
    /** Contact-form free text (calculator leads: null). */
    message: string | null
  }
  project: {
    service: string
    pages: number
    languages: string
    threeD: string
    integrations: string[]
    automationLevel: string
  }
  /** Server-computed estimate (zeros for contact-form leads). */
  estimate: {
    minBudget: number
    maxBudget: number
    weeksMin: number
    weeksMax: number
    currency: 'USD'
  }
  meta: {
    receivedAt: string
    userAgent: string | null
  }
}

export type WebhookOutcome = 'sent' | 'failed' | 'disabled'

/** Builds the exact signature string the receiver must recompute. */
export function buildSignatureMaterial(
  timestamp: string,
  nonce: string,
  body: string
): string {
  return `${timestamp}.${nonce}.${body}`
}

function isConfigured(): { url: string; secret: string } | null {
  const url = process.env.N8N_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!url || !secret) return null
  if (secret.length < MIN_SECRET_LENGTH) {
    console.warn(
      `[elyra:n8n] webhook disabled — N8N_WEBHOOK_SECRET must be ${MIN_SECRET_LENGTH}+ chars`
    )
    return null
  }
  // Fail closed in production (final-board R1): a non-https URL would ship
  // lead PII in cleartext — an operator typo, not an attack vector. Dev
  // keeps http://localhost n8n instances working.
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    console.warn(
      '[elyra:n8n] webhook URL is not https:// — lead PII would be sent in cleartext; refusing to enable'
    )
    return null
  }
  return { url, secret }
}

/** Transport only — signing happens in attemptDelivery, so the secret
 * never propagates into this call frame (L1-A/L1-B P3 fix: the parameter
 * used to be accepted here and silently ignored). */
async function deliver(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      // HTTP-level rejection: no retry (the endpoint answered — retrying
      // a 4xx/5xx would be pointless noise).
      console.warn(`[elyra:n8n] webhook responded with HTTP ${res.status}`)
      return false
    }
    return true
  } finally {
    clearTimeout(timer)
  }
}

/**
 * OWASP CSV-injection neutralizer: a value whose TRIMMED form starts with
 * =, +, - or @ would execute as a formula once the lead lands in
 * Sheets/Excel via n8n — prefixing a single quote defuses it. Applied to
 * the outbound webhook payload ONLY; the DB stores the raw value.
 */
function neutralizeCsvInjection(value: string): string {
  return /^[=+\-@]/.test(value.trim()) ? `'${value}` : value
}

export async function sendLeadWebhook(
  payload: LeadWebhookPayload
): Promise<WebhookOutcome> {
  const config = isConfigured()
  if (!config) {
    // Single log line, no error, no fake send (prompt §3.3).
    console.info('[elyra:n8n] webhook disabled — N8N_WEBHOOK_URL/SECRET not configured')
    return 'disabled'
  }

  // Neutralize formula-trigger prefixes on the string fields destined for
  // spreadsheet consumers (OWASP CSV injection — final-board R1). The
  // signature below is computed over THIS sanitized body, so the receiver's
  // HMAC verification stays consistent.
  const sanitized: LeadWebhookPayload = {
    ...payload,
    lead: {
      name: neutralizeCsvInjection(payload.lead.name),
      email: neutralizeCsvInjection(payload.lead.email),
      whatsapp:
        payload.lead.whatsapp === null
          ? null
          : neutralizeCsvInjection(payload.lead.whatsapp),
      message:
        payload.lead.message === null
          ? null
          : neutralizeCsvInjection(payload.lead.message),
    },
  }

  const body = JSON.stringify(sanitized)

  // Each attempt signs itself (audit P2-1): a retry must carry a fresh
  // timestamp/nonce/signature — reusing attempt-1 headers would trip the
  // receiver's ±5-min TTL and nonce replay protection.
  const attemptDelivery = async (): Promise<boolean> => {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = crypto.randomUUID()
    const signature = crypto
      .createHmac('sha256', config.secret)
      .update(buildSignatureMaterial(timestamp, nonce, body))
      .digest('hex')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Elyra-Signature': `sha256=${signature}`,
      'X-Elyra-Timestamp': timestamp,
      'X-Elyra-Nonce': nonce,
    }
    return deliver(config.url, body, headers)
  }

  // One retry on network failure only (prompt §3.3).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (await attemptDelivery()) return 'sent'
      return 'failed'
    } catch (err) {
      if (attempt === 0) continue
      console.warn(
        '[elyra:n8n] webhook delivery failed:',
        err instanceof Error ? err.message : String(err)
      )
      return 'failed'
    }
  }
  return 'failed'
}
