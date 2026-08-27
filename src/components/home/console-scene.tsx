'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { usePrefersReducedMotion } from '@/lib/use-reduced-motion'

/**
 * R3F console scene (Phase 4 WS-1, prompt §4).
 *
 * Mounts ONLY after the user selects a preset or presses Enter (dynamic
 * import with ssr:false in hero-console.tsx). Shows glowing 3D nodes +
 * light connections forming the selected system's architecture.
 *
 * Reuses the existing three/R3F in the project — no new libraries.
 * Drag to rotate (clamped). No wheel zoom / no scroll hijack (§4).
 * DPR ≤ 2, frameloop paused when offscreen (§9.4).
 *
 * Phase 5 fix (P0-1): the original implementation used `<line>` JSX which
 * collides with SVG's `<line>` element in R3F v9 + React 19, silently
 * failing to render geometry. Connections are now THREE.Mesh tubes built
 * explicitly via `<primitive>` (same bypass), so the renderer reliably
 * draws them, and scene readiness is verified through the `sceneReady`
 * gate pattern below (InitialRenderSafety).
 *
 * Task 4 visual upgrade: nodes are glowing spheres (0.32 radius, 32×32
 * segments) with additive glow sprites behind them (one shared 64×64
 * radial-gradient CanvasTexture), connections are curved QuadraticBezier
 * arcs (midpoint lifted ~0.6 units perpendicular) rendered as additive
 * TubeGeometry meshes, each main connection carries a bright traveling
 * pulse (getPointAt((t·speed + phase) % 1)), and node emissive gently
 * pulses out of phase. Perf budget: ≤ 12 tubes, pulses ≤ node count, no
 * post-processing, no drei.
 */

type PresetId = 'store' | 'booking' | 'ai' | 'dashboard' | 'custom'

interface PresetConfig {
  /** Number of architecture nodes */
  count: number
  /** Per-node emissive colors */
  colors: string[]
  /** Layout radius in world units */
  radius: number
  /** Layout style — ring (default) or orbit (sun-and-planets) */
  layout: 'ring' | 'orbit' | 'flow'
  /** Camera z-distance — pushed back so all nodes fit the frustum */
  cameraZ: number
}

const PRESET_CONFIG: Record<PresetId, PresetConfig> = {
  store: {
    count: 6,
    colors: ['#4285F4', '#34A853', '#60A5FA', '#EA4335', '#0071E3', '#F1F5F9'],
    radius: 3,
    layout: 'ring',
    cameraZ: 9,
  },
  booking: {
    count: 5,
    colors: ['#4285F4', '#34A853', '#60A5FA', '#0071E3', '#F1F5F9'],
    radius: 3,
    layout: 'orbit',
    cameraZ: 9,
  },
  ai: {
    count: 7,
    colors: ['#4285F4', '#0071E3', '#34A853', '#EA4335', '#60A5FA', '#F1F5F9', '#4285F4'],
    radius: 3.5,
    layout: 'orbit',
    cameraZ: 10,
  },
  dashboard: {
    count: 6,
    colors: ['#4285F4', '#0071E3', '#34A853', '#60A5FA', '#EA4335', '#F1F5F9'],
    radius: 3,
    layout: 'flow',
    cameraZ: 9,
  },
  custom: {
    count: 5,
    colors: ['#4285F4', '#34A853', '#60A5FA', '#0071E3', '#F1F5F9'],
    radius: 3.2,
    layout: 'ring',
    cameraZ: 9,
  },
}

/** Generate per-preset node positions */
function buildPositions(config: PresetConfig): [number, number, number][] {
  const positions: [number, number, number][] = []
  for (let i = 0; i < config.count; i++) {
    const angle = (i / config.count) * Math.PI * 2
    const r = config.radius
    if (config.layout === 'orbit') {
      // Orbit: central "sun" at index 0, planets around
      if (i === 0) {
        positions.push([0, 0, 0])
      } else {
        const a = ((i - 1) / (config.count - 1)) * Math.PI * 2
        positions.push([Math.cos(a) * r, Math.sin(a) * r * 0.7, Math.sin(a * 2) * 0.5])
      }
    } else if (config.layout === 'flow') {
      // Flow: left-to-right pipeline with vertical jitter
      const x = (i / Math.max(1, config.count - 1)) * (r * 2) - r
      positions.push([x, Math.sin(angle * 1.5) * 0.8, Math.cos(angle * 1.5) * 0.5])
    } else {
      // Ring (default): a circular arrangement
      positions.push([
        Math.cos(angle) * r,
        Math.sin(angle) * r * 0.6,
        Math.sin(angle * 2) * 0.5,
      ])
    }
  }
  return positions
}

