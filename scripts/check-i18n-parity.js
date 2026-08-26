#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * i18n parity check — fails (exit 1) if messages/ar.json and messages/en.json
 * drift apart. Verifies per key:
 *   1. presence in both catalogs,
 *   2. value types match (array vs string vs number),
 *   3. array values have equal length,
 *   4. ICU placeholder sets match ({name} tokens, incl. the argument of
 *      {count, plural, …} / {x, select, …} — arm text is ignored).
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

const dir = path.join(__dirname, '..')
const arFlat = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/ar.json'), 'utf8')))
const enFlat = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/en.json'), 'utf8')))

const arKeys = Object.keys(arFlat).sort()
const enKeys = Object.keys(enFlat).sort()

const arOnly = arKeys.filter((k) => !(k in enFlat))
const enOnly = enKeys.filter((k) => !(k in arFlat))

const typeMismatches = []
const arrayLengthMismatches = []
const placeholderMismatches = []
let stringKeysChecked = 0
let arrayKeysChecked = 0

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
  placeholderMismatches.length

if (failed) {
  console.error('PARITY FAIL')
  if (arOnly.length) console.error('  Only in ar.json:', arOnly)
  if (enOnly.length) console.error('  Only in en.json:', enOnly)
  if (typeMismatches.length) console.error('  Type mismatches:', typeMismatches)
  if (arrayLengthMismatches.length) console.error('  Array length mismatches:', arrayLengthMismatches)
  if (placeholderMismatches.length) console.error('  Placeholder mismatches:', placeholderMismatches)
  process.exit(1)
}

console.log(`Parity OK: ${arKeys.length} keys matched across ar.json and en.json`)
console.log(`  ICU placeholders verified on ${stringKeysChecked} string keys · array lengths verified on ${arrayKeysChecked} array keys`)
