#!/usr/bin/env node
/**
 * gen-sbom — CycloneDX 1.5 Software Bill of Materials (F-S6-05 —
 * gold-standard audit: "No SBOM for product dependencies").
 *
 * Source of truth: bun.lock (exact resolved versions + registry URLs +
 * integrity hashes) — NOT package.json ranges — so the SBOM reflects
 * what actually ships. Direct dependencies (root workspace) are marked
 * `scope: required` with a `direct` property; the full transitive graph
 * rides along as one flat component list (dependency *relationships*
 * exist in bun.lock's per-package metadata; CycloneDX dependencies are
 * intentionally omitted to keep the artifact small and stable — version
 * pinning is what CVE matching consumes).
 *
 * Output: sbom.cyclonedx.json (gitignored — a generated artifact, rebuilt
 * per release; the release process commits/uploads it alongside the
 * standalone bundle).
 *
 * Run: node scripts/gen-sbom.mjs [--out sbom.cyclonedx.json]
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// bun.lock is JSONC (trailing commas) — strip, then parse.
const raw = await readFile(path.join(root, 'bun.lock'), 'utf8')
const lock = JSON.parse(raw.replace(/,(\s*[}\]])/g, '$1'))

/** Root workspace entry (name "": the app itself). */
const workspace = lock.workspaces?.[''] ?? {}
const directDeps = {
  ...(workspace.dependencies ?? {}),
  ...(workspace.devDependencies ?? {}),
}

/**
 * Component from a bun.lock package entry:
 *   "name": ["name@version", "https://registry.npmjs.com/...tgz", {meta}, "sha512-..."]
 */
function component(name, entry, isDirect) {
  const [id, url, , hash] = Array.isArray(entry) ? entry : [`${name}@unknown`, '', {}, '']
  const at = id.lastIndexOf('@')
  const version = at > 0 ? id.slice(at + 1) : 'unknown'
  const purl = `pkg:npm/${encodeURIComponent(name)}@${version}`
  const comp = {
    type: 'library',
    'bom-ref': purl,
    name,
    version,
    purl,
    scope: isDirect ? 'required' : 'excluded', // 'excluded' = transitive
  }
  if (isDirect) comp.properties = [{ name: 'elyra:direct', value: 'true' }]
  if (typeof hash === 'string' && hash.startsWith('sha512-')) {
    comp.hashes = [{ alg: 'SHA-512', content: hash.slice('sha512-'.length) }]
  }
  if (typeof url === 'string' && url.startsWith('http')) {
    comp.externalReferences = [
      { type: 'distribution', url },
    ]
  }
  return comp
}

const packages = lock.packages ?? {}
const components = []

// The application itself as the root component.
const appVersion = await readFile(path.join(root, 'package.json'), 'utf8')
  .then((s) => JSON.parse(s).version)
  .catch(() => '1.0.0')
const appRef = `pkg:npm/elyra@${appVersion}`
components.push({
  type: 'application',
  'bom-ref': appRef,
  name: 'elyra',
  version: appVersion,
  purl: appRef,
})

// Direct deps first (required scope), then the transitive graph.
for (const name of Object.keys(directDeps)) {
  const entry = packages[name]
  if (entry) components.push(component(name, entry, true))
}
for (const [name, entry] of Object.entries(packages)) {
  if (!(name in directDeps)) components.push(component(name, entry, false))
}

const outIdx = process.argv.indexOf('--out')
const outPath =
  outIdx !== -1 ? path.resolve(process.argv[outIdx + 1] ?? 'sbom.cyclonedx.json') : path.join(root, 'sbom.cyclonedx.json')

const serial = `urn:uuid:${crypto.randomUUID()}`
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: serial,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: components[0],
    tools: [{ vendor: 'elyra', name: 'scripts/gen-sbom.mjs', version: '1.0.0' }],
  },
  components: components.slice(1),
}

await writeFile(outPath, JSON.stringify(bom, null, 2) + '\n')

const direct = components.filter((c) => c.properties?.some((p) => p.name === 'elyra:direct')).length
console.log(
  `SBOM written: ${path.relative(root, outPath)} — ${components.length - 1} components ` +
    `(${direct} direct + ${components.length - 1 - direct} transitive), CycloneDX ${bom.specVersion}, serial ${serial}`,
)