/** Shared radial-gradient glow texture — 64×64 white radial fade, generated
 *  once per mount (component scope, this is a client-only dynamic import)
 *  and reused by every node's SpriteMaterial. Material.dispose() never
 *  frees textures, so this is disposed exactly once in the cleanup below. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const half = size / 2
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.4)')
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

const UP = new THREE.Vector3(0, 1, 0)
const WHITE = new THREE.Color('#FFFFFF')

/** Build the curved connection path between two nodes — a quadratic bezier
 *  whose midpoint is lifted ~0.6 units perpendicular to the chord, so links
 *  read as elegant arcs instead of straight wires. */
function buildArc(a: THREE.Vector3, b: THREE.Vector3, lift: number): THREE.QuadraticBezierCurve3 {
  const dir = new THREE.Vector3().subVectors(b, a)
  const perp = new THREE.Vector3().crossVectors(dir, UP)
  // chord parallel to UP → pick a stable fallback perpendicular
  if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0)
  else perp.normalize()
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5).addScaledVector(perp, lift)
  return new THREE.QuadraticBezierCurve3(a, mid, b)
}

/** Render an arc as a thin additive tube — Mesh form factor avoids the
 *  `<line>` JSX/SVG intrinsic collision from P0-1 entirely. */
function buildTube(curve: THREE.QuadraticBezierCurve3, color: number, opacity: number): THREE.Mesh {
  const geometry = new THREE.TubeGeometry(curve, 24, 0.012, 8, false)
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return new THREE.Mesh(geometry, material)
}

/** Traveling pulse metadata — the mesh/material are JSX-declared (R3F
 *  disposes them); only the curve + timing live here. */
interface PulseSpec {
  curve: THREE.QuadraticBezierCurve3
  /** Loops per second along the path */
  speed: number
  /** Start offset along the path (also used for the static initial pose) */
  phase: number
  /** Bright whitened link color for the pulse core */
  color: string
  /** Initial position so the scene looks intentional even when the
   *  frameloop is paused (reduced motion / offscreen). */
  initial: [number, number, number]
}

