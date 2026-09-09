/**
 * Model loader (HEAVY-1 / MODEL-3) — body loading with a module cache.
 *
 * MODEL-3 dispatches by source: downloaded Poly Haven .gltf files
 * (external .bin + textures resolve relative to the .gltf URL — the
 * exact on-disk layout fetch-models-m3.mjs wrote under public/models/)
 * load through the GLTF cache below; authored technical kits
 * (tech-kits.ts — the server rack, robot arm, dish…) build
 * synchronously from procedural geometry. Both paths yield the SAME
 * RawInstrument contract, so the scene driver treats them
 * identically. The RAW scene is cached at module level either way:
 * route revisits resolve instantly, and the cache OWNS the shared
 * geometries/textures (never disposed — the per-mount clones share
 * them; only the per-mount cloned MATERIALS are disposed by the
 * scene).
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildTechKit } from './tech-kits'

export interface RawInstrument {
  /** The raw scene (gltf or kit) — cache-owned, shared, never disposed. */
  scene: THREE.Group
  /** Bounding-box size in the model's own units. */
  size: THREE.Vector3
  /** Bounding-box center in the model's own units. */
  center: THREE.Vector3
}

const cache = new Map<string, Promise<RawInstrument>>()

/** Load (or fetch from cache) a real instrument by its /models path. */
export function loadInstrument(src: string): Promise<RawInstrument> {
  let entry = cache.get(src)
  if (!entry) {
    const loader = new GLTFLoader()
    entry = loader.loadAsync(src).then((gltf) => {
      const scene = gltf.scene
      scene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(scene)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      // Guard degenerate fits (a flat plane axis must never be 0).
      const safe = size.clone()
      if (safe.x < 1e-6) safe.x = 1e-6
      if (safe.y < 1e-6) safe.y = 1e-6
      if (safe.z < 1e-6) safe.z = 1e-6
      return { scene, size: safe, center }
    })
    cache.set(src, entry)
    // A failed load must not poison the cache for the next mount.
    entry.catch(() => {
      if (cache.get(src) === entry) cache.delete(src)
    })
  }
  return entry
}

/** A model's source descriptor (the ModelDef fields that pick its
 * loader): a downloaded GLTF path and/or an authored kit name. */
export interface ModelSource {
  src?: string
  kit?: string
}

/** Resolve a body from its def: authored kits build synchronously
 * (module-cached, same contract); GLTF paths load through the async
 * cache. Failures reject — the caller's catch handles them identically
 * (a failed load never poisons either cache). */
export function resolveModel(def: ModelSource): Promise<RawInstrument> {
  if (def.kit) {
    try {
      return Promise.resolve(buildTechKit(def.kit))
    } catch (err) {
      return Promise.reject(err)
    }
  }
  if (def.src) return loadInstrument(def.src)
  return Promise.reject(new Error('[model-loader] ModelDef carries neither src nor kit'))
}
