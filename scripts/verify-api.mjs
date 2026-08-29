/**
 * Phase 3 API security verification (prompt §6).
 *
 * Run with bun (TS imports + .env auto-load):
 *
 *   bun scripts/verify-api.mjs                     # webhook vars ABSENT on server
 *   WEBHOOK_EXPECT=delivery bun scripts/verify-api.mjs  # webhook vars SET on server
 *
 * Proves:
 *   1. Zod 400 with translated per-field errors (locale via x-elyra-locale)
 *   2. Unknown fields → 400 ("unknownField")
 *   3. Forged client budget fields → stripped & recomputed server-side
 *   4. Valid calculator lead → 201 + reference + Prisma row (server-computed)
 *   5. Contact-form lead → 201 + stored with service=contact, zero budget
 *   6. Rate limiting → 429 + Retry-After
 *   7. Webhook: disabled silently without env vars / signed delivery with them
 *   8. Receiver recipe: valid signature accepted, tampered signature
 *      rejected, stale timestamp rejected, replayed nonce rejected
 *      (all via a local mock n8n endpoint using timingSafeEqual)
 */

import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { computeEstimate } from '../src/lib/calculator.ts'

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const BASE = process.env.API_BASE ?? 'http://localhost:3000'
const MOCK_PORT = 3100
const MOCK_PATH = '/webhook/elyra-leads'
const TEST_SECRET = 'verify-api-test-secret-0123456789abcdef' // 40 chars

const WEBHOOK_EXPECT = process.env.WEBHOOK_EXPECT ?? 'disabled'

