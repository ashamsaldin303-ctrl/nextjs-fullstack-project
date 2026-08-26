'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Elyra Hero Canvas — R3F particles.
 * - ~3500 additive points on a dark #0F172A stage
 * - "breathing" sin displacement in vertex shader
 * - mouse attraction via lerp (group tilt)
 * - DPR capped at 2; frameloop paused when section offscreen or tab hidden
 * - reduced-motion / no-WebGL handled by the parent (fallback gradient)
 */

const PARTICLE_COUNT = 3500
const COLORS = [
  new THREE.Color('#0071E3'),
  new THREE.Color('#4285F4'),
  new THREE.Color('#60A5FA'),
  new THREE.Color('#F1F5F9'),
  new THREE.Color('#34A853'),
]

function Particles({ mouse }: { mouse: React.MutableRefObject<{ x: number; y: number; tx: number; ty: number }> }) {
  const pointsRef = useRef<THREE.Points>(null)
  const mouseVec = useRef(new THREE.Vector3(0, 0, 0))

  // Particle geometry is generated ONCE per mount with Math.random — an impure
  // call that React 19 only permits inside a lazy state initializer (never in
  // render body or useMemo factories). See react-hooks/purity.
  const [buffers] = useState(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const scales = new Float32Array(PARTICLE_COUNT)
    const speeds = new Float32Array(PARTICLE_COUNT)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Spread in a wide box around the camera
      const radius = 4 + Math.random() * 9
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      positions[i * 3 + 2] = radius * Math.cos(phi) * 0.5 - 2
      scales[i] = Math.random() * 1.4 + 0.4
      speeds[i] = Math.random() * 0.6 + 0.2
      const c = COLORS[Math.floor(Math.random() * COLORS.length)]
      if (!c) continue
      colors[i * 3 + 0] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, scales, speeds, colors }
  })
  const { positions, scales, speeds, colors } = buffers

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector3(0, 0, 0) },
      uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2) },
    }),
    []
  )

  useFrame((state, delta) => {
    if (!pointsRef.current) return
    // Three.js shader uniforms are mutated per-frame — the canonical R3F pattern.
    // eslint-disable-next-line react-hooks/immutability
    uniforms.uTime.value += delta

    // Lerp mouse target into the actual mouse vector (smoothing)
    mouseVec.current.x += (mouse.current.tx - mouseVec.current.x) * 0.04
    mouseVec.current.y += (mouse.current.ty - mouseVec.current.y) * 0.04
    uniforms.uMouse.value.copy(mouseVec.current)

    // Gentle group tilt toward mouse
    pointsRef.current.rotation.y += ((mouseVec.current.x * 0.25) - pointsRef.current.rotation.y) * 0.05
    pointsRef.current.rotation.x += ((mouseVec.current.y * 0.15) - pointsRef.current.rotation.x) * 0.05
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float aScale;
          attribute float aSpeed;
          attribute vec3 aColor;
          uniform float uTime;
          uniform vec3 uMouse;
          uniform float uPixelRatio;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec3 p = position;
            float t = uTime * aSpeed;
            p.x += sin(t + p.y * 0.6) * 0.22;
            p.y += cos(t * 0.8 + p.x * 0.4) * 0.22;
            p.z += sin(t * 0.5 + p.y * 0.7) * 0.12;
            // subtle attraction toward mouse plane
            p += uMouse * 0.18;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float size = aScale * uPixelRatio * (28.0 / -mv.z);
            gl_PointSize = clamp(size, 1.0, 64.0);
            vColor = aColor;
            // fade by distance
            vAlpha = clamp(1.0 - (-mv.z - 3.0) / 22.0, 0.0, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float a = smoothstep(0.5, 0.08, d);
            gl_FragColor = vec4(vColor, a * vAlpha * 0.9);
          }
        `}
      />
    </points>
  )
}

interface HeroCanvasProps {
  active: boolean
}

export function HeroCanvas({ active }: HeroCanvasProps) {
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 })
  const [glAvailable, setGlAvailable] = useState(true)

  useEffect(() => {
    // WebGL feature detection — deferred to rAF so the setState isn't synchronous
    // inside the effect body (hydration-safe + lint-compliant).
    let cancelled = false
    const id = requestAnimationFrame(() => {
      if (cancelled) return
      try {
        const test = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl')
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

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  if (!glAvailable) return null

  return (
    <div className="absolute inset-0 -z-0">
      <Canvas
        dpr={[1, 2]}
        frameloop={active ? 'always' : 'never'}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 6], fov: 70 }}
        style={{ background: 'transparent' }}
      >
        <Particles mouse={mouse} />
      </Canvas>
    </div>
  )
}
