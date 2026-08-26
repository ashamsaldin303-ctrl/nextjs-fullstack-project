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

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logEvents,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db