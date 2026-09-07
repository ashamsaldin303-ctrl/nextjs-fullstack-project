/**
 * Model loader (HEAVY-1) — real-instrument loading with a module cache.
 *
 * Loads the Poly Haven .gltf files (external .bin + textures resolve
 * relative to the .gltf URL — the exact on-disk layout Task 2-a wrote
 * under public/models/). The RAW gltf scene is cached at module level:
 * route revisits resolve instantly, and the cache OWNS the shared
 * geometries/textures (never disposed — the per-mount clones share them;
 * only the per-mount cloned MATERIALS are disposed by the scene).
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface RawInstrument {
  /** The raw gltf scene — cache-owned, shared, never disposed. */
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
