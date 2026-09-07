'use client'

import * as THREE from 'three'
import { BRAND_COLORS } from '@/lib/brand-colors'
import type { LandmarkKind, LandmarkSpec } from './rune-landmarks'

/**
 * Rune assemblies (RUNE-3) — the SEMANTIC OBJECT LIBRARY.
 *
 * Each builder composes real, recognizable structure out of primitives
 * (spheres, tori, boxes, tubes) so every landmark MEANS the section it
 * lives beside («مجسمات تدل على كل شيء») — an orbit core for the
 * identity hub, gears the scroll literally cranks for automation,
 * a journey path that draws itself for the studio story, dials that
 * sweep for the calculator, an envelope that seals for the contact
 * form…
 *
 * Style: «المخطط الحي» — the living blueprint. Translucent fills (the
 * brand's glass) + crisp edge lines (the drawn stroke) + sparse sparks,
 * tuned per light/dark section band so the bodies read on both.
 *
 * MOTION CONTRACT (every builder obeys it):
 * · `tick(p, D, S, energy, alpha)` is a PURE function — no wall clock,
 *   no randomness, nothing but the scroll clocks and the section
 *   progress. Scrolling up replays the design in reverse, exactly.
 * · p is the section's travel through the viewport (0 entering → 1
 *   exited) — the choreography's timeline.
 * · D/S are the scroll-store clocks (signed / unsigned px).
 * · alpha carries the presence envelope + route fade — materials are
 *   dimmed through it, never re-created.
 *
 * Ownership: every geometry/material an assembly creates is disposed by
 * its own dispose() (the scene disposes assemblies on route rebuild).
 * The scene drives each assembly inside a HOLDER group (position,
 * presence scale, scroll spin); builders own their inner rotations.
 */

/* ------------------------------------------------------------------ *
 * Palettes
 * ------------------------------------------------------------------ */
export interface LandmarkPalette {
  edge: string
  edge2: string
  fill: string
  spark: string
  fillAlpha: number
  edgeAlpha: number
  edge2Alpha: number
  sparkAlpha: number
}

const g = BRAND_COLORS

export const LANDMARK_PALETTES: Record<'light' | 'dark', LandmarkPalette> = {
  // light sections (bg-background): deep stroke, airy fill — the
  // stroke carries the recognition, the fill stays glass
  light: {
    edge: g.gBlue,
    edge2: g.gGreen,
    fill: g.wash,
    spark: g.gBlueLight,
    fillAlpha: 0.42,
    edgeAlpha: 0.78,
    edge2Alpha: 0.7,
    sparkAlpha: 0.85,
  },
  // dark sections (elyra-dark / elyra-deep): glowing stroke
  dark: {
    edge: g.gGreen,
    edge2: g.gBlueLight,
    fill: g.gGreen,
    spark: g.gGreen,
    fillAlpha: 0.18,
    edgeAlpha: 0.95,
    edge2Alpha: 0.75,
    sparkAlpha: 0.9,
  },
}

/* ------------------------------------------------------------------ *
 * Assembly interface + shared helpers
 * ------------------------------------------------------------------ */
export interface AssemblyTick {
  (p: number, D: number, S: number, energy: number, alpha: number): void
}

export interface Assembly {
  group: THREE.Group
  tick: AssemblyTick
  dispose: () => void
}

/** Section travel progress helpers — the designed easing vocabulary. */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep(lo: number, hi: number, v: number): number {
  const t = clamp01((v - lo) / (hi - lo))
  return t * t * (3 - 2 * t)
}

/** pop() — staggered item materialisation keyed to section progress. */
function pop(p: number, start: number, window: number): number {
  return smoothstep(start, start + window, p)
}

/** frac() — wrapped 0..1 phase (ring emanation cycles). */
function frac(v: number): number {
  return v - Math.floor(v)
}

/** Bounds-checked array read — build-time constant indices only (the
 * designed layouts are closed tuples; the guard satisfies strict index
 * access without forbidden non-null assertions). */
function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i]
  if (v === undefined) throw new Error(`[rune-assemblies] missing index ${i}`)
  return v
}

let spriteTex: THREE.CanvasTexture | null = null

/** Round motes sprite (shared, lazily built once — client-only module). */
function roundSprite(): THREE.CanvasTexture {
  if (spriteTex) return spriteTex
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d')
  if (ctx) {
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 15)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 32, 32)
  }
  spriteTex = new THREE.CanvasTexture(c)
  return spriteTex
}

/** One assembly's material kit — shared inside the assembly, dimmed
 * together through alpha; edges lift with scroll energy. */
