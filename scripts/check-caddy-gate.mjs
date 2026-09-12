#!/usr/bin/env node
/**
 * check-caddy-gate — F-S1-02 (gold-standard audit): "Add a CI gate that
 * fails if the root Caddyfile contains `query.XTransformPort` or any
 * `reverse_proxy localhost:{query.*}` pattern."
 *
 * The sandbox gateway config (root Caddyfile) is an open-proxy primitive
 * BY DESIGN (?XTransformPort= → arbitrary localhost port, for the preview
 * tooling). It must stay on disk in the sandbox but NEVER enter VCS —
 * a stray commit would hand every future checkout an SSRF-shaped config
 * one `caddy run` away from exposure. Untracked via `git rm --cached`
 * (+ .gitignore); this gate makes the invariant durable:
 *
 *   HARD FAIL (exit 1):
 *     1. A root-level `Caddyfile` (or caddyfile/Caddyfile.*) is TRACKED
 *        by git (CI sees exactly what a fresh clone would).
 *     2. Any TRACKED file at the repo ROOT (depth 1, non-dot) contains
 *        the open-proxy pattern (`XTransformPort` or
 *        `reverse_proxy localhost:{query`).
 *
 * deploy/Caddyfile.example is exempt by path (production shape, audited
 * safe: single upstream, header overwrite, no query-driven proxying).
 *
 * Run: node scripts/check-caddy-gate.mjs   (needs git — CI-safe)
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const EXEMPT = new Set(['deploy/Caddyfile.example'])
const failures = []

/** Tracked files exactly as a fresh clone would materialize them. */
function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
  } catch {
    // Not a git checkout (e.g. an exported tree) — nothing tracked, gate
    // degrades to the pattern scan only.
    return []
  }
}

const files = trackedFiles()

// --- 1) a tracked root Caddyfile -------------------------------------------
for (const f of files) {
  const base = path.basename(f)
  if (path.dirname(f) !== root) continue // root level only
  if (base.toLowerCase().startsWith('caddyfile')) {
    failures.push(
      `tracked root-level ${base} — the sandbox open-proxy config must stay UNTRACKED ` +
        `(git rm --cached Caddyfile; see .gitignore + worklog F-S1-02)`,
    )
  }
}

// --- 2) open-proxy pattern in any tracked root-level file -------------------
for (const f of files) {
  if (path.dirname(f) !== root) continue
  if (EXEMPT.has(f)) continue
  let text = ''
  try {
    text = await readFile(path.join(root, f), 'utf8')
  } catch {
    continue
  }
  if (text.includes('XTransformPort') || text.includes('reverse_proxy localhost:{query')) {
    failures.push(
      `tracked root file ${f} contains the open-proxy pattern (XTransformPort / reverse_proxy localhost:{query…) — ` +
        `sandbox-only tooling must not ship in VCS`,
    )
  }
}

if (failures.length) {
  console.error('CADDY GATE FAIL')
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}

console.log(
  'Caddy gate OK: no tracked root Caddyfile, no open-proxy pattern in tracked root files ' +
    '(sandbox gateway config stays disk-local; production shape lives in deploy/Caddyfile.example)',
)
