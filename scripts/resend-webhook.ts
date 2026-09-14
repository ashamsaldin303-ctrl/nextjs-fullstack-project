/**
 * Failed-webhook replay tool (F-S2-04 — gold-standard audit: "replay
 * worker" was claimed in route comments but no script shipped).
 *
 * Re-sends the signed n8n webhook for every lead whose delivery settled
 * as webhookStatus='failed' (the fire-and-forget outcome persisted by
 * POST /api/leads). The send goes through the SAME module the route uses
 * (src/lib/n8n-webhook.ts) — identical HMAC signing convention
 * (`HMAC-SHA256(secret, `${timestamp}.${nonce}.${body}`)` + fresh
 * timestamp/nonce per attempt), identical 3-attempt backoff, redirect
 * refusal and CSV-injection neutralization — so a replayed delivery is
 * byte-compatible with a first delivery.
 *
 * Modes (run with bun — mirrors scripts/clean-leads.ts conventions):
 *   bun scripts/resend-webhook.ts                # replay up to 25 failed leads
 *   bun scripts/resend-webhook.ts --limit=50     # replay up to 50
 *   bun scripts/resend-webhook.ts --dry-run      # list candidates only (no send, no status write)
 *   bun scripts/resend-webhook.ts --help         # usage
 *
 * Exit codes:
 *   0  done — including "some sends failed" (the counts are the report);
 *      also 0 when N8N_WEBHOOK_URL/SECRET are unset (skipped + reported —
 *      an unconfigured webhook is an environment state, not a usage error)
 *   1  usage error only (malformed --limit, unknown flag)
 *
 * PII discipline: the console table prints reference/date/outcome only —
 * names, emails and message bodies never ride the terminal output (audit
 * P1-4; the full payload still goes to the configured webhook, as designed).
 *
 * Locale note: the original request locale is not persisted on the lead
 * row, so replays carry the site default ('ar') — the field is analytics
 * metadata for the CRM, not a delivery constraint.
 */
import { PrismaClient } from '@prisma/client'
import {
  sendLeadWebhook,
  type LeadWebhookPayload,
} from '../src/lib/n8n-webhook'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')
const DEFAULT_LIMIT = 25

function usage(): never {
  console.log(`Usage:
  bun scripts/resend-webhook.ts                # replay up to 25 failed leads
  bun scripts/resend-webhook.ts --limit=50     # replay up to 50
  bun scripts/resend-webhook.ts --dry-run      # list candidates only
  bun scripts/resend-webhook.ts --help         # this help

Re-sends the HMAC-signed n8n webhook for leads with webhookStatus='failed'
(oldest first) and persists the new outcome on each row. Exit 0 even when
some sends fail — the summary counts are the report; exit 1 is reserved
for usage errors.`)
  process.exit(0)
}

if (process.argv.includes('--help') || process.argv.includes('-h')) usage()

/**
 * Parses `--limit=<N>` (N ≥ 1) from argv — default 25. A malformed value
 * is a hard usage error (exit 1), never a silent fallthrough to the
 * default (same posture as clean-leads.ts --purge-days).
 */
function limitArg(): number {
  for (const arg of process.argv) {
    if (!arg.startsWith('--limit=')) continue
    const digits = /^\d+$/.exec(arg.slice('--limit='.length))?.[0]
    if (digits === undefined || Number(digits) < 1) {
      console.error(`invalid ${arg} — expected a positive integer, e.g. --limit=25`)
      process.exit(1)
    }
    return Number(digits)
  }
  return DEFAULT_LIMIT
}

/** Unknown flags are usage errors — a typo like `--dryrun` must not look
 *  like a successful no-op run (clean-leads posture). */
const KNOWN_FLAGS = new Set(['--dry-run', '--help', '-h'])
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--limit=')) continue
  if (!KNOWN_FLAGS.has(arg)) {
    console.error(`unknown flag: ${arg} (see --help)`)
    process.exit(1)
  }
}

/** Row shape selected by the query above — what buildPayload needs. */
interface ReplayLead {
  id: string
  reference: string
  name: string
  email: string
  whatsapp: string | null
  message: string | null
  service: string
  pages: number
  languages: string
  threeD: string
  integrations: string
  automationLevel: string
  minBudget: number
  maxBudget: number
  weeksMin: number
  weeksMax: number
  userAgent: string | null
  createdAt: Date
}

