#!/usr/bin/env node
/**
 * check-osv — zero-dependency CVE gate against the OSV.dev API (F-S1-03,
 * gold-standard audit: dependency scanning was fully delegated to
 * Dependabot — this is the in-repo defense-in-depth layer, same zero-dep
 * style as scripts/check-secrets.mjs).
 *
 * Modes:
 *   node scripts/check-osv.mjs            WARN-only (default): full report,
 *                                         exit 0 even when vulnerabilities
 *                                         are found (Dependabot still owns
 *                                         the merge-blocking flow).
 *   STRICT=1 node scripts/check-osv.mjs   exit 1 when ANY vulnerability has
 *                                         a fix available AND GHSA severity
 *                                         HIGH/CRITICAL (NVD-only advisories
 *                                         without a GHSA severity label are
 *                                         reported as UNKNOWN and do not
 *                                         block — no false-positive gates).
 *
 * Network posture: every request carries a 10s AbortController timeout,
 * and ANY OSV outage/timeout downgrades to a warning + exit 0 — a scanning
 * gate must never break CI on a third-party outage. CI wires the
 * warn-only default (see .github/workflows/ci.yml `osv-scan`).
 *
 * How the tree is read: bun.lock is a JSONC text lockfile (trailing
 * commas). Trailing commas are stripped, the result parses as plain JSON,
 * and every `packages` entry is `[ "name@version", url, meta, integrity ]`.
 * Bun also emits "path-style" duplicate keys (`"@babel/core/semver"` →
 * `semver@6.3.1`) for hoisted sub-dependencies — those are skipped: every
 * installed package also has its canonical top-level entry (verified over
 * the current lockfile), so scanning canonical keys alone is full
 * coverage. True alias specs (`name@npm:other@1.2.3`) are skipped too.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.env.STRICT === '1'
// OSV_API_BASE override exists for outage-tolerance testing (and OSV
// mirrors); the default is the public API.
const OSV_BASE = process.env.OSV_API_BASE ?? 'https://api.osv.dev/v1'
const TIMEOUT_MS = 10_000
/** OSV querybatch chunk size — ~100 queries per request (spec'd limit headroom). */
const CHUNK = 100

/* ------------------------------------------------------------------ */
/* Fetch helper — 10s timeout on every request                          */
/* ------------------------------------------------------------------ */

async function fetchJson(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* bun.lock parsing                                                     */
/* ------------------------------------------------------------------ */

function lockPackages() {
  const raw = fs.readFileSync(path.join(ROOT, 'bun.lock'), 'utf8')
  // JSONC → JSON: strip trailing commas before `}` / `]`.
  const lock = JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1'))
  const packages = []
  let skipped = 0
  for (const [name, entry] of Object.entries(lock.packages ?? {})) {
    const spec = Array.isArray(entry) && typeof entry[0] === 'string' ? entry[0] : null
    if (spec === null || !spec.startsWith(`${name}@`)) {
      skipped++
      continue
    }
    const version = spec.slice(name.length + 1)
    if (!/^\d/.test(version)) {
      // alias/registry-prefixed spec — not a plain version, OSV would not
      // answer it usefully.
      skipped++
      continue
    }
    packages.push({ name, version })
  }
  return { packages, skipped }
}

/* ------------------------------------------------------------------ */
/* OSV queries                                                          */
/* ------------------------------------------------------------------ */

async function queryBatch(chunk) {
  const data = await fetchJson(`${OSV_BASE}/querybatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: chunk.map((p) => ({
        package: { ecosystem: 'npm', name: p.name },
        version: p.version,
      })),
    }),
  })
  const results = data?.results
  if (!Array.isArray(results) || results.length !== chunk.length) {
    throw new Error('unexpected querybatch response shape')
  }
  return results
}

/** Fixed versions an advisory offers for ONE npm package name. */
function fixedFor(vuln, name) {
  const fixed = new Set()
  for (const affected of vuln?.affected ?? []) {
    if (affected?.package?.ecosystem !== 'npm' || affected?.package?.name !== name) continue
    for (const range of affected?.ranges ?? []) {
      for (const event of range?.events ?? []) {
        if (typeof event?.fixed === 'string') fixed.add(event.fixed)
      }
    }
  }
  return [...fixed]
}

function severityOf(vuln) {
  return String(vuln?.database_specific?.severity ?? '').toUpperCase() || 'UNKNOWN'
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

const { packages, skipped } = lockPackages()
console.log(`OSV scan: ${packages.length} packages from bun.lock${skipped ? ` (${skipped} path-style/alias duplicate keys skipped)` : ''}`)

let results
try {
  results = []
  for (let i = 0; i < packages.length; i += CHUNK) {
    results.push(...(await queryBatch(packages.slice(i, i + CHUNK))))
  }
} catch (err) {
  console.error(
    `OSV WARN — OSV API (${OSV_BASE}) unreachable (${err instanceof Error ? err.message : String(err)}); ` +
      'gate skipped — never breaks CI on an OSV outage',
  )
  process.exit(0)
}

// package index → advisories affecting the INSTALLED version.
const hits = []
packages.forEach((pkg, i) => {
  for (const vuln of results[i]?.vulns ?? []) {
    if (typeof vuln?.id === 'string') hits.push({ pkg, id: vuln.id })
  }
})

// Detail fetches — only for hits (few), deduped by advisory id. A detail
// failure downgrades that ONE advisory to UNKNOWN (never blocks strict).
const details = new Map()
for (const id of [...new Set(hits.map((h) => h.id))]) {
  try {
    details.set(id, await fetchJson(`${OSV_BASE}/vulns/${encodeURIComponent(id)}`))
  } catch (err) {
    console.error(`  (details for ${id} unavailable: ${err instanceof Error ? err.message : String(err)})`)
    details.set(id, null)
  }
}

const BLOCKING = new Set(['HIGH', 'CRITICAL'])
let blockingCount = 0
if (hits.length > 0) {
  console.log(`vulnerabilities affecting installed versions: ${hits.length}`)
  for (const { pkg, id } of hits) {
    const vuln = details.get(id)
    const severity = vuln === null ? 'UNKNOWN' : severityOf(vuln)
    const fixed = vuln === null ? [] : fixedFor(vuln, pkg.name)
    const fixes = fixed.length > 0 ? `fix available: ${fixed.join(' / ')}` : 'no fix available'
    const blocks = STRICT && fixed.length > 0 && BLOCKING.has(severity)
    if (blocks) blockingCount++
    console.log(
      `  ${blocks ? '✗' : '⚠'} ${pkg.name}@${pkg.version} — ${id} [${severity}] ${fixes}` +
        (vuln?.summary ? `\n      ${String(vuln.summary).slice(0, 140)}` : ''),
    )
  }
} else {
  console.log('vulnerabilities affecting installed versions: 0')
}

if (STRICT && blockingCount > 0) {
  console.error(
    `OSV FAIL (STRICT=1) — ${blockingCount} advisories are HIGH/CRITICAL with a fix available; ` +
      'upgrade the affected packages',
  )
  process.exit(1)
}

console.log(
  hits.length === 0
    ? `OSV OK — 0 advisories across ${packages.length} packages`
    : `OSV WARN — ${hits.length} advisories (warn-only mode; STRICT=1 exits 1 on high/critical with a fix)`,
)