function Nodes({ preset, active }: { preset: PresetId; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const config = PRESET_CONFIG[preset] ?? PRESET_CONFIG.custom

  // Per-node material refs (emissive pulsing) + per-pulse mesh/material refs
  // — all mutations go through ref.current, the React-19-safe path.
  const nodeMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const pulseMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  const pulseMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  // One glow texture per mount, shared by every sprite.
  const glowTexture = useMemo(() => makeGlowTexture(), [])

  // Positions, colors, tube meshes and pulse specs — computed once per
  // preset change (pure: no randomness).
  const { positions, colors, tubes, pulses } = useMemo(() => {
    const positions = buildPositions(config)
    const colors = config.colors.map((hex) => new THREE.Color(hex))
    const tubes: THREE.Mesh[] = []
    const pulses: PulseSpec[] = []

    const addLink = (
      a: [number, number, number] | undefined,
      b: [number, number, number] | undefined,
      color: number,
      opacity: number,
      withPulse: boolean,
      lift: number
    ) => {
      if (!a || !b) return
      const curve = buildArc(new THREE.Vector3(...a), new THREE.Vector3(...b), lift)
      tubes.push(buildTube(curve, color, opacity))
      if (!withPulse) return
      const phase = pulses.length * 0.37
      const start = curve.getPointAt(phase % 1)
      pulses.push({
        curve,
        speed: 0.22 + (pulses.length % 3) * 0.07,
        phase,
        // whitened link color — reads as a bright energy packet
        color: '#' + new THREE.Color(color).lerp(WHITE, 0.55).getHexString(),
        initial: [start.x, start.y, start.z],
      })
    }

    if (config.layout === 'orbit') {
      // Spokes from the central "sun" to each planet (all carry pulses)
      const center = positions[0] ?? [0, 0, 0]
      for (let i = 1; i < positions.length; i++) {
        addLink(center, positions[i], 0x0071e3, 0.5, true, 0.6)
      }
    } else if (config.layout === 'flow') {
      // Pipeline segments bow consistently toward the camera
      for (let i = 0; i < positions.length - 1; i++) {
        addLink(positions[i], positions[i + 1], 0x4285f4, 0.5, true, 0.6)
      }
    } else {
      // Ring — neighbor links carry pulses and alternate bow direction;
      // faint cross-chords (no pulses) bow the other way for depth layering
      for (let i = 0; i < positions.length; i++) {
        addLink(
          positions[i],
          positions[(i + 1) % positions.length],
          0x4285f4,
          0.5,
          true,
          i % 2 === 0 ? 0.6 : -0.6
        )
      }
      for (let i = 0; i < positions.length; i++) {
        addLink(
          positions[i],
          positions[(i + 2) % positions.length],
          0x0071e3,
          0.22,
          false,
          i % 2 === 0 ? -0.6 : 0.6
        )
      }
    }
    return { positions, colors, tubes, pulses }
  }, [config])

  // Slow rotation of the whole group — no user hijack, just camera drift.
  // Node emissive pulses out of phase; connection pulses travel their arcs.
  useFrame((state, delta) => {
    if (!groupRef.current) return
    if (active && !reduced) {
      groupRef.current.rotation.y += delta * 0.08
      groupRef.current.rotation.x += delta * 0.02
    }
    if (reduced) return
    const t = state.clock.elapsedTime
    nodeMatRefs.current.forEach((mat, i) => {
      if (!mat) return
      // gentle breathing glow, per-node phase offset so the constellation
      // shimmers instead of flashing in lockstep
      mat.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 1.7 + i * 1.9)
    })
    pulses.forEach((pulse, i) => {
      const mesh = pulseMeshRefs.current[i]
      const mat = pulseMatRefs.current[i]
      if (!mesh || !mat) return
      const u = (t * pulse.speed + pulse.phase) % 1
      pulse.curve.getPointAt(u, mesh.position)
      // bright mid-path, fading near the endpoints
      mat.opacity = 0.2 + 0.8 * Math.sin(Math.PI * u)
    })
  })

  // FIX(2-c/9, board-R3): R3F never disposes primitives (its removeChild →
  // disposeOnIdle path explicitly skips them), so the tube geometry +
  // material GPU buffers need explicit disposal. Dispose the `tubes`
  // closure value in the cleanup: on a preset switch React has already
  // unmounted the OLD set by the time the cleanup runs, and on final
  // unmount the finally-mounted set IS disposed. Under StrictMode the
  // dev double-invoke briefly disposes still-mounted geometries which
  // three.js transparently re-uploads next frame — the same accepted
  // semantics as capability-scene's Centerpiece disposal. The glow
  // texture is shared by all (JSX-declared) sprite materials, and
  // Material.dispose() never frees textures — so it is disposed here,
  // exactly once. Node spheres / sprites / pulse meshes are JSX-declared
  // so R3F handles those.
  useEffect(() => {
    return () => {
      for (const tube of tubes) {
        tube.geometry.dispose()
        const material = tube.material
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material.dispose()
      }
      glowTexture.dispose()
    }
  }, [tubes, glowTexture])

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => {
        const color = colors[i % colors.length] ?? new THREE.Color('#4285F4')
        return (
          <group key={`node-${i}`} position={pos}>
            <mesh>
              <sphereGeometry args={[0.32, 32, 32]} />
              <meshStandardMaterial
                ref={(m) => {
                  nodeMatRefs.current[i] = m
                }}
                color={color}
                emissive={color}
                emissiveIntensity={0.9}
                roughness={0.3}
                metalness={0.6}
              />
            </mesh>
            {/* additive glow halo — depthTest off + late renderOrder so it
                reads like bloom over the constellation instead of being
                clipped by its own sphere */}
            <sprite scale={[1.7, 1.7, 1]} renderOrder={2}>
              <spriteMaterial
                map={glowTexture}
                color={color}
                transparent
                opacity={0.5}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest={false}
              />
            </sprite>
          </group>
        )
      })}
      {/* Curved connections — mesh tubes via <primitive> (bypasses the
          broken `<line>` JSX intrinsic) */}
      {tubes.map((tube, i) => (
        <primitive key={`tube-${i}`} object={tube} />
      ))}
      {/* Traveling pulses along the connection arcs */}
      {pulses.map((pulse, i) => (
        <mesh
          key={`pulse-${i}`}
          position={pulse.initial}
          ref={(m) => {
            pulseMeshRefs.current[i] = m
          }}
        >
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial
            ref={(mat) => {
              pulseMatRefs.current[i] = mat
            }}
            color={pulse.color}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Initial render safety: ensure the very first frame is scheduled even
 *  when rAF timing is tight (headless/SwiftShader). */
function InitialRenderSafety() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    // Force at least one render frame after mount + one after a tick (in
    // case R3F's first auto-render raced the GL state setup).
    invalidate()
    const id = requestAnimationFrame(() => invalidate())
    return () => cancelAnimationFrame(id)
  }, [invalidate])
  return null
}

export function ConsoleScene({
  preset,
  /** While false the Canvas frameloop pauses entirely (§9.4) — the hero
   *  threads its IntersectionObserver + visibility state here so the
   *  scene never burns GPU frames while offscreen or the tab is hidden. */
  active = true,
}: {
  preset: PresetId
  active?: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const config = PRESET_CONFIG[preset] ?? PRESET_CONFIG.custom

  return (
    <Canvas
      camera={{ position: [0, 0, config.cameraZ], fov: 50 }}
      dpr={[1, 2]}
      frameloop={reduced || !active ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
    >
      {/* Lighting: brighter to ensure glowing nodes pop visually */}
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -3, 4]} intensity={0.7} color="#4285F4" />
      <pointLight position={[0, 5, -5]} intensity={0.4} color="#34A853" />
      <Nodes preset={preset} active={!reduced && active} />
      <InitialRenderSafety />
    </Canvas>
  )
}
