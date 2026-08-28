#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * i18n parity check — fails (exit 1) if messages/ar.json and messages/en.json
 * drift apart. Verifies per key:
 *   1. presence in both catalogs,
 *   2. value types match (array vs string vs number),
 *   3. array values have equal length, and every string ELEMENT's ICU
 *      placeholder + HTML-tag sets match across locales (L6-F2),
 *   4. ICU placeholder sets match ({name} tokens, incl. the argument of
 *      {count, plural, …} / {x, select, …} — arm text is ignored),
 *   5. numeric leaves are strictly equal (ar 120 vs en 130 fails — L6-F2),
 *   6. no accidentally blanked strings (empty values must be allowlisted),
 *   7. advisory: identical ar/en string values (untranslated-copy risk).
 * Run in CI / pre-delivery.
 */
const fs = require('fs')
const path = require('path')

/** Flattens nested objects to { 'a.b.c': leaf } — arrays stay leaves. */
function flat(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = p + k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      flat(v, key + '.', out)
    } else {
      out[key] = v
    }
  }
  return out
}

/**
 * Extracts ICU placeholder names from a message. Matches `{name}` and the
 * `{name,` head of plural/select arguments; plural `#` and plain prose in
 * arms do not match (arm text contains no bare `{word}` tokens in these
 * catalogs).
 */
function placeholders(value) {
  const tokens = new Set()
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=[},])/g
  let m
  while ((m = re.exec(value))) tokens.add(m[1])
  return tokens
}

/**
 * Extracts HTML tag names from a message ("<b>", "</em>", "<br/>").
 * Used for array ELEMENTS, where the per-string placeholder check never
 * ran before L6-F2 — a translated array element losing its <strong> tag
 * would previously pass parity silently. Tag name only; attributes ignored.
 */
function htmlTags(value) {
  const tags = new Set()
  const re = /<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/g
  let m
  while ((m = re.exec(value))) tags.add(m[1])
  return tags
}

const dir = path.join(__dirname, '..')
const arFlat = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/ar.json'), 'utf8')))
const enFlat = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/en.json'), 'utf8')))

const arKeys = Object.keys(arFlat).sort()
const enKeys = Object.keys(enFlat).sort()

const arOnly = arKeys.filter((k) => !(k in enFlat))
const enOnly = enKeys.filter((k) => !(k in arFlat))

const typeMismatches = []
const arrayLengthMismatches = []
const arrayElementPlaceholderMismatches = []
const arrayElementTagMismatches = []
const numericMismatches = []
const placeholderMismatches = []
let stringKeysChecked = 0
let arrayKeysChecked = 0
let numericKeysChecked = 0

// --- Check 5 (L1-B P3, fix 2-d): intentional-empty allowlist -------------
// An accidentally blanked string would silently pass every check above
// (presence ✓ type ✓ placeholders ✓). Any empty string OUTSIDE this list
// fails the gate. Verified against the current catalogs: besides
// common.cursor.magnet (data-cursor="magnet" maps to "" — no label), the
// two numeric stat suffixes are empty BY DESIGN in both locales — their
// consumers render {value}{suffix} inline and these stats carry no unit.
const EMPTY_STRING_ALLOWED = new Set([
  'common.cursor.magnet',
  'stats.hours.suffix',
  'pages.about.numbers.years.suffix',
])
const emptyViolations = []
for (const k of arKeys) {
  if (arFlat[k] === '' && !EMPTY_STRING_ALLOWED.has(k)) emptyViolations.push(`${k} (ar.json)`)
}
for (const k of enKeys) {
  if (enFlat[k] === '' && !EMPTY_STRING_ALLOWED.has(k)) emptyViolations.push(`${k} (en.json)`)
}

// --- Check 6 (L1-B P3, fix 2-d): identical ar/en string values (advisory) --
// Identical strings are usually legitimate (brand names, contact values,
// the CRM acronym, placeholder-style numerals) but can also be an
// untranslated string — so they are COUNTED and LISTED as a warning while
// the exit code stays 0. Numbers are excluded: ar/en numeric equality is
// expected (durations, stats). Today's catalogs carry ~19 identical
// strings + 23 identical numbers (the 42 legitimate values L1-B verified).
//
// NOT IMPLEMENTED (deliberate decision, fix 2-d): an unused-key scan.
// Deriving key usage from t()-call literals across src/ is too fragile —
// dynamic keys such as t(`services.${id}.title`) defeat a literal scan and
// would produce false positives that make the gate untrustworthy. Dead
// catalog keys are tracked by the manual audits instead (L1-B P3 lists
// the current 8: nav.services, common.back/next/close/getStarted/explore,
// common.reduceMotionNote, hero.canvasFallback).
const identicalStringKeys = []
for (const k of arKeys) {
  if (k in enFlat && typeof arFlat[k] === 'string' && arFlat[k] === enFlat[k]) {
    identicalStringKeys.push(k)
  }
}

