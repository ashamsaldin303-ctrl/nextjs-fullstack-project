'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useMemo } from 'react'
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
 */

type PresetId = 'store' | 'booking' | 'ai' | 'dashboard' | 'custom'

const PRESET_CONFIG: Record<PresetId, { count: number; colors: string[]; radius: number }> = {
  store: { count: 6, colors: ['#0071E3', '#34A853', '#FBBC05', '#EA4335', '#4285F4', '#F1F5F9'], radius: 3 },
  booking: { count: 5, colors: ['#0071E3', '#34A853', '#FBBC05', '#4285F4', '#F1F5F9'], radius: 3 },
  ai: { count: 7, colors: ['#0071E3', '#4285F4', '#34A853', '#EA4335', '#FBBC05', '#F1F5F9', '#0071E3'], radius: 3.5 },
  dashboard: { count: 6, colors: ['#0071E3', '#4285F4', '#34A853', '#FBBC05', '#EA4335', '#F1F5F9'], radius: 3 },
  custom: { count: 5, colors: ['#0071E3', '#34A853', '#FBBC05', '#4285F4', '#F1F5F9'], radius: 3.2 },
}

function Nodes({ preset, active }: { preset: PresetId; active: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const reduced = usePrefersReducedMotion()
  const config = PRESET_CONFIG[preset] ?? PRESET_CONFIG.custom

  const { positions, colors } = useMemo(() => {
    const positions: [number, number, number][] = []
    const colors: THREE.Color[] = []
    for (let i = 0; i < config.count; i++) {
      const angle = (i / config.count) * Math.PI * 2
      const r = config.radius
      positions.push([
        Math.cos(angle) * r,
        Math.sin(angle) * r * 0.6,
        Math.sin(angle * 2) * 0.5,
      ])
      colors.push(new THREE.Color(config.colors[i % config.colors.length] ?? '#0071E3'))
    }
    return { positions, colors }
  }, [config])

  useFrame((_, delta) => {
    if (!groupRef.current || !active || reduced) return
    // Slow camera drift — no user hijack
    groupRef.current.rotation.y += delta * 0.08
    groupRef.current.rotation.x += delta * 0.02
  })

  return (
    <group ref={groupRef}>
      {/* Nodes */}
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial
            color={colors[i] ?? '#0071E3'}
            emissive={colors[i] ?? '#0071E3'}
            emissiveIntensity={0.6}
            roughness={0.3}
            metalness={0.5}
          />
        </mesh>
      ))}
      {/* Connections — lines between adjacent nodes */}
      {positions.map((pos, i) => {
        const next = positions[(i + 1) % positions.length] ?? pos
        const points = [new THREE.Vector3(...pos), new THREE.Vector3(...next)]
        const geo = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <line key={`line-${i}`}>
            <primitive object={new THREE.Line(geo, new THREE.LineBasicMaterial({
              color: 0x0071E3,
              transparent: true,
              opacity: 0.3,
            }))} />
          </line>
        )
      })}
    </group>
  )
}

export function ConsoleScene({ preset }: { preset: PresetId }) {
  const reduced = usePrefersReducedMotion()

  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      dpr={[1, 2]}
      frameloop={reduced ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true }}
      style={{ position: 'absolute', inset: 0, cursor: 'grab' }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="#0071E3" />
      <pointLight position={[-5, -5, 3]} intensity={0.4} color="#34A853" />
      <Nodes preset={preset} active={true} />
    </Canvas>
  )
}
