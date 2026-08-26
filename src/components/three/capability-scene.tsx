'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * Interactive 3D capability scene for /services/websites.
 * A metallic TorusKnot lit by 4 Google-colored point lights, with
 * mouse parallax + drag-to-rotate. Dark stage, DPR capped at 2.
 *
 * Refactor note: React 19's react-hooks/immutability rule disallows mutating
 * plain useRef objects inside useFrame. We mutate only the attached group ref
 * (group.current.rotation — a Three.js Object3D, allowed) and accumulate drag
 * deltas via event handlers (also allowed). Cursor uses state.
 */

const LIGHTS: { color: string; pos: [number, number, number] }[] = [
  { color: '#4285F4', pos: [3, 2, 4] },
  { color: '#EA4335', pos: [-3, 2, 4] },
  { color: '#FBBC05', pos: [3, -2, 2] },
  { color: '#34A853', pos: [-3, -2, 2] },
]

function Knot({ dragging }: { dragging: boolean }) {
  const group = useRef<THREE.Group>(null)
  const last = useRef({ x: 0, y: 0 })
  const mouse = useRef({ tx: 0, ty: 0 })
  // FIX(2-c/4): R3F pointer events can't be rAF-coalesced (they fire inside
  // the render loop's event pass), so throttle to ~60Hz with a timestamp
  // guard — early return when the last processed event was <16ms ago.
  const lastPointerTs = useRef(0)
  const { viewport } = useThree()

  const geo = useMemo(() => new THREE.TorusKnotGeometry(1, 0.32, 220, 32), [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E8E8ED',
        metalness: 0.85,
        roughness: 0.18,
        envMapIntensity: 1,
      }),
    []
  )

  // FIX(2-c/10): R3F does not dispose prop-passed geometry/material (only
  // JSX-declared ones) — free the GPU buffers explicitly on unmount.
  useEffect(() => {
    return () => {
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  useFrame((state, delta) => {
    if (!group.current) return
    if (!dragging) {
      // gentle auto-spin
      group.current.rotation.y += delta * 0.25
    }
    // mouse parallax (lerp position toward mouse target)
    const tx = (mouse.current.tx * viewport.width) / 4
    const ty = (mouse.current.ty * viewport.height) / 4
    group.current.position.x += (tx - group.current.position.x) * 0.04
    group.current.position.y += (ty - group.current.position.y) * 0.04
  })

  return (
    <>
      <group
        ref={group}
        onPointerDown={(e) => {
          last.current.x = e.clientX
          last.current.y = e.clientY
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          // FIX(2-c/4): ~60Hz throttle — skips the rect read + drag delta
          // math for sub-frame events. Early return BEFORE updating
          // `last` keeps drag deltas accumulation-correct.
          const now = performance.now()
          if (now - lastPointerTs.current < 16) return
          lastPointerTs.current = now
          // mutate group.current.rotation directly — Three.js Object3D, allowed
          if (group.current && dragging) {
            const dx = e.clientX - last.current.x
            const dy = e.clientY - last.current.y
            group.current.rotation.y += dx * 0.01
            group.current.rotation.x += dy * 0.01
          }
          last.current.x = e.clientX
          last.current.y = e.clientY
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.()
          if (rect) {
            mouse.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1
            mouse.current.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
          }
        }}
      >
        <mesh geometry={geo} material={mat} />
        <mesh position={[2.6, 1.2, -1]}>
          <icosahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial color="#0071E3" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-2.4, -1.4, 0.5]}>
          <octahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial color="#34A853" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[1.8, -1.8, 1.2]}>
          <dodecahedronGeometry args={[0.26, 0]} />
          <meshStandardMaterial color="#FBBC05" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </>
  )
}

/** FIX(2-c/10): context-loss guard — `preventDefault()` marks the event
 *  as handled so the browser keeps the canvas alive for a possible restore
 *  (and stops the default console error spam); we log once for diagnostics. */
function ContextLossGuard() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      console.warn('[CapabilityScene] WebGL context lost')
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl])
  return null
}

export function CapabilityScene({ active }: { active: boolean }) {
  const [glAvailable, setGlAvailable] = useState(true)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        const test =
          document.createElement('canvas').getContext('webgl2') ??
          document.createElement('canvas').getContext('webgl')
        if (!test) setGlAvailable(false)
      } catch {
        setGlAvailable(false)
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [])

  if (!glAvailable) return null

  return (
    <div
      className="absolute inset-0"
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.25} />
        {LIGHTS.map((l, i) => (
          <pointLight key={i} color={l.color} position={l.pos} intensity={28} distance={12} />
        ))}
        <Knot dragging={dragging} />
        <ContextLossGuard />
      </Canvas>
    </div>
  )
}