interface Kit {
  fill: THREE.MeshBasicMaterial
  edge: THREE.LineBasicMaterial
  edge2: THREE.LineBasicMaterial
  fill2: THREE.MeshBasicMaterial
  spark: THREE.PointsMaterial
  ring: THREE.MeshBasicMaterial
  setAlpha: (alpha: number, energy: number) => void
  dispose: () => void
}

function makeKit(pal: LandmarkPalette): Kit {
  const fill = new THREE.MeshBasicMaterial({
    color: pal.fill,
    transparent: true,
    opacity: pal.fillAlpha,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const fill2 = new THREE.MeshBasicMaterial({
    color: pal.edge2,
    transparent: true,
    opacity: pal.fillAlpha * 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const edge = new THREE.LineBasicMaterial({
    color: pal.edge,
    transparent: true,
    opacity: pal.edgeAlpha,
    depthWrite: false,
  })
  const edge2 = new THREE.LineBasicMaterial({
    color: pal.edge2,
    transparent: true,
    opacity: pal.edge2Alpha,
    depthWrite: false,
  })
  const spark = new THREE.PointsMaterial({
    color: pal.spark,
    size: 3.2,
    sizeAttenuation: false,
    map: roundSprite(),
    transparent: true,
    opacity: pal.sparkAlpha,
    depthWrite: false,
  })
  const ring = new THREE.MeshBasicMaterial({
    color: pal.edge,
    transparent: true,
    opacity: pal.edgeAlpha,
    depthWrite: false,
  })
  const setAlpha = (alpha: number, energy: number) => {
    fill.opacity = pal.fillAlpha * alpha
    fill2.opacity = pal.fillAlpha * 0.8 * alpha
    edge.opacity = Math.min(1, pal.edgeAlpha + 0.28 * energy) * alpha
    edge2.opacity = Math.min(1, pal.edge2Alpha + 0.28 * energy) * alpha
    spark.opacity = pal.sparkAlpha * alpha
    ring.opacity = pal.edgeAlpha * alpha
  }
  const dispose = () => {
    fill.dispose()
    fill2.dispose()
    edge.dispose()
    edge2.dispose()
    spark.dispose()
    ring.dispose()
  }
  return { fill, edge, edge2, fill2, spark, ring, setAlpha, dispose }
}

/** Disposal ledger — every assembly pushes its disposables here. */
class Ledger {
  private items: { dispose: () => void }[] = []
  add<T extends { dispose: () => void }>(x: T): T {
    this.items.push(x)
    return x
  }
  dispose(): void {
    for (const it of this.items) it.dispose()
    this.items = []
  }
}

/** Filled mesh (no-frustum-cull — the rig owns placement). */
function solidMesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  return mesh
}

/** LineSegments from an EdgesGeometry. */
function edgeLines(geo: THREE.BufferGeometry, material: THREE.Material): THREE.LineSegments {
  const lines = new THREE.LineSegments(geo, material)
  lines.frustumCulled = false
  return lines
}

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

/** نواة — orbit system: hub + three tilted rings with satellites. */
function buildOrbitSystem(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const hubGeo = led.add(new THREE.IcosahedronGeometry(0.15, 1))
  const hub = solidMesh(hubGeo, kit.fill)
  const hubEdges = edgeLines(led.add(new THREE.EdgesGeometry(hubGeo)), kit.edge)
  group.add(hub, hubEdges)

  interface Ring {
    node: THREE.Group
    rate: number
  }
  const rings: Ring[] = []
  const ringDefs: { radius: number; tiltX: number; tiltY: number; rate: number; sats: number }[] = [
    { radius: 0.27, tiltX: 1.25, tiltY: 0.0, rate: 0.0009, sats: 1 },
    { radius: 0.36, tiltX: -0.55, tiltY: 0.35, rate: -0.0006, sats: 1 },
    { radius: 0.44, tiltX: 0.25, tiltY: -0.9, rate: 0.0012, sats: 2 },
  ]
  for (const def of ringDefs) {
    const node = new THREE.Group()
    node.rotation.set(def.tiltX, def.tiltY, 0)
    const torusGeo = led.add(new THREE.TorusGeometry(def.radius, 0.005, 5, 72))
    node.add(solidMesh(torusGeo, kit.ring))
    for (let s = 0; s < def.sats; s++) {
      const satGeo = led.add(new THREE.OctahedronGeometry(0.026))
      const sat = solidMesh(satGeo, kit.fill2)
      const ang = (s / def.sats) * Math.PI * 2
      sat.position.set(Math.cos(ang) * def.radius, Math.sin(ang) * def.radius, 0)
      node.add(sat)
    }
    group.add(node)
    rings.push({ node, rate: def.rate })
  }

  const tick: AssemblyTick = (p, D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (const r of rings) r.node.rotation.z = D * r.rate
    hub.rotation.y = D * 0.0005
    hubEdges.rotation.y = D * 0.0005
    const breath = 1 + spec.breath * 0.5 * Math.sin(S * 0.0024 + spec.phase)
    hub.scale.setScalar(Math.max(breath, 0.0001))
    hubEdges.scale.setScalar(Math.max(breath, 0.0001))
    group.rotation.x = 0.12 + (p - 0.5) * 0.18
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** حصيلة — ascending constellation of octahedra (stats / people). */
function buildConstellation(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  interface Item {
    node: THREE.Group
    start: number
    baseY: number
    phase: number
  }
  const items: Item[] = []
  // designed ascending arc — the harvest accumulating upward
  const layout: [number, number, number][] = [
    [-0.3, -0.26, 0.05],
    [-0.12, -0.3, 0.04],
    [0.06, -0.18, 0.06],
    [-0.2, -0.02, 0.07],
    [0.16, 0.02, 0.05],
    [0.3, 0.14, 0.08],
    [0.0, 0.24, 0.06],
    [0.2, 0.34, 0.04],
  ]
  for (let i = 0; i < layout.length; i++) {
    const [x, y, size] = at(layout, i)
    const node = new THREE.Group()
    node.position.set(x, y, 0)
    const geo = led.add(new THREE.OctahedronGeometry(size))
    node.add(solidMesh(geo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(geo)), i === layout.length - 1 ? kit.edge2 : kit.edge))
    group.add(node)
    items.push({ node, start: 0.16 + i * 0.065, baseY: y, phase: i * 1.31 })
  }
  // sparse motes between the pieces
  const moteCount = 14
  const positions = new Float32Array(moteCount * 3)
  for (let i = 0; i < moteCount; i++) {
    const a = (i / moteCount) * Math.PI * 2
    const r = 0.34 + ((i * 37) % 11) * 0.012
    positions[i * 3 + 0] = Math.cos(a) * r
    positions[i * 3 + 1] = Math.sin(a * 1.3) * r * 0.7
    positions[i * 3 + 2] = 0
  }
  const moteGeo = led.add(new THREE.BufferGeometry())
  moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const motes = new THREE.Points(moteGeo, kit.spark)
  motes.frustumCulled = false
  group.add(motes)

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (const it of items) {
      const appear = pop(p, it.start, 0.2)
      const shimmer = 1 + 0.13 * Math.sin(S * 0.003 + it.phase + spec.phase)
      it.node.scale.setScalar(Math.max(appear * shimmer, 0.0001))
      it.node.position.y = it.baseY + (1 - appear) * -0.12
    }
    group.rotation.y = (p - 0.5) * 0.5
    group.rotation.x = 0.1
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** بيان — the statement's flowing sheet. */
function buildSheetFlow(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const sheetGeo = led.add(new THREE.PlaneGeometry(0.92, 0.55, 26, 12))
  // bake the flow curvature once
  const pos = sheetGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, Math.sin(x * 2.6) * 0.085 + Math.cos(y * 2.2) * 0.035)
  }
  pos.needsUpdate = true
  sheetGeo.computeVertexNormals()
  group.add(solidMesh(sheetGeo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(sheetGeo)), kit.edge))

  // ruled statement lines across the sheet
  const rules: THREE.Mesh[] = []
  const ruleY = [-0.1, 0.02, 0.14]
  for (let i = 0; i < ruleY.length; i++) {
    const geo = led.add(new THREE.BoxGeometry(0.62 - i * 0.09, 0.01, 0.008))
    const rule = solidMesh(geo, kit.fill2)
    rule.position.set(0, at(ruleY, i), 0.045)
    group.add(rule)
    rules.push(rule)
  }

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    // the sheet reads in perspective: a strong base tilt that eases
    // through the traversal — «ورقة تُقلَب مع التمرير»
    group.rotation.x = (spec.tilt ?? 0.55) + (p - 0.5) * 0.45
    group.rotation.z = 0.08
    group.rotation.y = Math.sin(S * 0.0012 + spec.phase) * 0.22
    for (let i = 0; i < rules.length; i++) {
      const rule = at(rules, i)
      rule.position.z = 0.045 + Math.sin(S * 0.0016 + i * 0.9) * 0.03
    }
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** خدمات — bento in miniature: a floating slab grid. */
function buildPanelGrid(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  group.rotation.x = 0.52
  interface Panel {
    node: THREE.Group
    start: number
    x: number
    y: number
  }
  const panels: Panel[] = []
  let n = 0
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const node = new THREE.Group()
      const x = (col - 1) * 0.3
      const y = (row - 0.5) * 0.24
      const geo = led.add(new THREE.BoxGeometry(0.25, 0.17, 0.012))
      node.add(solidMesh(geo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(geo)), n === 1 ? kit.edge2 : kit.edge))
      group.add(node)
      panels.push({ node, start: 0.14 + n * 0.07, x, y })
      n++
    }
  }

  const tick: AssemblyTick = (p, D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (let i = 0; i < panels.length; i++) {
      const pn = at(panels, i)
      const appear = pop(p, pn.start, 0.22)
      pn.node.scale.setScalar(Math.max(appear, 0.0001))
      pn.node.position.set(
        pn.x,
        pn.y + (1 - appear) * -0.3 + Math.sin(S * 0.002 + i * 0.8 + spec.phase) * 0.02,
        -0.04,
      )
    }
    group.rotation.y = D * 0.0002
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** شبكة — automation mesh: nodes, edges, travelling packets. */
function buildNodeMesh(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  let hubNode: THREE.Group | null = null
  const nodes: [number, number, number][] = [
    [0, 0, 0], // hub
    [-0.34, 0.22, 0.04],
    [0.34, 0.18, -0.04],
    [-0.28, -0.24, -0.02],
    [0.3, -0.26, 0.05],
    [0.02, 0.34, -0.03],
  ]
  for (let i = 0; i < nodes.length; i++) {
    const [x, y, z] = at(nodes, i)
    const node = new THREE.Group()
    node.position.set(x, y, z)
    const r = i === 0 ? 0.055 : 0.032
    const geo = led.add(new THREE.SphereGeometry(r, 14, 10))
    node.add(solidMesh(geo, i === 0 ? kit.fill2 : kit.fill))
    if (i === 0) {
      const haloGeo = led.add(new THREE.TorusGeometry(0.1, 0.004, 5, 48))
      node.add(solidMesh(haloGeo, kit.ring))
      hubNode = node
    }
    group.add(node)
  }
  // edges: hub spokes + two cross links
  const edgePairs: [number, number][] = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [3, 4],
  ]
  const seg: number[] = []
  for (const [a, b] of edgePairs) {
    const pa = at(nodes, a)
    const pb = at(nodes, b)
    seg.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2])
  }
  const lineGeo = led.add(new THREE.BufferGeometry())
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
  group.add(edgeLines(lineGeo, kit.edge))

  // packets travelling the edges — flow proportional to scroll distance
  interface Packet {
    mesh: THREE.Mesh
    a: [number, number, number]
    b: [number, number, number]
    phase: number
  }
  const packets: Packet[] = []
  const packetEdges: [number, number][] = [[0, 1], [0, 2], [0, 4], [0, 3]]
  for (let j = 0; j < packetEdges.length; j++) {
    const geo = led.add(new THREE.OctahedronGeometry(0.02))
    const mesh = solidMesh(geo, kit.fill2)
    group.add(mesh)
    const edge = at(packetEdges, j)
    packets.push({
      mesh,
      a: at(nodes, edge[0]),
      b: at(nodes, edge[1]),
      phase: j * 0.27,
    })
  }

  const tick: AssemblyTick = (_p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (const pk of packets) {
      const t = frac(S * 0.00032 + pk.phase)
      const mt = t < 0.5 ? t * 2 : (1 - t) * 2 // there and back — reversible
      pk.mesh.position.set(
        pk.a[0] + (pk.b[0] - pk.a[0]) * mt,
        pk.a[1] + (pk.b[1] - pk.a[1]) * mt,
        pk.a[2] + (pk.b[2] - pk.a[2]) * mt,
      )
      pk.mesh.scale.setScalar(0.8 + 0.4 * Math.sin(t * Math.PI))
    }
    if (hubNode) hubNode.scale.setScalar(1 + 0.22 * Math.sin(S * 0.004))
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** أعمال — fanned gallery frames. */
function buildGalleryFrames(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const frames: THREE.Group[] = []
  for (let i = 0; i < 3; i++) {
    const node = new THREE.Group()
    const frameGeo = led.add(new THREE.BoxGeometry(0.34, 0.24, 0.014))
    node.add(solidMesh(frameGeo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(frameGeo)), i === 1 ? kit.edge2 : kit.edge))
    const innerGeo = led.add(new THREE.PlaneGeometry(0.29, 0.19))
    const inner = solidMesh(innerGeo, kit.fill2)
    inner.position.z = 0.009
    node.add(inner)
    // one aperture dot — the exhibit's focal point
    const dotGeo = led.add(new THREE.SphereGeometry(0.014, 8, 6))
    const dot = solidMesh(dotGeo, kit.fill)
    dot.position.set(0.06, 0.05, 0.015)
    node.add(dot)
    group.add(node)
    frames.push(node)
  }

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    const open = pop(p, 0.18, 0.34) // the fan opens through the section
    for (let i = 0; i < frames.length; i++) {
      const f = at(frames, i)
      const k = i - 1
      f.rotation.z = k * (0.06 + 0.3 * open)
      f.position.set(k * 0.1 * open, k * 0.05 * open + Math.sin(S * 0.0018 + i * 1.1) * 0.02, k * 0.05 * open)
      f.scale.setScalar(Math.max(1 - Math.abs(k) * 0.14 * (1 - open * 0.4), 0.0001))
    }
    group.rotation.y = 0.12
    group.rotation.x = -0.08
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** درج — process staircase. */
function buildStaircase(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  interface Step {
    node: THREE.Group
    start: number
    x: number
    y: number
  }
  const steps: Step[] = []
  const count = 5
  for (let i = 0; i < count; i++) {
    const node = new THREE.Group()
    const x = (i - (count - 1) / 2) * 0.17
    const y = -0.24 + i * 0.115
    node.position.set(x, y, 0)
    const geo = led.add(new THREE.BoxGeometry(0.2, 0.032, 0.13))
    node.add(solidMesh(geo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(geo)), i === count - 1 ? kit.edge2 : kit.edge))
    // riser
    const riserGeo = led.add(new THREE.BoxGeometry(0.2, 0.1, 0.012))
    const riser = solidMesh(riserGeo, kit.fill)
    riser.position.set(0, -0.06, -0.06)
    node.add(riser)
    group.add(node)
    steps.push({ node, start: 0.14 + i * 0.08, x, y })
  }
  group.rotation.x = 0.34
  group.rotation.y = -0.22

  const tick: AssemblyTick = (p, D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (let i = 0; i < steps.length; i++) {
      const st = at(steps, i)
      const appear = pop(p, st.start, 0.2)
      st.node.scale.setScalar(Math.max(appear, 0.0001))
      st.node.position.set(st.x, st.y + (1 - appear) * -0.18 + Math.sin(S * 0.0014 + i * 0.7) * 0.008, 0)
    }
    group.rotation.y = -0.22 + D * 0.00022
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** عدادات — gauges sweeping with the section's progress. */
function buildDials(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const arcs: { mesh: THREE.Mesh; rate: number; base: number }[] = []
  for (let i = 0; i < 3; i++) {
    const r = 0.17 + i * 0.13
    const geo = led.add(new THREE.TorusGeometry(r, 0.011, 6, 64, Math.PI * 1.35))
    const mesh = solidMesh(geo, kit.ring)
    group.add(mesh)
    arcs.push({ mesh, rate: (i % 2 === 0 ? 1 : -1) * (1.6 + i * 0.9), base: i * 2.1 })
  }
  // hub + needle — the calculator's result sweeping in
  const hubGeo = led.add(new THREE.CircleGeometry(0.035, 24))
  group.add(solidMesh(hubGeo, kit.fill2))
  const needleGeo = led.add(new THREE.BoxGeometry(0.01, 0.3, 0.008))
  const needle = solidMesh(needleGeo, kit.fill2)
  needle.position.y = 0.13
  const needlePivot = new THREE.Group()
  needlePivot.add(needle)
  group.add(needlePivot)
  // tick marks on the outer dial
  const ticksLine: number[] = []
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5
    const r1 = 0.42
    const r2 = 0.46
    ticksLine.push(Math.cos(a) * r1, Math.sin(a) * r1, 0, Math.cos(a) * r2, Math.sin(a) * r2, 0)
  }
  const ticksGeo = led.add(new THREE.BufferGeometry())
  ticksGeo.setAttribute('position', new THREE.Float32BufferAttribute(ticksLine, 3))
  group.add(edgeLines(ticksGeo, kit.edge2))

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (const arc of arcs) arc.mesh.rotation.z = arc.base - p * arc.rate
    needlePivot.rotation.z =
      Math.PI * 0.72 - smoothstep(0.15, 0.8, p) * Math.PI * 1.44 + Math.sin(S * 0.002 + spec.phase) * 0.02
    group.rotation.x = (spec.tilt ?? 0.25) * -1
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** طبقات — the site's layers separating as you scroll. */
function buildStackedLayers(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const layers: { mesh: THREE.Mesh; lines: THREE.LineSegments; k: number }[] = []
  for (let k = 0; k < 3; k++) {
    const geo = led.add(new THREE.PlaneGeometry(0.88, 0.52))
    const mesh = solidMesh(geo, k === 1 ? kit.fill2 : kit.fill)
    const lines = edgeLines(led.add(new THREE.EdgesGeometry(geo)), k === 2 ? kit.edge2 : kit.edge)
    group.add(mesh, lines)
    layers.push({ mesh, lines, k })
  }
  // browser chrome on the middle layer
  const barGeo = led.add(new THREE.BoxGeometry(0.88, 0.045, 0.01))
  const chrome = new THREE.Group()
  chrome.add(solidMesh(barGeo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(barGeo)), kit.edge))
  for (let d = 0; d < 3; d++) {
    const dotGeo = led.add(new THREE.SphereGeometry(0.011, 8, 6))
    const dot = solidMesh(dotGeo, kit.fill2)
    dot.position.set(-0.38 + d * 0.05, 0, 0.008)
    chrome.add(dot)
  }
  chrome.position.set(0, 0.28, 0)
  group.add(chrome)

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    const sep = 0.06 + smoothstep(0.22, 0.72, p) * 0.24 // the reveal
    for (const ly of layers) {
      ly.mesh.position.set(Math.sin(S * 0.0014 + ly.k) * 0.03, 0, (ly.k - 1) * sep)
      ly.lines.position.copy(ly.mesh.position)
    }
    group.rotation.x = 0.32
    group.rotation.y = Math.sin(S * 0.0009) * 0.1
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** تروس — interlocking gears cranked by the scroll itself. */
function buildGears(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()

  function makeGear(radius: number, teeth: number): THREE.Group {
    const node = new THREE.Group()
    const cylGeo = led.add(new THREE.CylinderGeometry(radius, radius, 0.03, 36))
    cylGeo.rotateX(Math.PI / 2)
    node.add(solidMesh(cylGeo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(cylGeo)), kit.edge))
    for (let t = 0; t < teeth; t++) {
      const a = (t / teeth) * Math.PI * 2
      const toothGeo = led.add(new THREE.BoxGeometry(0.05, 0.03, 0.045))
      const tooth = solidMesh(toothGeo, kit.fill)
      tooth.position.set(Math.cos(a) * (radius + 0.02), Math.sin(a) * (radius + 0.02), 0)
      tooth.rotation.z = a
      node.add(tooth)
    }
    const hubGeo = led.add(new THREE.TorusGeometry(radius * 0.28, 0.008, 5, 32))
    node.add(solidMesh(hubGeo, kit.ring))
    // spokes
    const spokes: number[] = []
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2
      spokes.push(
        Math.cos(a) * radius * 0.3, Math.sin(a) * radius * 0.3, 0.017,
        Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86, 0.017,
      )
    }
    const spokeGeo = led.add(new THREE.BufferGeometry())
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3))
    node.add(edgeLines(spokeGeo, kit.edge2))
    return node
  }

  const g1 = makeGear(0.2, 10)
  const g2 = makeGear(0.13, 7)
  g2.position.set(0.3, 0.06, 0)
  group.add(g1, g2)

  const tick: AssemblyTick = (_p, D, _S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    g1.rotation.z = D * 0.0011
    g2.rotation.z = -D * 0.0011 * (10 / 7) + 0.31
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** رحلة — the path that draws itself, milestone by milestone. */
function buildJourneyPath(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const pts = [
    new THREE.Vector3(-0.42, -0.3, 0),
    new THREE.Vector3(-0.12, -0.05, 0.06),
    new THREE.Vector3(0.16, -0.22, -0.04),
    new THREE.Vector3(0.36, 0.12, 0.04),
    new THREE.Vector3(0.05, 0.36, 0),
  ]
  const curve = new THREE.CatmullRomCurve3(pts)
  const tubeGeo = led.add(new THREE.TubeGeometry(curve, 72, 0.014, 8, false))
  group.add(solidMesh(tubeGeo, kit.ring))
  const totalIndex = tubeGeo.index ? tubeGeo.index.count : 0

  interface Station {
    node: THREE.Group
    t: number
  }
  const stations: Station[] = []
  const stops = [0.1, 0.38, 0.64, 0.92]
  for (let i = 0; i < stops.length; i++) {
    const t = at(stops, i)
    const node = new THREE.Group()
    node.position.copy(curve.getPoint(t))
    const geo = led.add(new THREE.OctahedronGeometry(0.032))
    node.add(solidMesh(geo, i === stops.length - 1 ? kit.fill2 : kit.fill))
    const haloGeo = led.add(new THREE.TorusGeometry(0.055, 0.003, 5, 32))
    node.add(solidMesh(haloGeo, kit.ring))
    group.add(node)
    stations.push({ node, t })
  }

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    const draw = smoothstep(0.06, 0.9, p)
    if (totalIndex > 0) tubeGeo.setDrawRange(0, Math.floor(draw * totalIndex))
    for (let i = 0; i < stations.length; i++) {
      const st = at(stations, i)
      const lit = smoothstep(st.t, st.t + 0.1, draw)
      const pulse = lit > 0.5 ? 0.08 * Math.sin(S * 0.003 + i) : 0
      st.node.scale.setScalar(Math.max(0.35 + 0.65 * lit + pulse, 0.0001))
    }
    group.rotation.x = 0.3
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** منارة — beacon tower with emanating signal rings. */
function buildBeacon(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const coneGeo = led.add(new THREE.ConeGeometry(0.09, 0.3, 6))
  const cone = solidMesh(coneGeo, kit.fill)
  cone.position.y = 0.14
  const coneLines = edgeLines(led.add(new THREE.EdgesGeometry(coneGeo)), kit.edge)
  coneLines.position.y = 0.14
  const baseGeo = led.add(new THREE.CylinderGeometry(0.15, 0.19, 0.06, 24))
  const base = solidMesh(baseGeo, kit.fill)
  base.position.y = -0.16
  const baseLines = edgeLines(led.add(new THREE.EdgesGeometry(baseGeo)), kit.edge)
  baseLines.position.y = -0.16
  const lampGeo = led.add(new THREE.SphereGeometry(0.034, 12, 8))
  const lamp = solidMesh(lampGeo, kit.fill2)
  lamp.position.y = 0.31
  group.add(cone, coneLines, base, baseLines, lamp)

  interface Ring {
    mesh: THREE.Mesh
    material: THREE.MeshBasicMaterial
    phase: number
  }
  const rings: Ring[] = []
  for (let j = 0; j < 3; j++) {
    const geo = led.add(new THREE.TorusGeometry(0.14, 0.004, 5, 64))
    const material = led.add(kit.ring.clone())
    const mesh = solidMesh(geo, material)
    mesh.position.y = 0.31
    group.add(mesh)
    rings.push({ mesh, material, phase: j / 3 })
  }

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (const ring of rings) {
      const cyc = frac(p * 2.4 - ring.phase)
      ring.mesh.scale.setScalar(Math.max(0.5 + cyc * 2.4, 0.0001))
      ring.material.opacity = (1 - cyc) * 0.7 * alpha
    }
    lamp.scale.setScalar(1 + 0.3 * Math.sin(S * 0.005))
    group.rotation.y = Math.sin(S * 0.0008) * 0.3
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** أرقام — measurement bars rising with the section. */
function buildBarsRising(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  interface Bar {
    mesh: THREE.Mesh
    lines: THREE.LineSegments
    h: number
    x: number
    start: number
  }
  const bars: Bar[] = []
  const heights = [0.14, 0.24, 0.34, 0.46, 0.58]
  const baseY = -0.28
  for (let i = 0; i < heights.length; i++) {
    const h = at(heights, i)
    const geo = led.add(new THREE.BoxGeometry(0.07, 1, 0.07))
    const mesh = solidMesh(geo, i === heights.length - 1 ? kit.fill2 : kit.fill)
    const lines = edgeLines(led.add(new THREE.EdgesGeometry(geo)), i === heights.length - 1 ? kit.edge2 : kit.edge)
    const x = (i - 2) * 0.13
    mesh.position.set(x, baseY + h / 2, 0)
    mesh.scale.y = h
    lines.position.copy(mesh.position)
    lines.scale.y = h
    group.add(mesh, lines)
    bars.push({ mesh, lines, h, x, start: 0.12 + i * 0.09 })
  }
  const lineGeo = led.add(new THREE.BoxGeometry(0.74, 0.008, 0.05))
  const baseline = solidMesh(lineGeo, kit.ring)
  baseline.position.y = baseY - 0.004
  group.add(baseline)

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (let i = 0; i < bars.length; i++) {
      const bar = at(bars, i)
      const grow = pop(p, bar.start, 0.24)
      const shimmer = 1 + 0.05 * Math.sin(S * 0.002 + i * 0.9)
      const h = Math.max(bar.h * grow * shimmer, 0.001)
      bar.mesh.scale.y = h
      bar.lines.scale.y = h
      bar.mesh.position.y = baseY + h / 2
      bar.lines.position.y = baseY + h / 2
    }
    group.rotation.x = 0.18
    group.rotation.y = -0.14
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** قيم — a balanced tower of blocks. */
function buildBlockStack(led: Ledger, kit: Kit, _spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  interface Block {
    node: THREE.Group
    start: number
    y: number
    rotZ: number
  }
  const blocks: Block[] = []
  for (let i = 0; i < 4; i++) {
    const node = new THREE.Group()
    const y = -0.2 + i * 0.105
    const rotZ = (i % 2 === 0 ? 1 : -1) * 0.1
    node.position.set((i % 2 === 0 ? 1 : -1) * 0.03, y, 0)
    node.rotation.z = rotZ
    const geo = led.add(new THREE.BoxGeometry(0.36 - i * 0.03, 0.085, 0.2))
    node.add(solidMesh(geo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(geo)), i === 3 ? kit.edge2 : kit.edge))
    group.add(node)
    blocks.push({ node, start: 0.14 + i * 0.09, y, rotZ })
  }

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    for (let i = 0; i < blocks.length; i++) {
      const bl = at(blocks, i)
      const appear = pop(p, bl.start, 0.22)
      bl.node.scale.setScalar(Math.max(appear, 0.0001))
      bl.node.position.y = bl.y + (1 - appear) * -0.16
      bl.node.rotation.z = bl.rotZ + Math.sin(S * 0.0012 + i * 1.2) * 0.015
    }
  }
  return { group, tick, dispose: () => led.dispose() }
}

/** رسالة — the envelope that seals itself with the scroll. */
function buildEnvelope(led: Ledger, kit: Kit, spec: LandmarkSpec): Assembly {
  const group = new THREE.Group()
  const bodyGeo = led.add(new THREE.BoxGeometry(0.46, 0.3, 0.012))
  group.add(solidMesh(bodyGeo, kit.fill), edgeLines(led.add(new THREE.EdgesGeometry(bodyGeo)), kit.edge))

  // front V-creases (two lines from the bottom corners to the centre)
  const creasePts: number[] = []
  const cA: [number, number] = [-0.23, -0.15]
  const cB: [number, number] = [0.23, -0.15]
  const cM: [number, number] = [0, 0.0]
  creasePts.push(cA[0], cA[1], 0.008, cM[0], cM[1], 0.008)
  creasePts.push(cB[0], cB[1], 0.008, cM[0], cM[1], 0.008)
  const creaseGeo = led.add(new THREE.BufferGeometry())
  creaseGeo.setAttribute('position', new THREE.Float32BufferAttribute(creasePts, 3))
  group.add(edgeLines(creaseGeo, kit.edge))

  // the flap — a triangle hinged at the top edge, sealing with p
  const flapGeo = led.add(new THREE.BufferGeometry())
  flapGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.23, 0, 0, 0.23, 0, 0, 0, -0.26, 0], 3),
  )
  flapGeo.computeVertexNormals()
  const flap = solidMesh(flapGeo, kit.fill2)
  const flapPivot = new THREE.Group()
  flapPivot.position.y = 0.15
  flapPivot.add(flap)
  group.add(flapPivot)

  // address lines + stamp
  const l1 = led.add(new THREE.BoxGeometry(0.2, 0.012, 0.006))
  const line1 = solidMesh(l1, kit.fill2)
  line1.position.set(-0.08, -0.05, 0.01)
  const l2 = led.add(new THREE.BoxGeometry(0.14, 0.012, 0.006))
  const line2 = solidMesh(l2, kit.fill2)
  line2.position.set(-0.11, -0.09, 0.01)
  group.add(line1, line2)
  const stampGeo = led.add(new THREE.PlaneGeometry(0.07, 0.07))
  const stamp = solidMesh(stampGeo, kit.fill2)
  stamp.position.set(0.16, 0.09, 0.012)
  const stampLines = edgeLines(led.add(new THREE.EdgesGeometry(stampGeo)), kit.edge2)
  stampLines.position.copy(stamp.position)
  group.add(stamp, stampLines)

  const tick: AssemblyTick = (p, _D, S, energy, alpha) => {
    kit.setAlpha(alpha, energy)
    const seal = smoothstep(0.3, 0.75, p)
    flapPivot.rotation.x = -2.35 + seal * 2.25
    group.rotation.x = (spec.tilt ?? 0.2) + (p - 0.5) * 0.12
    group.rotation.y = Math.sin(S * 0.001 + spec.phase) * 0.12
  }
  return { group, tick, dispose: () => led.dispose() }
}

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */
const BUILDERS: Record<LandmarkKind, (led: Ledger, kit: Kit, spec: LandmarkSpec) => Assembly> = {
  orbitSystem: buildOrbitSystem,
  constellation: buildConstellation,
  sheetFlow: buildSheetFlow,
  panelGrid: buildPanelGrid,
  nodeMesh: buildNodeMesh,
  galleryFrames: buildGalleryFrames,
  staircase: buildStaircase,
  dials: buildDials,
  stackedLayers: buildStackedLayers,
  gears: buildGears,
  journeyPath: buildJourneyPath,
  beacon: buildBeacon,
  barsRising: buildBarsRising,
  blockStack: buildBlockStack,
  envelope: buildEnvelope,
}

/** Build one semantic landmark for a section. */
export function buildAssembly(spec: LandmarkSpec): Assembly {
  const led = new Ledger()
  const kit = makeKit(LANDMARK_PALETTES[spec.palette])
  led.add(kit)
  const builder = BUILDERS[spec.kind]
  if (!builder) {
    // unreachable by type; keeps the record access honest at runtime
    led.dispose()
    const empty: Assembly = { group: new THREE.Group(), tick: () => {}, dispose: () => {} }
    return empty
  }
  return builder(led, kit, spec)
}
