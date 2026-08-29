import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PII (audit P1-4): lead names/emails/phones must never flow into
// production logs — query logging stays a dev-only diagnostic.
const logEvents: ('query' | 'error' | 'warn')[] =
  process.env.NODE_ENV === 'production'
    ? ['error']
    : ['query', 'error', 'warn']

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: logEvents,
  })
  // L6-R5 P3 — SQLite WAL: switch the journal mode once at client init so
  // concurrent readers no longer fail with SQLITE_BUSY while a write is
  // in flight (busy_timeout only mitigates that). The pragma is
  // idempotent — journal_mode is a persistent property of the DB file,
  // so once any process sets it, every connection sees WAL — and a
  // failure here (read-only filesystem, locked file, …) must NEVER
  // break the client export: swallow it and keep the default journal.
  // ($queryRaw, not $executeRaw: `PRAGMA journal_mode=…` RETURNS the new
  // mode, and execute-rejecting calls that return rows is version-fragile.)
  void client
    .$queryRawUnsafe('PRAGMA journal_mode=wal')
    .catch(() => {
      /* best-effort only — non-fatal by contract */
    })
  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db