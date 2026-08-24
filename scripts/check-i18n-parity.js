#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * i18n parity check — fails (exit 1) if messages/ar.json and messages/en.json
 * have any key that exists in one file but not the other. Run in CI / pre-delivery.
 */
const fs = require('fs')
const path = require('path')

function flat(o, p = '') {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? flat(v, p + k + '.') : [p + k]
  )
}

const dir = path.join(__dirname, '..')
const ar = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/ar.json'), 'utf8'))).sort()
const en = flat(JSON.parse(fs.readFileSync(path.join(dir, 'messages/en.json'), 'utf8'))).sort()

const arOnly = ar.filter((k) => !en.includes(k))
const enOnly = en.filter((k) => !ar.includes(k))

if (arOnly.length || enOnly.length) {
  console.error('PARITY FAIL')
  if (arOnly.length) console.error('  Only in ar.json:', arOnly)
  if (enOnly.length) console.error('  Only in en.json:', enOnly)
  process.exit(1)
}

console.log(`Parity OK: ${ar.length} keys matched across ar.json and en.json`)