/** The webhook payload the LEADS ROUTE would have sent, rebuilt from the
 *  persisted row. `integrations` stores JSON {source, items} (schema
 *  comment in prisma/schema.prisma); the sentinel service='contact'
 *  (never a calculator enum) backstops the parse. */
function buildPayload(lead: ReplayLead): LeadWebhookPayload {
  let source: 'calculator' | 'contact-form' = lead.service === 'contact' ? 'contact-form' : 'calculator'
  let items: string[] = []
  try {
    const parsed = JSON.parse(lead.integrations) as { source?: string; items?: string[] }
    if (parsed.source === 'calculator' || parsed.source === 'contact-form') source = parsed.source
    if (Array.isArray(parsed.items)) items = parsed.items
  } catch {
    /* pre-JSON rows / corrupt cell — the derived source + empty items above stand */
  }
  return {
    event: 'lead.created',
    reference: lead.reference,
    source,
    locale: 'ar',
    lead: {
      name: lead.name,
      email: lead.email,
      whatsapp: lead.whatsapp,
      message: lead.message,
    },
    project: {
      service: lead.service,
      pages: lead.pages,
      languages: lead.languages,
      threeD: lead.threeD,
      integrations: items,
      automationLevel: lead.automationLevel,
    },
    estimate: {
      minBudget: lead.minBudget,
      maxBudget: lead.maxBudget,
      weeksMin: lead.weeksMin,
      weeksMax: lead.weeksMax,
      currency: 'USD',
    },
    meta: {
      // Replay time (honest "when the CRM received it"); the signature
      // timestamp/nonce are minted per attempt inside sendLeadWebhook.
      receivedAt: new Date().toISOString(),
      userAgent: lead.userAgent,
    },
  }
}

async function main() {
  const limit = limitArg()
  const leads = await prisma.lead.findMany({
    where: { webhookStatus: 'failed' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      reference: true,
      name: true,
      email: true,
      whatsapp: true,
      message: true,
      service: true,
      pages: true,
      languages: true,
      threeD: true,
      integrations: true,
      automationLevel: true,
      minBudget: true,
      maxBudget: true,
      weeksMin: true,
      weeksMax: true,
      userAgent: true,
      createdAt: true,
    },
  })

  console.log(`leads with webhookStatus='failed': ${leads.length} (limit ${limit}, oldest first)`)
  if (leads.length === 0) {
    console.log('nothing to replay — all deliveries settled')
    return
  }

  if (dryRun) {
    for (const lead of leads) {
      console.log(`  ${lead.reference}  ${lead.createdAt.toISOString().slice(0, 10)}  ${lead.service}`)
    }
    console.log('dry-run: no sends, no status writes')
    return
  }

  // Unset env → skip + report (exit 0 — environment state, not usage error).
  if (!process.env.N8N_WEBHOOK_URL || !process.env.N8N_WEBHOOK_SECRET) {
    console.error(
      'SKIP: N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET not configured — nothing was sent, ' +
        'webhookStatus left untouched on every row. Set them (32+ char secret) and re-run.',
    )
    return
  }

  const counts: Record<string, number> = {}
  for (const lead of leads) {
    const outcome = await sendLeadWebhook(buildPayload(lead))
    // Same enum values the route persists ('sent' | 'failed' | 'disabled').
    await prisma.lead.update({
      where: { id: lead.id },
      data: { webhookStatus: outcome },
    })
    counts[outcome] = (counts[outcome] ?? 0) + 1
    console.log(`  ${lead.reference}  ${lead.createdAt.toISOString().slice(0, 10)}  ${lead.service}  → ${outcome}`)
  }

  const sent = counts['sent'] ?? 0
  const failed = counts['failed'] ?? 0
  const disabled = counts['disabled'] ?? 0
  console.log(`\nreplay summary: ${sent} sent / ${failed} failed / ${disabled} disabled of ${leads.length}`)
  if (failed > 0) {
    console.log('some deliveries still failed — rows keep webhookStatus=\'failed\' and remain replayable')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
