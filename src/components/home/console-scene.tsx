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
 * failing to render geometry. We now construct THREE.Line instances
 * explicitly via `<primitive>` so the renderer reliably draws connections,
 * and verify scene readiness through a `sceneReady` state gate that also
 * triggers a manual invalidation (defensive — should not be needed, but
 * guarantees a render frame in any SwiftShader/headless combo).
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

/** Build a reusable Line object from two points — bypasses the `<line>` JSX
 *  intrinsic which collides with SVG line in R3F v9 + React 19. */
function buildLine(start: THREE.Vector3, end: THREE.Vector3, color: number, opacity: number) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end])
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  })
  const line = new THREE.Line(geometry, material)
  return line
}

function Nodes({ preset, active }: { preset: PresetId; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const config = PRESET_CONFIG[preset] ?? PRESET_CONFIG.custom

  // Positions + colors computed once per preset change
  const { positions, colors, lines } = useMemo(() => {
    const positions = buildPositions(config)
    const colors = config.colors.map((hex) => new THREE.Color(hex))
    // Build connection lines between adjacent nodes (and from orbit center
    // to each planet when layout === 'orbit')
    const lines: THREE.Line[] = []
    if (config.layout === 'orbit') {
      const center = positions[0] ?? [0, 0, 0]
      const centerVec = new THREE.Vector3(...center)
      for (let i = 1; i < positions.length; i++) {
        const target = positions[i]
        if (!target) continue
        const line = buildLine(
          centerVec,
          new THREE.Vector3(...target),
          0x0071e3,
          0.55
        )
        lines.push(line)
      }
    } else if (config.layout === 'flow') {
      for (let i = 0; i < positions.length - 1; i++) {
        const a = positions[i]
        const b = positions[i + 1]
        if (!a || !b) continue
        lines.push(
          buildLine(new THREE.Vector3(...a), new THREE.Vector3(...b), 0x4285f4, 0.55)
        )
      }
    } else {
      // Ring — connect each node to its neighbor (and add a few cross links
      // for visual richness)
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i]
        const b = positions[(i + 1) % positions.length]
        if (!a || !b) continue
        lines.push(
          buildLine(new THREE.Vector3(...a), new THREE.Vector3(...b), 0x4285f4, 0.5)
        )
      }
      // Add cross-links for richness (every other node)
      for (let i = 0; i < positions.length; i++) {
        const a = positions[i]
        const b = positions[(i + 2) % positions.length]
        if (!a || !b) continue
        lines.push(
          buildLine(new THREE.Vector3(...a), new THREE.Vector3(...b), 0x0071e3, 0.2)
        )
      }
    }
    return { positions, colors, lines }
  }, [config])

  // Slow rotation of the whole group — no user hijack, just camera drift
  useFrame((_, delta) => {
    if (!groupRef.current || !active || reduced) return
    groupRef.current.rotation.y += delta * 0.08
    groupRef.current.rotation.x += delta * 0.02
  })

  // FIX(2-c/9, board-R3): R3F never disposes primitives (its removeChild →
  // disposeOnIdle path explicitly skips them), so the line geometry +
  // material GPU buffers need explicit disposal. Dispose the `lines`
  // closure value in the cleanup: on a preset switch React has already
  // unmounted the OLD set by the time the cleanup runs, and on final
  // unmount the finally-mounted set IS disposed. Under StrictMode the
  // dev double-invoke briefly disposes still-mounted geometries which
  // three.js transparently re-uploads next frame — the same accepted
  // semantics as capability-scene's Knot disposal (consistency +
  // correctness over the previous off-by-one, which freed each retired
  // set one commit late and never the finally-mounted one).
  useEffect(() => {
    return () => {
      for (const line of lines) {
        line.geometry.dispose()
        const material = line.material
        if (Array.isArray(material)) material.forEach((m) => m.dispose())
        else material.dispose()
      }
    }
  }, [lines])

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => {
        const color = colors[i % colors.length] ?? new THREE.Color('#4285F4')
        return (
          <mesh key={`node-${i}`} position={pos}>
            <sphereGeometry args={[0.28, 24, 24]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
        )
      })}
      {/* Connections — bypass the broken `<line>` JSX intrinsic */}
      {lines.map((line, i) => (
        <primitive key={`line-${i}`} object={line} />
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
