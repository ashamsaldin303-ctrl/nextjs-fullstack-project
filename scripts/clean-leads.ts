/**
 * Wipes all Lead rows from the database (Phase 3 pre-launch checklist:
 * "no test data ships to production").
 *
 * Run with bun:
 *   bun scripts/clean-leads.ts            # deletes ALL leads
 *   bun scripts/clean-leads.ts --dry-run  # counts only
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
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
