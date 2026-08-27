/**
 * Lead maintenance script.
 *
 * Modes (run with bun):
 *   bun scripts/clean-leads.ts --all                     # deletes ALL leads (explicit full wipe)
 *   bun scripts/clean-leads.ts --all --dry-run           # counts only (full wipe)
 *   bun scripts/clean-leads.ts --purge-days=90           # deletes leads older than 90 days
 *   bun scripts/clean-leads.ts --purge-days=90 --dry-run # counts the purge only
 *   bun scripts/clean-leads.ts                           # prints usage, exits 1 (no default wipe)
 *
 * The full wipe REQUIRES --all (L3 audit, R6): a bare run used to delete
 * EVERY lead with no confirmation — an unguarded footgun next to the
 * cron-scheduled purge mode. --purge-days keeps working unchanged.
 *
 * The purge mode implements the PII retention policy documented in README
 * "Deployment" → "Data retention" (L1-A P2 fix): Lead rows carry
 * ipAddress, userAgent, email, whatsapp and the full message text —
 * schedule it (cron / systemd timer) so the SQLite file doesn't keep the
 * complete contact history forever.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')
const wipeAll = process.argv.includes('--all')

function usage(): never {
  console.error(`Usage:
  bun scripts/clean-leads.ts --all                      # deletes ALL leads (explicit full wipe)
  bun scripts/clean-leads.ts --all --dry-run            # counts only (full wipe)
  bun scripts/clean-leads.ts --purge-days=90            # deletes leads older than 90 days
  bun scripts/clean-leads.ts --purge-days=90 --dry-run  # counts the purge only

The full wipe requires --all — a bare run no longer deletes anything.`)
  process.exit(1)
}

/**
 * Parses `--purge-days=<N>` (N ≥ 0) from argv — null when absent.
 * A MALFORMED value is a hard error, never a silent fallthrough to the
 * full wipe (a typo like `--purge-days=9O` must not delete everything).
 */
function purgeDays(): number | null {
  for (const arg of process.argv) {
    if (!arg.startsWith('--purge-days=')) continue
    const days = /^\d+$/.exec(arg.slice('--purge-days='.length))?.[0]
    if (days === undefined) {
      console.error(`invalid ${arg} — expected a non-negative integer, e.g. --purge-days=90`)
      process.exit(1)
    }
    return Number(days)
  }
  return null
}

async function main() {
  const days = purgeDays()

  if (days !== null) {
    // Age-based purge (L1-A P2): delete rows created before the cutoff.
    const cutoff = new Date(Date.now() - days * 86_400_000)
    const where = { createdAt: { lt: cutoff } }
    if (dryRun) {
      const count = await prisma.lead.count({ where })
      console.log(`dry-run: ${count} lead(s) older than ${days} day(s) would be deleted`)
      return
    }
    const result = await prisma.lead.deleteMany({ where })
    console.log(`purged ${result.count} lead(s) older than ${days} day(s)`)
    return
  }

  // No --purge-days: the full wipe must be EXPLICIT. A bare run (with or
  // without --dry-run alone) prints usage and fails — the pre-launch
  // "no test data ships to production" wipe is `--all` (Phase 3 checklist).
  if (!wipeAll) usage()

  const count = await prisma.lead.count()
  if (dryRun) {
    console.log(`dry-run: ${count} lead(s) would be deleted`)
    return
  }
  const result = await prisma.lead.deleteMany({})
  console.log(`deleted ${result.count} lead(s)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
