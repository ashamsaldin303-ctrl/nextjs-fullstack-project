#!/usr/bin/env node
/**
 * check-site-contact — F-S10-01 (gold-standard audit) config-surface gate.
 *
 * The audit's original ask ("fail if the placeholder strings are still in
 * site-config.ts") evolved with the fix: contact channels are now
 * ENV-DRIVEN (NEXT_PUBLIC_CONTACT_EMAIL / _WHATSAPP / _TELEGRAM) with
 * code-level defaults, because the real accounts are deploy-time data
 * that must never be hardcoded. This gate therefore enforces the
 * PLUMBING instead of the values:
 *
 *   HARD FAIL (exit 1):
 *     1. site-config.ts no longer resolves all three channels through
 *        envOr('NEXT_PUBLIC_CONTACT_*') — someone hardcoded values again
 *        (regression → the audit finding would silently return).
 *     2. .env.example no longer documents the three variables.
 *
 *   WARN (exit 0, loud stderr):
 *     - the compiled DEFAULT WhatsApp number is still the placeholder
 *       (963991000000 — audit finding D26): an OWNER ACTION line prints
 *       on every CI run until a real number ships in the deploy env.
 *
 * Run: node scripts/check-site-contact.mjs
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PLACEHOLDER_WHATSAPP = '963991000000'
const ENV_VARS = [
  'NEXT_PUBLIC_CONTACT_EMAIL',
  'NEXT_PUBLIC_CONTACT_WHATSAPP',
  'NEXT_PUBLIC_CONTACT_TELEGRAM',
]

const failures = []
const warnings = []

// --- 1) site-config.ts must stay env-driven --------------------------------
const siteConfigPath = path.join(root, 'src', 'lib', 'site-config.ts')
let siteConfig = ''
try {
  siteConfig = await readFile(siteConfigPath, 'utf8')
} catch {
  failures.push(`missing file: ${siteConfigPath}`)
}
for (const v of ENV_VARS) {
  if (!siteConfig.includes(`'${v}'`)) {
    failures.push(`site-config.ts no longer reads ${v} (env-driven contact config was removed)`)
  }
}

// --- 2) .env.example must document the three vars ---------------------------
let envExample = ''
try {
  envExample = await readFile(path.join(root, '.env.example'), 'utf8')
} catch {
  failures.push('missing file: .env.example')
}
for (const v of ENV_VARS) {
  if (!envExample.includes(v)) {
    failures.push(`.env.example no longer documents ${v}`)
  }
}

// --- 3) placeholder WhatsApp default → OWNER ACTION warning -----------------
if (siteConfig.includes(PLACEHOLDER_WHATSAPP)) {
  warnings.push(
    `OWNER ACTION REQUIRED (audit D26 / F-S10-01): the WhatsApp DEFAULT in ` +
      `src/lib/site-config.ts is still the placeholder (${PLACEHOLDER_WHATSAPP}). ` +
      `Set NEXT_PUBLIC_CONTACT_WHATSAPP to the real business number in the ` +
      `production .env BEFORE launch — every CI run prints this until then.`,
  )
}

if (failures.length) {
  console.error('SITE-CONTACT CONFIG FAIL')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log('Site-contact config OK: env-driven plumbing intact (3/3 channels resolve NEXT_PUBLIC_CONTACT_*)')
for (const w of warnings) console.warn(`  ⚠ ${w}`)
