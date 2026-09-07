#!/usr/bin/env node
/**
 * check-slop — the AUTOMATABLE subset of the 18-item Anti-Slop Audit
 * (agent-pack/QA-CHECKLISTS.md §2; plan §2 W6-03, decision D12).
 *
 * The remaining audit items are manual visual checks owned by the G4
 * verification pass — this script is the machine-checkable slice only.
 *
 * HARD FAILS (exit 1):
 *   1. purple / indigo / violet / fuchsia in classnames or CSS across src/
 *      (the blue palette is a locked user decision — no violet-family drift).
 *   2. Forbidden EN slop-words in messages/en.json VALUES (case-insensitive,
 *      word-boundary matched, phrases included).
 *   3. "lorem ipsum" anywhere under src/.
 *
 * ADVISORY (never fails — taste policy, per plan D17/D27):
 *   - em-dash density in ar/en catalogs,
 *   - rounded-* / shadow-* class census,
 *   - Inter note: KEEP (decision D3 — Inter stays the Latin identity font).
 *
 * Matching approach for the color ban (documented per plan):
 *   Every .ts/.tsx/.css/... text file under src/ is scanned line-by-line with
 *   /(^|[^a-zA-Z])(purple|indigo|violet|fuchsia)(?![a-zA-Z])/gi — this matches
 *   standalone words AND Tailwind-style composed tokens (from-purple-500,
 *   bg-indigo-600, text-violet/50, focus:ring-fuchsia-300, color: purple in
 *   CSS) because '-', ':', '/', '"' are non-letter boundaries. It does NOT
 *   match the words buried inside longer identifiers ("violetish",
 *   "repurple") — variable names are therefore safe, but comments are scanned
 *   too (the ban is absolute; if a documented exception ever becomes
 *   necessary, add it to ALLOWED_COLOR_HITS below with a reason).
 *
 * Zero dependencies. Plain `node` (no bun-specific APIs), same style as
 * scripts/check-i18n-parity.js. Run before every delivery/push.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

// --- Hard fail 1: locked-palette violations --------------------------------
const COLOR_RE = /(^|[^a-zA-Z])(purple|indigo|violet|fuchsia)(?![a-zA-Z])/gi
/** Documented exceptions for the color scan — file path (relative to repo
 * root) + line number + reason. Empty today: the tree is clean. */
const ALLOWED_COLOR_HITS = []

// --- Hard fail 2: EN slop-word list (G2-3 list, plan W6-03) -----------------
const SLOP_WORDS = [
  'delve', 'seamless', 'robust', 'leverage', 'elevate', 'unlock',
  'game-changer', 'empower', 'streamline', 'unleash', 'moreover',
  'furthermore', 'comprehensive', 'showcase', 'underscore', 'pivotal',
  'foster', 'myriad', 'harness', 'illuminate', 'facilitate', 'bolster',
  'it is important to note', 'dive into', 'cutting-edge', 'revolutionary',
  'seamless experience', 'transform your', 'take your to the next level',
  // G4-1 P3 (PACK loop): closed the gap vs the verifier's 24-term census —
  'effortless', 'state-of-the-art',
]
const SLOP_RES = SLOP_WORDS.map((w) => ({
  word: w,
  re: new RegExp(`(?<![a-zA-Z])${w.replace(/[-\s]/g, (c) => (c === '-' ? '-' : '\\s+'))}(?![a-zA-Z])`, 'i'),
}))

// --- Hard fail 3: lorem ipsum ----------------------------------------------
const LOREM_RE = /lorem\s+ipsum/i

const TEXT_EXT = new Set(['.ts', '.tsx', '.css', '.js', '.mjs', '.json', '.md', '.html', '.svg'])

/** Recursive file list under dir filtered by TEXT_EXT. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (TEXT_EXT.has(path.extname(entry.name))) out.push(p)
  }
  return out
}

const srcFiles = walk(SRC)
const failures = []

// --- 1) palette scan --------------------------------------------------------
const colorHits = []
for (const file of srcFiles) {
  const rel = path.relative(ROOT, file)
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    COLOR_RE.lastIndex = 0
    if (COLOR_RE.test(lines[i])) {
      const m = lines[i].match(COLOR_RE)
      colorHits.push(`${rel}:${i + 1} — ${m?.map((x) => x.trim()).join(', ')}`)
    }
  }
}
const colorFailures = colorHits.filter(
  (h) => !ALLOWED_COLOR_HITS.some((a) => h.startsWith(a.file) && h.includes(`:${a.line} —`)),
)
if (colorFailures.length) {
  failures.push(`locked-palette violations (purple/indigo/violet/fuchsia):\n    ${colorFailures.join('\n    ')}`)
}

// --- 2) slop words on en.json VALUES ----------------------------------------
function stringLeaves(o, out = []) {
  if (typeof o === 'string') out.push(o)
  else if (Array.isArray(o)) for (const v of o) stringLeaves(v, out)
  else if (o && typeof o === 'object') for (const v of Object.values(o)) stringLeaves(v, out)
  return out
}
const enValues = stringLeaves(JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/en.json'), 'utf8')))
const slopHits = []
for (const value of enValues) {
  for (const { word, re } of SLOP_RES) {
    if (re.test(value)) slopHits.push(`"${word}" in value: ${value.slice(0, 90)}…`)
  }
}
if (slopHits.length) {
  failures.push(`EN slop-words in messages/en.json:\n    ${slopHits.join('\n    ')}`)
}

// --- 3) lorem ipsum ---------------------------------------------------------
const loremHits = []
for (const file of srcFiles) {
  const rel = path.relative(ROOT, file)
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (LOREM_RE.test(lines[i])) loremHits.push(`${rel}:${i + 1}`)
  }
}
if (loremHits.length) {
  failures.push(`lorem ipsum placeholders:\n    ${loremHits.join('\n    ')}`)
}

// --- Advisory section (never fails) -----------------------------------------
const emDash = {
  en: stringLeaves(JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/en.json'), 'utf8')))
    .join('')
    .split('—').length - 1,
  ar: stringLeaves(JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/ar.json'), 'utf8')))
    .join('')
    .split('—').length - 1,
}
let rounded = 0
let shadow = 0
const classRe = /(?:rounded|shadow)-[a-z0-9]+/g
for (const file of srcFiles) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue
  for (const m of fs.readFileSync(file, 'utf8').matchAll(classRe)) {
    if (m[0].startsWith('rounded')) rounded++
    else shadow++
  }
}

// --- Report ------------------------------------------------------------------
if (failures.length) {
  console.error('SLOP FAIL — hard audit items failed:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  console.error('  (see scripts/check-slop.mjs header for the matching approach + exception lists)')
  process.exit(1)
}

console.log('SLOP OK — automated subset of the 18-item Anti-Slop Audit is GREEN')
console.log(`  palette: 0 purple/indigo/violet/fuchsia hits across ${srcFiles.length} src text files`)
console.log(`  EN copy: 0 forbidden slop-words across ${enValues.length} en.json string values`)
console.log('  placeholders: 0 lorem ipsum hits in src/')
console.log('Advisory (taste policy — never a gate):')
console.log(`  em-dash density: en=${emDash.en}, ar=${emDash.ar} (D17: house style stays, no auto-edit)`)
console.log(`  class census: rounded-*=${rounded}, shadow-*=${shadow} (funnel rule: ~90% no shadow)`)
console.log('  Inter: KEEP — D3 settled decision (custom wght axis, 900 watermark, tracking islands)')
