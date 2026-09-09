#!/usr/bin/env node
/**
 * fetch-models-m3.mjs — MODEL-3 generation downloader.
 *
 * MODEL-3 is the TECHNICAL-ESSENCE set («ماهية الموقع ووظيفته، لا هويته»):
 * the owner rejected both the vintage-observatory AND the workshop/craft
 * bodies — the site's bodies must now be TECHNICAL objects that say what
 * a digital studio BUILDS (software, infrastructure, automation, devices).
 *
 * Research verdict that shaped this set (recorded for provenance):
 *  · Poly Haven's full 521-model catalog was re-pulled and tech-filtered —
 *    exactly ONE scan fits the brief (a real PCB: `circuit_board`); the
 *    rest of its "tech" is vintage consumer electronics (classic_laptop,
 *    retro_multimeter, vintage_radio_transceiver…) — the very aesthetic
 *    the owner rejected.
 *  · poly.pizza is Cloudflare-walled from this sandbox; Quaternius/Kenney
 *    kits are flat-color low-poly that would clash with the studio-PBR
 *    stage the bodies render on.
 *  · The professional route for technical hero bodies (the Stripe/Linear
 *    school) is AUTHORED kits: procedural geometry, real PBR materials
 *    keyed to the brand tokens, and named part nodes the scroll-driver
 *    can articulate. Those live in src/components/rune/tech-kits.ts —
 *    nothing to download.
 *
 * This script therefore only downloads circuit_board (about hero — «صنعة
 * اليد الجديدة: دوائر مطبوعة», a real photoscanned PCB) and regenerates
 * public/models/manifest.json covering BOTH downloaded assets and the
 * procedural kits (so the manifest stays the one-stop inventory of every
 * body the registry can mount).
 *
 * md5-verified, idempotent, safe to re-run (MODEL-2 downloader pattern).
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MODELS_DIR = path.join(ROOT, 'public', 'models')
const API = 'https://api.polyhaven.com'

/** Downloaded (photoscan) members of the MODEL-3 set. */
const WANTED = {
  circuit_board: '1k', // about hero — the real printed circuit board
  rubber_duck_toy: '1k', // 404 — the debugging duck (MODEL-2 survivor)
}

/** Procedural (authored-kit) members — see src/components/rune/tech-kits.ts. */
const KITS = [
  { kit: 'serverRack', section: 'home hero', nodes: ['fan_a', 'fan_b', 'fan_c'] },
  { kit: 'cpuChip', section: 'home method', nodes: [] },
  { kit: 'laptopStudio', section: 'websites hero', nodes: ['lid'] },
  { kit: 'robotArm', section: 'automation hero', nodes: ['shoulder', 'elbow', 'wrist', 'grip_l', 'grip_r'] },
  { kit: 'smartphone', section: 'work hero', nodes: [] },
  { kit: 'dataStack', section: 'about story', nodes: ['sled_c'] },
  { kit: 'dishAntenna', section: 'contact hero', nodes: ['azimuth', 'elevation'] },
]

const md5 = (buf) => createHash('md5').update(buf).digest('hex')

async function dl(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return Buffer.from(await r.arrayBuffer())
    } catch (e) {
      if (attempt === 3) throw e
      await new Promise((res) => setTimeout(res, 1200 * attempt))
    }
  }
}

async function fetchVerified(url, file, expectedMd5) {
  if (existsSync(file)) {
    const prev = await readFile(file)
    if (md5(prev) === expectedMd5) {
      console.log(`  ✓ cached ${path.relative(MODELS_DIR, file)}`)
      return prev
    }
  }
  const buf = await dl(url)
  const got = md5(buf)
  if (got !== expectedMd5) {
    throw new Error(`md5 mismatch for ${url}: ${got} != ${expectedMd5}`)
  }
  await writeFile(file, buf)
  console.log(`  ↓ saved  ${path.relative(MODELS_DIR, file)} (${(buf.length / 1048576).toFixed(2)}MB)`)
  return buf
}

function parseGltfMeta(gltfText) {
  const j = JSON.parse(gltfText)
  const exts = j.extensionsUsed ?? []
  const mats = (j.materials ?? []).map((m) => m.name ?? '(unnamed)')
  const nodes = (j.nodes ?? []).map((n) => n.name ?? '(unnamed)')
  let poly = 0
  for (const mesh of j.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const pos = (j.accessors ?? [])[prim.attributes?.POSITION]
      if (pos && typeof pos.count === 'number') poly += pos.count
    }
  }
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of j.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const pos = (j.accessors ?? [])[prim.attributes?.POSITION]
      if (!pos?.min || !pos?.max) continue
      for (let i = 0; i < 3; i++) {
        if (pos.min[i] < min[i]) min[i] = pos.min[i]
        if (pos.max[i] > max[i]) max[i] = pos.max[i]
      }
    }
  }
  const dims = Number.isFinite(min[0])
    ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((x) => Math.round(x * 10000) / 10000)
    : null
  return { poly, nodes, mats, exts, dims, meshCount: (j.meshes ?? []).length }
}

async function dirBytes(dir) {
  let totalBytes = 0
  const walk = async (d) => {
    for (const f of await readdir(d)) {
      const p = path.join(d, f)
      const s = await stat(p)
      if (s.isDirectory()) await walk(p)
      else totalBytes += s.size
    }
  }
  await walk(dir)
  return totalBytes
}

const manifest = { generatedAt: new Date().toISOString(), models: [], proceduralKits: KITS }

for (const [slug, wantedRes] of Object.entries(WANTED)) {
  console.log(`\n== ${slug} (${wantedRes}) ==`)
  const filesRes = await (await fetch(`${API}/files/${slug}`)).json()
  const g = filesRes.gltf ?? {}
  const res = g[wantedRes] ? wantedRes : g['1k'] ? '1k' : '2k'
  const entry = g[res]?.gltf
  if (!entry) throw new Error(`${slug}: no gltf variant`)

  const dir = path.join(MODELS_DIR, slug)
  const texDir = path.join(dir, 'textures')
  await mkdir(texDir, { recursive: true })

  const gltfName = entry.url.split('/').pop()
  const gltfPath = path.join(dir, gltfName)
  const gltfBuf = await fetchVerified(entry.url, gltfPath, entry.md5)

  for (const [rel, info] of Object.entries(entry.include ?? {})) {
    const dest = path.join(dir, rel)
    await mkdir(path.dirname(dest), { recursive: true })
    await fetchVerified(info.url, dest, info.md5)
  }

  const meta = parseGltfMeta(gltfBuf.toString('utf8'))
  manifest.models.push({
    slug,
    variant: res,
    mainFile: `public/models/${slug}/${gltfName}`,
    totalMB: Math.round(((await dirBytes(dir)) / 1048576) * 100) / 100,
    polycount: meta.poly,
    dimensionsMeters: meta.dims ?? [0, 0, 0],
    animations: [],
    nodeNames: meta.nodes,
    meshCount: meta.meshCount,
    materialNames: meta.mats,
    extensionsUsed: meta.exts,
    files: [gltfName, ...Object.keys(entry.include ?? {})],
  })
}

await writeFile(path.join(MODELS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log('\nmanifest.json regenerated —', manifest.models.length, 'downloaded models +', KITS.length, 'procedural kits')