function parseDotEnv(path = '.env') {
  const out = {}
  try {
    for (const line of fs.readFileSync(path, 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env */
  }
  return out
}

const envFile = parseDotEnv()
const prisma = new PrismaClient()

/* ------------------------------------------------------------------ */
/* Mock n8n receiver (same recipe documented in README)                */
/* ------------------------------------------------------------------ */

const seenNonces = new Map() // nonce -> receivedAt (TTL 10 min)
const received = []          // { ok, reason?, reference?, body }

function verifySignature(headers, rawBody, secret) {
  const sig = headers['x-elyra-signature']
  const ts = headers['x-elyra-timestamp']
  const nonce = headers['x-elyra-nonce']
  if (!sig || !ts || !nonce) return { ok: false, reason: 'missing-headers' }

  // 1) Timestamp freshness: ±5 minutes
  const nowSec = Date.now() / 1000
  if (Math.abs(nowSec - Number(ts)) > 300) return { ok: false, reason: 'stale-timestamp' }

  // 2) HMAC-SHA256 over `timestamp.nonce.body` — timingSafeEqual
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(`${ts}.${nonce}.${rawBody}`).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  const sigOk = a.length === b.length && crypto.timingSafeEqual(a, b)
  if (!sigOk) return { ok: false, reason: 'bad-signature' }

  // 3) Nonce idempotency: TTL 10 minutes
  const now = Date.now()
  for (const [n, t] of seenNonces) if (now - t > 600_000) seenNonces.delete(n)
  if (seenNonces.has(nonce)) return { ok: false, reason: 'nonce-reused' }
  seenNonces.set(nonce, now)

  return { ok: true }
}

function startMock(secret) {
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (req.method !== 'POST' || req.url !== MOCK_PATH) {
        res.writeHead(404).end()
        return
      }
      const verdict = verifySignature(req.headers, raw, secret)
      let reference = null
      try {
        reference = JSON.parse(raw).reference ?? null
      } catch {
        /* keep null */
      }
      received.push({ ...verdict, reference, raw })
      res.writeHead(verdict.ok ? 200 : 401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(verdict))
    })
  })
  return new Promise((resolve) => server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server)))
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const results = []
function ok(name, pass, detail = '') {
  results.push({ name, pass })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/* L6-R5 P3 cleanup fix: track every row this run creates so cleanup can
 * delete by `reference` (the exact rows we inserted) instead of the old
 * email-SUFFIX match — which ran at the END of try (a mid-run throw
 * skipped it, leaving test rows behind) and could delete PRE-EXISTING
 * @test.dev rows that belong to someone else. */
const createdReferences = new Set()
const createdEmails = new Set()
let sawUncaptured201 = false
function trackCreated(response, email) {
  if (response.status !== 201) return
  const ref = response.data?.reference
  if (typeof ref === 'string' && ref.length > 0) createdReferences.add(ref)
  else sawUncaptured201 = true
  if (email) createdEmails.add(email)
}

async function postLead(body, headers = {}) {
  const res = await fetch(`${BASE}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    /* non-json */
  }
  return { status: res.status, data, retryAfter: res.headers.get('retry-after') }
}

function signedMockRequest({ secret, timestamp, nonce, body, tamper = false }) {
  const raw = JSON.stringify(body)
  let sig =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${raw}`).digest('hex')
  if (tamper) {
    // flip last hex char
    const head = sig.slice(0, -1)
    const last = sig.at(-1)
    sig = head + (last === 'a' ? 'b' : 'a')
  }
  return fetch(`http://127.0.0.1:${MOCK_PORT}${MOCK_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Elyra-Signature': sig,
      'X-Elyra-Timestamp': timestamp,
      'X-Elyra-Nonce': nonce,
    },
    body: raw,
  })
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const mockSecret = envFile.N8N_WEBHOOK_SECRET && envFile.N8N_WEBHOOK_SECRET.length >= 32
  ? envFile.N8N_WEBHOOK_SECRET
  : TEST_SECRET
const mock = await startMock(mockSecret)

try {
  /* --- 0) Wait for a fresh rate window (robust to prior runs) -------- */
  {
    const probe = await postLead({ source: 'contact-form', name: 'p', email: 'probe@test.dev' })
    trackCreated(probe, 'probe@test.dev')
    if (probe.status === 429) {
      const wait = Math.max(2, Number(probe.retryAfter ?? 60))
      console.log(`   (rate window busy — waiting ${wait}s for a fresh window…)\n`)
      await new Promise((resolve) => setTimeout(resolve, wait * 1000 + 500))
    }
  }

  /* --- 1) Zod 400 + translated field errors (EN via header) --------- */
  {
    const r = await postLead(
      { source: 'calculator', name: 'x', email: 'nope' },
      { 'x-elyra-locale': 'en' }
    )
    const nameErr = r.data?.fields?.name ?? ''
    ok(
      '400 invalid payload + translated fields (EN)',
      r.status === 400 && r.data?.error === 'invalid' && nameErr.includes('Name is required'),
      `status=${r.status} nameErr="${nameErr.slice(0, 40)}"`
    )
  }

  /* --- 1b) Same in Arabic — moved AFTER the 61s reset (window budget) */

  /* --- 2) Unknown field → 400 ---------------------------------------- */
  {
    const r = await postLead({
      source: 'contact-form',
      name: 'Test User',
      email: 'unknown-field@test.dev',
      message: 'hello from the verification script',
      haxx: true,
    })
    ok(
      '400 unknown field rejected',
      r.status === 400 && (r.data?.fields?.haxx ?? '').length > 0,
      `fields=${JSON.stringify(r.data?.fields ?? {})}`
    )
  }

  /* --- 3) Forged budget → stripped + recomputed server-side ---------- */
  {
    const input = {
      source: 'calculator',
      name: 'Forged Budget',
      email: 'forged@test.dev',
      service: 'full',
      pages: 8,
      languages: 'bilingual',
      threeD: 'yes',
      integrations: ['crm', 'ai'],
      automationLevel: 'advanced',
      minBudget: 999999,
      maxBudget: 999999,
      weeksMin: 999,
      weeksMax: 999,
    }
    const r = await postLead(input)
    trackCreated(r, 'forged@test.dev')
    const expected = computeEstimate({
      service: 'full',
      pages: 8,
      languages: 'bilingual',
      threeD: 'yes',
      integrations: ['crm', 'ai'],
      automationLevel: 'advanced',
    })
    const row = r.status === 201
      ? await prisma.lead.findFirst({
          where: { email: 'forged@test.dev' },
          orderBy: { createdAt: 'desc' },
        })
      : null
    ok(
      'forged budget ignored + server-recomputed',
      r.status === 201 &&
        row !== null &&
        row.minBudget === expected.min &&
        row.maxBudget === expected.max &&
        row.minBudget !== 999999,
      `stored=${row?.minBudget}-${row?.maxBudget} expected=${expected.min}-${expected.max}`
    )
  }

  /* --- 4) Valid calculator lead → 201 + reference + Prisma ----------- */
  {
    const r = await postLead({
      source: 'calculator',
      name: 'Valid Calculator',
      email: 'valid-calc@test.dev',
      whatsapp: '+963991000000',
      service: 'website',
      pages: 6,
      languages: 'single',
      threeD: 'no',
      integrations: ['email'],
      automationLevel: 'essential',
    })
    trackCreated(r, 'valid-calc@test.dev')
    const ref = r.data?.reference ?? ''
    const row = ref
      ? await prisma.lead.findFirst({ where: { email: 'valid-calc@test.dev' }, orderBy: { createdAt: 'desc' } })
      : null
    ok(
      '201 + reference (10 chars) + Prisma row',
      r.status === 201 && typeof ref === 'string' && ref.length === 10 && row !== null && row.reference === ref,
      `ref=${ref}`
    )

    // Webhook delivery expectation
    await new Promise((resolve) => setTimeout(resolve, 2000))
    if (WEBHOOK_EXPECT === 'delivery') {
      const hit = received.find((x) => x.reference === ref)
      ok(
        'webhook delivered with VALID signature',
        hit !== undefined && hit.ok === true,
        hit ? `reference=${hit.reference}` : 'mock received nothing'
      )
    } else {
      const serverDeliveries = received.filter(
        (x) => x.reference === ref || (x.raw ?? '').includes('valid-calc@test.dev')
      )
      ok(
        'webhook silently disabled without env vars',
        serverDeliveries.length === 0,
        `mock received ${received.length} direct-test requests, 0 from server`
      )
    }
  }

  /* --- 5) Contact-form lead → service=contact, zero budget ----------- */
  {
    // The 60s rate window is full at this point — wait for it to slide,
    // which doubles as proof that the window actually resets.
    if (process.env.SKIP_RATE_WAIT !== '1') {
      console.log('   (waiting 61s for the rate-limit window to reset…)')
      await new Promise((resolve) => setTimeout(resolve, 61_000))
    }
    const r = await postLead({
      source: 'contact-form',
      name: 'Contact Person',
      email: 'contact@test.dev',
      message: 'This is a real message from the verification script.',
    })
    trackCreated(r, 'contact@test.dev')
    const row = r.status === 201
      ? await prisma.lead.findFirst({ where: { email: 'contact@test.dev' }, orderBy: { createdAt: 'desc' } })
      : null
    ok(
      'contact-form lead stored (service=contact, budget=0)',
      r.status === 201 &&
        row !== null &&
        row.service === 'contact' &&
        row.minBudget === 0 &&
        row.maxBudget === 0,
      `service=${row?.service} budget=${row?.minBudget}-${row?.maxBudget}`
    )
  }

  /* --- 5b) Arabic default locale (fresh window) ---------------------- */
  {
    const r = await postLead({ source: 'contact-form', name: 'x', email: 'bad' })
    ok(
      '400 translated fields (AR default)',
      r.status === 400 && (r.data?.message ?? '').includes('تحقق'),
      `message="${(r.data?.message ?? '').slice(0, 30)}"`
    )
  }

  /* --- 6) Rate limiting → 429 + Retry-After -------------------------- */
  {
    const burst = []
    for (let i = 0; i < 8; i++) {
      burst.push(
        postLead({ source: 'contact-form', name: `Burst ${i}`, email: `burst${i}@test.dev`, message: 'burst probe message!' })
      )
    }
    const responses = await Promise.all(burst)
    responses.forEach((r, i) => trackCreated(r, `burst${i}@test.dev`))
    const limited = responses.filter((r) => r.status === 429)
    const allHaveRetryAfter = limited.every((r) => {
      const v = Number(r.retryAfter)
      return Number.isFinite(v) && v >= 1
    })
    ok(
      'rate limit: 429 burst with Retry-After',
      limited.length >= 3 && allHaveRetryAfter,
      `${limited.length}/8 limited, retryAfter=${limited[0]?.retryAfter ?? 'n/a'}s`
    )
  }

  /* --- 7) Receiver-side signature recipe (direct to mock) ------------ */
  {
    const body = { event: 'lead.created', reference: 'direct001' }
    const ts = Math.floor(Date.now() / 1000).toString()

    // valid
    const valid = await signedMockRequest({
      secret: mockSecret,
      timestamp: ts,
      nonce: crypto.randomUUID(),
      body,
    })
    ok('receiver recipe: valid signature accepted (200)', valid.status === 200)

    // tampered signature
    const tampered = await signedMockRequest({
      secret: mockSecret,
      timestamp: ts,
      nonce: crypto.randomUUID(),
      body,
      tamper: true,
    })
    ok('receiver recipe: tampered signature rejected (401)', tampered.status === 401)

    // wrong secret entirely
    const wrongSecret = await (async () => {
      const raw = JSON.stringify(body)
      const sig =
        'sha256=' +
        crypto.createHmac('sha256', 'wrong-secret-wrong-secret-wrong-secret!!').update(`${ts}.${'n1'}.${raw}`).digest('hex')
      return fetch(`http://127.0.0.1:${MOCK_PORT}${MOCK_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Elyra-Signature': sig,
          'X-Elyra-Timestamp': ts,
          'X-Elyra-Nonce': 'n1',
        },
        body: raw,
      })
    })()
    ok('receiver recipe: wrong-secret signature rejected (401)', wrongSecret.status === 401)

    // stale timestamp (valid signature for an old ts)
    const staleTs = Math.floor(Date.now() / 1000 - 400).toString()
    const stale = await signedMockRequest({
      secret: mockSecret,
      timestamp: staleTs,
      nonce: crypto.randomUUID(),
      body,
    })
    ok('receiver recipe: stale timestamp (>5min) rejected (401)', stale.status === 401)

    // nonce replay: send same signed request twice
    const replayNonce = crypto.randomUUID()
    const first = await signedMockRequest({ secret: mockSecret, timestamp: ts, nonce: replayNonce, body })
    const replay = await signedMockRequest({ secret: mockSecret, timestamp: ts, nonce: replayNonce, body })
    ok(
      'receiver recipe: replayed nonce rejected (401)',
      first.status === 200 && replay.status === 401,
      `first=${first.status} replay=${replay.status}`
    )
  }
} finally {
  // Cleanup lives in FINALLY (L6-R5 P3): a mid-run throw must not leave
  // test rows behind. Deletes the exact rows THIS run created, matched by
  // their unique `reference` — never the old email-SUFFIX blanket delete
  // (which could hit pre-existing @test.dev rows). Exact-email fallback
  // covers a 201 whose reference somehow wasn't captured.
  try {
    let removed = 0
    if (createdReferences.size > 0) {
      removed += (
        await prisma.lead.deleteMany({
          where: { reference: { in: [...createdReferences] } },
        })
      ).count
    }
    if (sawUncaptured201 && createdEmails.size > 0) {
      removed += (
        await prisma.lead.deleteMany({
          where: { email: { in: [...createdEmails] } },
        })
      ).count
    }
    console.log(`\ncleanup: removed ${removed} test rows from the database`)
  } catch (err) {
    console.error('cleanup failed:', err?.message ?? err)
  }
  await prisma.$disconnect()
  mock.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} API checks passed ===`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exit(1)
}