for (const k of arKeys) {
  if (!(k in enFlat)) continue
  const a = arFlat[k]
  const e = enFlat[k]
  const aArr = Array.isArray(a)
  const eArr = Array.isArray(e)

  if (aArr !== eArr || typeof a !== typeof e) {
    typeMismatches.push(`${k} (ar: ${aArr ? 'array' : typeof a}, en: ${eArr ? 'array' : typeof e})`)
    continue
  }

  if (aArr) {
    arrayKeysChecked++
    if (a.length !== e.length) {
      arrayLengthMismatches.push(`${k} (ar ${a.length} ≠ en ${e.length})`)
      continue // lengths differ — element pairing is impossible
    }
    // L6-F2: per-element placeholder/HTML comparison (arrays used to be
    // length-checked only, so a translated element could lose its {token}
    // or <tag> without failing the gate).
    for (let i = 0; i < a.length; i++) {
      const av = a[i]
      const ev = e[i]
      if (typeof av !== 'string' || typeof ev !== 'string') continue
      const ap = placeholders(av)
      const ep = placeholders(ev)
      for (const p of ap) {
        if (!ep.has(p)) arrayElementPlaceholderMismatches.push(`${k}[${i}] (ar has {${p}}, en does not)`)
      }
      for (const p of ep) {
        if (!ap.has(p)) arrayElementPlaceholderMismatches.push(`${k}[${i}] (en has {${p}}, ar does not)`)
      }
      const at = htmlTags(av)
      const et = htmlTags(ev)
      for (const tag of at) {
        if (!et.has(tag)) arrayElementTagMismatches.push(`${k}[${i}] (ar has <${tag}>, en does not)`)
      }
      for (const tag of et) {
        if (!at.has(tag)) arrayElementTagMismatches.push(`${k}[${i}] (en has <${tag}>, ar does not)`)
      }
    }
    continue
  }

  // L6-F2: numeric leaves used to be type-checked only — ar 120 vs en 130
  // passed. Numbers must now be identical in both catalogs.
  if (typeof a === 'number') {
    numericKeysChecked++
    if (a !== e) {
      numericMismatches.push(`${k} (ar: ${a}, en: ${e})`)
    }
    continue
  }

  if (typeof a === 'string') {
    stringKeysChecked++
    const ap = placeholders(a)
    const ep = placeholders(e)
    for (const p of ap) {
      if (!ep.has(p)) placeholderMismatches.push(`${k} (ar has {${p}}, en does not)`)
    }
    for (const p of ep) {
      if (!ap.has(p)) placeholderMismatches.push(`${k} (en has {${p}}, ar does not)`)
    }
  }
}

const failed =
  arOnly.length ||
  enOnly.length ||
  typeMismatches.length ||
  arrayLengthMismatches.length ||
  arrayElementPlaceholderMismatches.length ||
  arrayElementTagMismatches.length ||
  numericMismatches.length ||
  placeholderMismatches.length ||
  emptyViolations.length

if (failed) {
  console.error('PARITY FAIL')
  if (arOnly.length) console.error('  Only in ar.json:', arOnly)
  if (enOnly.length) console.error('  Only in en.json:', enOnly)
  if (typeMismatches.length) console.error('  Type mismatches:', typeMismatches)
  if (arrayLengthMismatches.length) console.error('  Array length mismatches:', arrayLengthMismatches)
  if (arrayElementPlaceholderMismatches.length)
    console.error('  Array element placeholder mismatches:', arrayElementPlaceholderMismatches)
  if (arrayElementTagMismatches.length) console.error('  Array element HTML-tag mismatches:', arrayElementTagMismatches)
  if (numericMismatches.length) console.error('  Numeric value mismatches:', numericMismatches)
  if (placeholderMismatches.length) console.error('  Placeholder mismatches:', placeholderMismatches)
  if (emptyViolations.length) console.error('  Empty string values (not in allowlist):', emptyViolations)
  process.exit(1)
}

console.log(`Parity OK: ${arKeys.length} keys matched across ar.json and en.json`)
console.log(
  `  ICU placeholders verified on ${stringKeysChecked} string keys · arrays verified on ${arrayKeysChecked} keys (length + per-element placeholders/tags) · numeric equality verified on ${numericKeysChecked} keys`,
)
console.log(`  Empty-string check: ${EMPTY_STRING_ALLOWED.size} allowlisted keys, no accidental blanks`)
if (identicalStringKeys.length) {
  console.log(
    `  ⚠ ${identicalStringKeys.length} identical ar/en string values (usually legitimate — brand names/contact values — but review for untranslated copy):`,
  )
  for (const k of identicalStringKeys.slice(0, 10)) console.log(`      ${k}`)
  if (identicalStringKeys.length > 10) {
    console.log(`      … and ${identicalStringKeys.length - 10} more`)
  }
}
