#!/usr/bin/env node
/**
 * fetch-models-m2.mjs — MODEL-2 generation downloader.
 *
 * Downloads the Poly Haven CC0 models chosen for the Elyra semantic
 * overhaul (one real object per ROUTE SECTION, matched by meaning —
 * see src/components/rune/model-registry.ts) into
 * public/models/<slug>/ using the exact layout the GLTFLoader expects:
 *   <slug>_<res>.gltf + <slug>.bin + textures/*.jpg
 * and then regenerates public/models/manifest.json (files, polycount,
 * node names, materials, extensions, dimensions in meters).
 *
 * md5-verified, idempotent (existing files with a matching md5 are
 * skipped), and safe to re-run.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const MODELS_DIR = path.join(ROOT, 'public', 'models')
const API = 'https://api.polyhaven.com'

/** The MODEL-2 set: slug → preferred texture variant (fallback 1k). */
const WANTED = {
  brass_vase_01: '2k', // home hero — the Damascene vessel (star object)
  magnifying_glass_01: '1k', // home method — precision inspection
  projector_screen: '1k', // websites hero — the blank canvas
  drill_press_01: '1k', // automation hero — the machine
  Camera_01: '2k', // work hero — the lens (leather + brass patina)
  hand_plane_no4: '1k', // about hero — the hand craft
  book_encyclopedia_set_01: '1k', // about story — the volumes
  lightbulb_led: '1k', // contact hero — the idea
  rubber_duck_toy: '1k', // 404 — the debugging duck
}

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

/* --- gltf JSON parsing (manifest metadata) ------------------------- */
function parseGltfMeta(gltfJson, gltfText) {
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
  // Dimensions from accessor min/max, propagated through node matrices
  // ( Poly Haven models are a flat scene with identity root transforms,
  //   so accessor min/max is already world-accurate for these assets ).
  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const mesh of j.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const pos = (j.accessors ?? [])[prim.attributes?.POSITION]
      if (!pos?.min || !pos?.max) continue
      for (let i = 0; i < 3; i++) {
        if (pos.min[i] < min[i]) min[i] = pos.min[i]
        if (pos.max[i] > max[i]) max[i] = pos[i] > max[i] ? pos.max[i] : Math.max(pos.max[i], max[i])
      }
    }
  }
  const dims = Number.isFinite(min[0])
    ? [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((x) => Math.round(x * 10000) / 10000)
    : null
  return { poly, nodes, mats, exts, dims, meshCount: (j.meshes ?? []).length }
}

/* --- main ----------------------------------------------------------- */
const manifest = { generatedAt: new Date().toISOString(), models: [] }

for (const [slug, wantedRes] of Object.entries(WANTED)) {
  console.log(`\n== ${slug} (${wantedRes}) ==`)
  const filesRes = await (await fetch(`${API}/files/${slug}`)).json()
  const g = filesRes.gltf ?? {}
  // API layout: g[<res>].gltf = { include, size, url, md5 }
  const res = g[wantedRes] ? wantedRes : g['1k'] ? '1k' : '2k'
  const entry = g[res]?.gltf
  if (!entry) throw new Error(`${slug}: no gltf variant`)

  const dir = path.join(MODELS_DIR, slug)
  const texDir = path.join(dir, 'textures')
  await mkdir(texDir, { recursive: true })

  // main .gltf
  const gltfName = entry.url.split('/').pop()
  const gltfPath = path.join(dir, gltfName)
  const gltfBuf = await fetchVerified(entry.url, gltfPath, entry.md5)

  // sidecars (bin + textures) — paths are relative to the .gltf
  for (const [rel, info] of Object.entries(entry.include ?? {})) {
    const dest = path.join(dir, rel)
    await mkdir(path.dirname(dest), { recursive: true })
    await fetchVerified(info.url, dest, info.md5)
  }

  // metadata
  const meta = parseGltfMeta(slug, gltfBuf.toString('utf8'))

  // total MB on disk for this slug
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

  manifest.models.push({
    slug,
    variant: res,
    mainFile: `public/models/${slug}/${gltfName}`,
    totalMB: Math.round((totalBytes / 1048576) * 100) / 100,
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
console.log('\nmanifest.json regenerated —', manifest.models.length, 'models')
