#!/usr/bin/env node
/**
 * check-secrets — zero-dependency pre-push secret gate (plan §2 W6-04,
 * decision D11: a local regex script, NOT gitleaks — no binary/CI in this
 * sandbox; same style as scripts/check-i18n-parity.js).
 *
 * Run it BEFORE ANY PUSH: `node scripts/check-secrets.mjs` → must exit 0.
 *
 * What it scans:
 *   (a) every git-tracked file (`git ls-files` — includes staged files),
 *       line by line;
 *   (b) the full `git diff origin/main..HEAD`, ADDED lines only ('+' lines,
 *       per current file from the '+++ b/<path>' headers — a secret that was
 *       already in origin/main is out of this branch's scope).
 *
 * Patterns (deliberately tightened to avoid false positives — the tightness
 * is the documented matching approach):
 *   - classic token shapes require realistic lengths/charsets:
 *     ghp_/gho_ + 30+ alnum, github_pat_ + 22+, sk- + 20+ (avoids "mask-"
 *     CSS hits), AKIA + 16 caps, AIza + 35, xox[baprs]- + 10+, and JWTs as
 *     two dot-separated eyJ… segments (a bare eyJ inside base64 hashes
 *     is not a JWT);
 *   - PEM markers via a concatenated literal (see PEM_RE below);
 *   - env-style secrets (N8N_WEBHOOK_SECRET= / STITCH_API_KEY=) only when a
 *     VALUE follows: the value token must contain an alphanumeric AND not be
 *     a placeholder. Placeholder convention (skipped, documented): tokens
 *     starting with '<' (e.g. "<openssl rand -hex 32>"), the literal words
 *     "placeholder"/"…"/"...", or tokens with no alphanumerics. Lines where
 *     the key is bare ("KEY=" with nothing after) never match.
 *
 * The scanner never scans ITS OWN source (scripts/check-secrets.mjs): the
 * pattern literals below are regex text, not secrets.
 *
 * Documented false-positive exception (exactly one today):
 *   - worklog.md, the line containing "tracked-file scan for" — it DESCRIBES
 *     a past secret-pattern scan and mentions pattern names as prose; it
 *     carries no secret values.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SELF_REL = 'scripts/check-secrets.mjs'

// Built by concatenation so the scanner's own source cannot match itself.
const PEM_RE = new RegExp('PRIVATE' + ' ' + 'KEY')

const PATTERNS = [
  { name: 'GitHub PAT (classic)', re: /ghp_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub OAuth token', re: /gho_[A-Za-z0-9]{30,}/ },
  { name: 'GitHub fine-grained PAT', re: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: 'AWS access key ID', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Google API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Slack token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: 'JWT (two segments)', re: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./ },
  { name: 'PEM private-key marker', re: PEM_RE },
  { name: 'N8N_WEBHOOK_SECRET value', envKey: 'N8N_WEBHOOK_SECRET=' },
  { name: 'STITCH_API_KEY value', envKey: 'STITCH_API_KEY=' },
]

/** Placeholder-convention filter for env-style values (documented above). */
function isPlaceholderValue(token) {
  if (!token) return true
  if (token.startsWith('<')) return true
  const t = token.toLowerCase()
  if (t === 'placeholder' || t === '...' || t === '…' || t === 'changeme') return true
  if (!/[a-z0-9]/i.test(token)) return true
  return false
}

const hits = []

function scanLine(line, where) {
  for (const p of PATTERNS) {
    if (p.envKey) {
      const m = line.match(new RegExp(p.envKey + '\\s*(\\S*)'))
      if (m && !isPlaceholderValue(m[1])) hits.push(`${where} [${p.name}] value after ${p.envKey.slice(0, -1)}= …`)
      continue
    }
    if (p.re.test(line)) hits.push(`${where} [${p.name}]`)
  }
}

// --- (a) tracked files -------------------------------------------------------
const tracked = execSync('git ls-files', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString()
  .trim()
  .split('\n')
  .filter((f) => f && f !== SELF_REL)
let trackedScanned = 0
for (const rel of tracked) {
  let content
  try {
    content = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  } catch {
    continue // binary/unreadable
  }
  trackedScanned++
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    // The one documented exception: worklog prose describing a past scan.
    if (rel === 'worklog.md' && lines[i].includes('tracked-file scan for')) continue
    scanLine(lines[i], `${rel}:${i + 1}`)
  }
}

// --- (b) full branch diff, added lines only ----------------------------------
let diffScanned = 0
try {
  const diff = execSync('git diff origin/main..HEAD', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString()
  let currentFile = ''
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ b/')) currentFile = raw.slice(6).trim()
    else if (raw.startsWith('+') && !raw.startsWith('+++') && currentFile && currentFile !== SELF_REL) {
      diffScanned++
      // Same single exception applies inside the diff if the line ever lands there.
      if (currentFile === 'worklog.md' && raw.includes('tracked-file scan for')) continue
      scanLine(raw.slice(1), `diff origin/main..HEAD ${currentFile} (+)`)
    }
  }
} catch (e) {
  console.error('  (diff scan skipped — no origin/main ref or git error:', String(e).slice(0, 120), ')')
}

// --- Report -------------------------------------------------------------------
if (hits.length) {
  console.error('SECRETS FAIL — pattern hits found (DO NOT PUSH):')
  for (const h of hits) console.error(`  ✗ ${h}`)
  process.exit(1)
}

console.log(
  `SECRETS OK — 0 hits: ${trackedScanned} tracked files scanned line-by-line + ${diffScanned} added diff lines vs origin/main (self + 1 documented worklog exception skipped)`,
)
