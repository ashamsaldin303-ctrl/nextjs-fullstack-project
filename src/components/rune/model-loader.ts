/**
 * Model loader (HEAVY-1 / MODEL-3) — body loading with a module cache.
 *
 * MODEL-3 dispatched by source: downloaded Poly Haven .gltf files and
 * authored technical kits (tech-kits.ts). F-S6-06 (gold-standard
 * audit): the GLTF branch was DEAD code — every registry entry ships
 * `kit:` (model-registry.ts, 10/10 entries at audit time; public/models
 * holds only an empty manifest) — yet the GLTFLoader import dragged the
 * whole GLTF parser into the rune chunk, so the loader, its async cache
 * and the src: branch were removed. The kit path is byte-identical:
 * tech-kits owns the module-level kit cache and the shared
 * geometries/textures (never disposed — the per-mount clones share
 * them; only the per-mount cloned MATERIALS are disposed by the scene).
 * Future extension point: ModelSource.src below — a def carrying
 * neither src nor kit still rejects with the standing error.
 */

import * as THREE from 'three'
import { buildTechKit } from './tech-kits'

export interface RawInstrument {
  /** The raw kit scene — cache-owned, shared, never disposed. */
  scene: THREE.Group
  /** Bounding-box size in the model's own units. */
  size: THREE.Vector3
  /** Bounding-box center in the model's own units. */
  center: THREE.Vector3
}

/** A model's source descriptor (the ModelDef fields that pick its
 * loader): an authored kit name, and/or a downloaded-model path — the
 * src field is the documented future extension point (no loader ships
 * for it today; see the header note). */
export interface ModelSource {
  src?: string
  kit?: string
}

/** Resolve a body from its def: authored kits build synchronously
 * (module-cached in tech-kits, same contract). Failures reject — the
 * caller's catch handles them identically. */
export function resolveModel(def: ModelSource): Promise<RawInstrument> {
  if (def.kit) {
    try {
      return Promise.resolve(buildTechKit(def.kit))
    } catch (err) {
      return Promise.reject(err)
    }
  }
  // No GLTF loader ships (F-S6-06): a src-only def is unreachable in
  // the registry — the field stays as the documented re-entry point.
  return Promise.reject(new Error('[model-loader] ModelDef carries neither src nor kit'))
}
