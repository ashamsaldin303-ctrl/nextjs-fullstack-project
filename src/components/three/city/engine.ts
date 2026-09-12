/**
 * CITY-1 · Interactive city model — imperative Three.js engine.
 *
 * Faithful port of the authored self-contained model (upload/3D-model.html,
 * Three.js r128 + vanilla JS) to the repo's module graph (three r185):
 * same geometry, same materials, same colors, same camera choreography
 * (cinematic intro tour → free orbit), same day/night system, same landmark
 * registry. The ONLY changes are embedding adaptations:
 *
 *   · import * as THREE from 'three' (no CDN script);
 *   · every CanvasTexture used as a color map / emissiveMap / sprite map is
 *     tagged THREE.SRGBColorSpace so the r185 sRGB round-trip preserves the
 *     authored r128 appearance (r185 defaults to ColorManagement on +
 *     outputColorSpace sRGB);
 *   · hemisphere light intensities are π-compensated (0.75/0.55 → ×π): the
 *     r155 lighting unification removed the legacy π irradiance factor that
 *     hemisphere lights carried in r128 (directional lights were never
 *     π-scaled — sun 1.5 / fill 0.3 stay verbatim);
 *   · sizing from the CONTAINER via ResizeObserver (not window/innerWidth);
 *     NDC coordinates derived from the canvas rect;
 *   · wheel: preventDefault only while manual mode is on (an embedded box
 *     must not become a page-scroll dead zone) + stopPropagation so the
 *     smooth-scroll layer never races the zoom;
 *   · canvas touch-action: 'pan-y' by default (page scroll flows through in
 *     auto mode) and 'none' while manual mode is on;
 *   · the RAF loop stops/resumes through setActive() (IntersectionObserver +
 *     visibilitychange gating owned by the React section);
 *   · DOM chrome (HUD, buttons, panel, tooltip, loader, sky layers) lives in
 *     the React wrapper — the engine reports through opts.callbacks;
 *   · the engine waits for document.fonts.ready AND explicitly pulls the
 *     authored IBM Plex faces (the model's own Google Fonts stylesheet is
 *     injected idempotently; canvas fillText never triggers a webfont load
 *     by itself) — 2.2s timeout fallback, one warm-up frame, then onReady().
 *
 * Landmark display data comes from ./data.ts (18 registered nodes,
 * BC-100 … BC-117); the in-world signboards bake the authored Arabic text.
 */

import * as THREE from 'three'
import { CITY_LANDMARKS, type LandmarkSpec } from './data'

/** A registered landmark at runtime (spec + engine-assigned fields). */
export interface LandmarkRuntime extends LandmarkSpec {
  root: THREE.Group
  cx: number
  cz: number
  code: string
  sector: string
  dims: THREE.Group | null
}

/** React chrome <-> engine communication (all handlers optional). */
export interface CityEngineCallbacks {
  /** Build finished, one frame rendered, tour may begin. */
  onReady?(): void
  /** A landmark was selected / deselected (null). */
  onSelect?(landmark: LandmarkRuntime | null): void
  /**
   * Hover state + container-relative pointer position. Fired on every
   * pointer move (position tracks the pointer instantly; the hovered node
   * is resolved once per frame) and whenever the hovered node changes.
   * `landmark` is null on touch pointers (tooltip is mouse-only) and while
   * hovering the already-selected node.
   */
  onHover?(landmark: LandmarkRuntime | null, x: number, y: number): void
  /** HUD instrument strings (every 8th frame while active). */
  onHud?(camText: string, curText: string): void
  /** Night blend value (0..1, animates) + target state for icon swaps. */
  onNight?(blend: number, isNight: boolean): void
  /** Manual camera control toggled. */
  onManual?(on: boolean): void
}

export interface CityEngineOptions {
  /** Coarse-pointer / small viewports: dpr cap 1.5 + 1024px shadow map. */
  mobile?: boolean
  /** Initial active flag (RAF starts only while active; default true). */
  active?: boolean
  callbacks: CityEngineCallbacks
}

export interface CityEngine {
  /** Pause (false) / resume (true) the render loop. */
  setActive(on: boolean): void
  /** Live tier switch: pixel-ratio cap + shadow map size. */
  setMobile(on: boolean): void
  /** Toggle manual camera control (drag / wheel / pinch). */
  toggleManual(): void
  /** DIRECT manual-mode setter (immersive fullscreen auto-enables it and
   *  restores the previous state on exit — same flip semantics as the
   *  authored toggle, just without read-modify-write races). */
  setManual(on: boolean): void
  /** Toggle day ↔ night. */
  toggleNight(): void
  /** Replay the cinematic intro tour. */
  replayTour(): void
  /** Keyboard drag equivalent (arrow keys) — same deltas as drag pixels. */
  nudge(dxPx: number, dyPx: number): void
  /** Zoom by multiplicative factor (on-screen ± buttons; the SAME radius
   *  clamp the wheel/pinch path applies). factor < 1 zooms in. */
  zoomBy(factor: number): void
  /** Deselect the current landmark + reset the camera targets. */
  deselect(): void
  /** Full teardown (loop, listeners, GPU resources, canvas). */
  dispose(): void
}

// ---------------------------------------------------------------------------
// mountCityScene — shell created synchronously (renderer + camera + canvas +
// ResizeObserver); the heavy scene build happens after the fonts race inside
// buildEngine(). The returned handle forwards to the inner engine once it
// exists and no-ops safely before that.
// ---------------------------------------------------------------------------

/** The authored model's Google Faces (IBM Plex Sans Arabic + IBM Plex Mono);
 * id-keyed so remounts never double-inject the stylesheet. */
const CITY_FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap'
const CITY_FONT_LINK_ID = 'city-ibm-plex-fonts'

/**
 * Make the authored faces actually available before the build:
 * canvas `fillText` NEVER triggers a webfont load on its own, so the sign
 * baking would silently fall back to Tahoma unless the faces are pulled
 * explicitly through document.fonts.load(). Offline/CDN failure degrades
 * gracefully to the fallback faces (never blocks the 2.2s race).
 */
async function waitForCityFonts(timeoutP: Promise<void>): Promise<void> {
  if (typeof document === 'undefined') return
  try {
    if (!document.getElementById(CITY_FONT_LINK_ID)) {
      const link = document.createElement('link')
      link.id = CITY_FONT_LINK_ID
      link.rel = 'stylesheet'
      link.href = CITY_FONT_HREF
      const loaded = new Promise<void>((res) => {
        link.addEventListener('load', () => res(), { once: true })
        link.addEventListener('error', () => res(), { once: true })
      })
      document.head.appendChild(link)
      await Promise.race([loaded, timeoutP])
    }
    if (document.fonts) {
      await Promise.race([
        Promise.all([
          document.fonts.load('600 56px "IBM Plex Sans Arabic"', 'برج المدينة'),
          document.fonts.load('400 13px "IBM Plex Mono"', 'CAM 000'),
        ]),
        timeoutP,
      ])
    }
  } catch {
    /* font failure is non-fatal — sign baking falls back to Tahoma */
  }
}

export function mountCityScene(
  container: HTMLDivElement,
  opts: CityEngineOptions
): CityEngine {
  let disposed = false
  let built = false
  let engine: CityEngine | null = null
  let activeFlag = opts.active ?? true
  let mobileFlag = opts.mobile ?? false

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 700)
  camera.position.set(0, 95, 170)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileFlag ? 1.5 : 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.25

  const dom = renderer.domElement
  dom.style.display = 'block'
  dom.style.touchAction = 'pan-y' // page scroll flows through in auto mode
  dom.style.cursor = 'default'
  container.appendChild(dom)

  function onResize(): void {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h)
    camera.aspect = w / h
    // MOBILE-FS: portrait boxes (fullscreen phones) would crop the wide
    // city to a sliver at the authored vertical fov 45° — the HORIZONTAL
    // fov collapses with the aspect. Widen the vertical fov so the
    // horizontal field stays comfortable, capped at 75° so edge
    // distortion on the orbit camera stays imperceptible. Landscape /
    // embedded 16:10 boxes keep the authored 45° exactly.
    if (camera.aspect < 1) {
      const halfVTan = Math.tan((45 * Math.PI) / 360)
      camera.fov = Math.min((2 * Math.atan(halfVTan / camera.aspect) * 180) / Math.PI, 75)
    } else {
      camera.fov = 45
    }
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(onResize)
  ro.observe(container)
  onResize()

  // Font readiness race (authored safeStart + the model's Google Faces):
  // wait for the document fonts AND the authored IBM Plex faces (canvas
  // fillText never triggers a webfont load on its own), never longer than
  // 2.2s, then build everything, render one frame and report readiness —
  // the React loader fades out ~700ms after that.
  void (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutP = new Promise<void>((res) => {
      timer = setTimeout(res, 2200)
    })
    const fontsReady: Promise<unknown> =
      typeof document !== 'undefined' && document.fonts
        ? document.fonts.ready.catch(() => undefined)
        : Promise.resolve()
    try {
      await Promise.race([
        Promise.all([fontsReady, waitForCityFonts(timeoutP)]),
        timeoutP,
      ])
    } catch {
      /* fonts rejected — proceed with fallback faces */
    }
    if (timer !== undefined) clearTimeout(timer)
    if (disposed) return
    engine = buildEngine(renderer, camera, scene, opts, mobileFlag, activeFlag)
    built = true
  })()

  return {
    setActive(on: boolean) {
      activeFlag = on
      engine?.setActive(on)
    },
    setMobile(on: boolean) {
      mobileFlag = on
      engine?.setMobile(on)
    },
    toggleManual() {
      engine?.toggleManual()
    },
    setManual(on: boolean) {
      engine?.setManual(on)
    },
    toggleNight() {
      engine?.toggleNight()
    },
    replayTour() {
      engine?.replayTour()
    },
    nudge(dxPx: number, dyPx: number) {
      engine?.nudge(dxPx, dyPx)
    },
    zoomBy(factor: number) {
      engine?.zoomBy(factor)
    },
    deselect() {
      engine?.deselect()
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (built && engine) {
        engine.dispose() // loop + canvas listeners + GPU resources
      }
      ro.disconnect()
      dom.remove()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

// ---------------------------------------------------------------------------
// buildEngine — the full authored init() body: scene setup through the
// animation loop. Renderer / camera are owned by the shell above.
// ---------------------------------------------------------------------------

function buildEngine(
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  opts: CityEngineOptions,
  mobile: boolean,
  active: boolean
): CityEngine {
  const cb = opts.callbacks
  const dom = renderer.domElement
  const MAX_ANISO = renderer.capabilities.getMaxAnisotropy()
  // Base canvas textures whose clones (not the bases) reach materials —
  // disposed explicitly in teardown after the scene traverse.
  const baseTextures: THREE.Texture[] = []

  // ============================================
  // 1) Scene + lights
  // ============================================
  // r128→r185 lighting-unification migration (three r155 removed the legacy
  // lights mode): the legacy shader multiplied hemisphere irradiance by π to
  // cancel BRDF_Lambert's 1/π, so the same numeric intensity now renders π×
  // dimmer. Compensate on the hemisphere endpoints only — directional lights
  // were NEVER π-scaled in r128 (verified against both versions'
  // lights_pars_begin sources), so sun/fill keep the authored 1.5/0.3.
  const HEMI_DAY = 0.75 * Math.PI
  const HEMI_NIGHT = 0.55 * Math.PI

  const fog = new THREE.Fog(0xe6ebe2, 190, 520)
  scene.fog = fog

  const hemi = new THREE.HemisphereLight(0xdfeaf2, 0xb2a893, HEMI_DAY)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.5)
  sun.position.set(95, 135, 70)
  sun.castShadow = true
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048)
  sun.shadow.camera.left = -150
  sun.shadow.camera.right = 150
  sun.shadow.camera.top = 150
  sun.shadow.camera.bottom = -150
  sun.shadow.camera.near = 30
  sun.shadow.camera.far = 430
  sun.shadow.bias = -0.0005
  sun.shadow.radius = 3
  sun.shadow.normalBias = 0.04
  scene.add(sun)
  const fillLight = new THREE.DirectionalLight(0xcfe0f0, 0.3)
  fillLight.position.set(-90, 70, -80)
  scene.add(fillLight)

  const sunDayC = new THREE.Color(0xfff1dc), sunNightC = new THREE.Color(0x9fb8dd)
  const hemiDayC = new THREE.Color(0xdfeaf2), hemiNightC = new THREE.Color(0x33415e)
  const gDayC = new THREE.Color(0xb2a893), gNightC = new THREE.Color(0x14161c)
  const fogDayC = new THREE.Color(0xe6ebe2), fogNightC = new THREE.Color(0x0c1420)

  // ============================================
  // 2) Generated textures
  // ============================================
  function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  function ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D {
    return cv.getContext('2d') as CanvasRenderingContext2D
  }
  function shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.max(0, Math.min(255, (n >> 16) + amt))
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
    const b = Math.max(0, Math.min(255, (n & 255) + amt))
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  }
  function finalTex(cv: HTMLCanvasElement): THREE.CanvasTexture {
    const tex = new THREE.CanvasTexture(cv)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.anisotropy = MAX_ANISO
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  /** Clone a base texture with per-face repeat + sRGB tag preserved. */
  function cloneTex(src: THREE.Texture, rx: number, ry: number): THREE.Texture {
    const t = src.clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = MAX_ANISO
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(rx, ry)
    return t
  }

  interface FacadeStyle {
    base: string
    roof: number
    glass?: boolean
  }
  /** The authored facade style keys (A–E + glass G). */
  type FacadeKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'G'
  const FACADE_STYLES: Record<FacadeKey, FacadeStyle> = {
    A: { base: '#d9d4c9', roof: 0x9b968a },
    B: { base: '#e3d6bb', roof: 0xa89a7d },
    C: { base: '#d2b29a', roof: 0x9a7f6a },
    D: { base: '#c6cfd4', roof: 0x8f9aa1 },
    E: { base: '#ede9de', roof: 0xb5b1a6 },
    G: { base: '#7ea2ba', roof: 0x5c6d7a, glass: true },
  }
  function facadePair(st: FacadeStyle): { day: THREE.CanvasTexture; emit: THREE.CanvasTexture } {
    const S = 512, cell = 128
    const cvD = makeCanvas(S, S), ctxD = ctx2d(cvD)
    const cvE = makeCanvas(S, S), ctxE = ctx2d(cvE)
    ctxD.fillStyle = st.base
    ctxD.fillRect(0, 0, S, S)
    ctxE.fillStyle = '#000'
    ctxE.fillRect(0, 0, S, S)
    for (let p = 0; p < 46; p++) {
      ctxD.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.03).toFixed(3) + ')'
      ctxD.fillRect(Math.random() * S, Math.random() * S, 30 + Math.random() * 70, 18 + Math.random() * 40)
    }
    const warmLights = ['#ffdf96', '#f5cd74', '#e9bc58', '#fff0c0']
    const coolLights = ['#cdd9e8', '#ffd98c', '#f2c46a', '#e8b455']
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 4; col++) {
        const x0 = col * cell, y0 = row * cell
        if (st.glass) {
          const g = ctxD.createLinearGradient(0, y0 + 20, 0, y0 + 108)
          g.addColorStop(0, '#7fb0cc')
          g.addColorStop(0.55, '#3f6787')
          g.addColorStop(1, '#2c4a63')
          ctxD.fillStyle = g
          ctxD.fillRect(x0 + 7, y0 + 20, 114, 88)
          if ((row + col) % 3 === 0) {
            ctxD.fillStyle = 'rgba(255,255,255,0.09)'
            ctxD.fillRect(x0 + 7, y0 + 20, 114, 88)
          }
          ctxD.fillStyle = shade(st.base, -26)
          ctxD.fillRect(x0, y0 + 8, cell, 12)
          ctxD.fillStyle = 'rgba(18,28,38,0.85)'
          ctxD.fillRect(x0, y0 + 116, cell, 12)
          if (Math.random() < 0.5) {
            ctxE.fillStyle = pick(coolLights, Math.floor(Math.random() * 4))
            ctxE.fillRect(x0 + 7, y0 + 20, 114, 88)
          }
        } else {
          const winC = pick(['#3d5570', '#87a4b8', '#54718c', '#2f4a63'] as const, Math.floor(Math.random() * 4))
          ctxD.fillStyle = shade(st.base, -18)
          ctxD.fillRect(x0 + 26, y0 + 30, 76, 62)
          ctxD.fillStyle = winC
          ctxD.fillRect(x0 + 30, y0 + 34, 68, 54)
          ctxD.fillStyle = 'rgba(255,255,255,0.16)'
          ctxD.fillRect(x0 + 30, y0 + 34, 68, 12)
          ctxD.fillStyle = 'rgba(0,0,0,0.28)'
          ctxD.fillRect(x0 + 62, y0 + 34, 4, 54)
          ctxD.fillStyle = shade(st.base, -26)
          ctxD.fillRect(x0 + 24, y0 + 92, 80, 8)
          ctxD.fillStyle = shade(st.base, -12)
          ctxD.fillRect(x0, y0 + 114, cell, 10)
          if (Math.random() < 0.62) {
            ctxE.fillStyle = pick(warmLights, Math.floor(Math.random() * 4))
            ctxE.fillRect(x0 + 30, y0 + 34, 68, 54)
            ctxE.fillStyle = '#000'
            ctxE.fillRect(x0 + 62, y0 + 34, 4, 54)
          }
        }
      }
    return { day: finalTex(cvD), emit: finalTex(cvE) }
  }
  // Populated by the style loop below before any consumer reads them.
  const FACADE_TEX = {} as Record<FacadeKey, THREE.CanvasTexture>
  const FACADE_EMIT = {} as Record<FacadeKey, THREE.CanvasTexture>
  ;(Object.keys(FACADE_STYLES) as FacadeKey[]).forEach(function (k) {
    const pair = facadePair(FACADE_STYLES[k])
    FACADE_TEX[k] = pair.day
    FACADE_EMIT[k] = pair.emit
    baseTextures.push(pair.day, pair.emit)
  })

  function asphaltCanvas(): HTMLCanvasElement {
    const cv = makeCanvas(256, 256), ctx = ctx2d(cv)
    ctx.fillStyle = '#575c62'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = (i % 2 ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (0.02 + Math.random() * 0.06).toFixed(3) + ')'
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 3)
    }
    for (let c2 = 0; c2 < 16; c2++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      let x = Math.random() * 256, y = Math.random() * 256
      ctx.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        x += (Math.random() - 0.5) * 40
        y += (Math.random() - 0.5) * 40
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    return cv
  }
  const asphCv = asphaltCanvas()
  function asphMat(len: number, w: number): THREE.MeshPhongMaterial {
    const t = new THREE.CanvasTexture(asphCv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = MAX_ANISO
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(len / 7, w / 7)
    return new THREE.MeshPhongMaterial({ map: t, shininess: 4 })
  }
  function pavementTexture(): THREE.CanvasTexture {
    const cv = makeCanvas(256, 256), ctx = ctx2d(cv)
    ctx.fillStyle = '#c8c3b9'
    ctx.fillRect(0, 0, 256, 256)
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05).toFixed(3) + ')'
        ctx.fillRect(tx * 128, ty * 128, 128, 128)
        ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05).toFixed(3) + ')'
        ctx.fillRect(tx * 128 + 4, ty * 128 + 4, 60, 60)
      }
    ctx.strokeStyle = '#a9a49a'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0.5)
    ctx.lineTo(256, 0.5)
    ctx.moveTo(0, 128)
    ctx.lineTo(256, 128)
    ctx.moveTo(0.5, 0)
    ctx.lineTo(0.5, 256)
    ctx.moveTo(128, 0)
    ctx.lineTo(128, 256)
    ctx.stroke()
    return finalTex(cv)
  }
  function grassTexture(): THREE.CanvasTexture {
    const cv = makeCanvas(256, 256), ctx = ctx2d(cv)
    ctx.fillStyle = '#87a15b'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 850; i++) {
      ctx.fillStyle = pick(['#75924b', '#97b06a', '#6d8a45', '#8fae63'] as const, i)
      ctx.globalAlpha = 0.35 + Math.random() * 0.3
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 1 + Math.random() * 2)
    }
    ctx.globalAlpha = 0.06
    for (let b = 0; b < 6; b++) {
      ctx.fillStyle = '#d9e4b8'
      ctx.beginPath()
      ctx.arc(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 26, 0, 6.28)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    return finalTex(cv)
  }
  function pathTexture(): THREE.CanvasTexture {
    const cv = makeCanvas(128, 128), ctx = ctx2d(cv)
    ctx.fillStyle = '#d6d1c6'
    ctx.fillRect(0, 0, 128, 128)
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * 16
      for (let c2 = 0; c2 < 2; c2++) {
        ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.06).toFixed(3) + ')'
        ctx.fillRect(c2 * 32 + off - 32, row * 32, 32, 32)
      }
    }
    ctx.strokeStyle = '#b9b3a7'
    ctx.lineWidth = 2
    for (let row2 = 0; row2 <= 4; row2++) {
      ctx.beginPath()
      ctx.moveTo(0, row2 * 32)
      ctx.lineTo(128, row2 * 32)
      ctx.stroke()
    }
    return finalTex(cv)
  }
  function radialTex(size: number, stops: [number, string][]): THREE.CanvasTexture {
    const cv = makeCanvas(size, size), ctx = ctx2d(cv)
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    stops.forEach(function (s) {
      g.addColorStop(s[0], s[1])
    })
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }
  const glowTex = radialTex(64, [
    [0, 'rgba(215,235,255,1)'],
    [0.35, 'rgba(170,205,255,0.55)'],
    [1, 'rgba(150,190,255,0)'],
  ])
  const spotTex = radialTex(128, [
    [0, 'rgba(255,226,165,0.55)'],
    [0.5, 'rgba(255,214,140,0.22)'],
    [1, 'rgba(255,205,120,0)'],
  ])
  const cloudTex = radialTex(128, [
    [0, 'rgba(255,255,255,0.85)'],
    [0.45, 'rgba(250,252,255,0.4)'],
    [1, 'rgba(255,255,255,0)'],
  ])
  const awningCv = makeCanvas(64, 64), awnCtx = ctx2d(awningCv)
  for (let ai = 0; ai < 8; ai++) {
    awnCtx.fillStyle = ai % 2 ? '#f0ede4' : '#2e4d68'
    awnCtx.fillRect(ai * 8, 0, 8, 64)
  }
  const awningTex = finalTex(awningCv)
  awningTex.repeat.set(2, 1)

  const paveTex = pavementTexture(),
    grassTex = grassTexture(),
    pathTex = pathTexture()
  baseTextures.push(paveTex, grassTex, pathTex)

  // ============================================
  // 3) Materials
  // ============================================
  const matTrunk = new THREE.MeshPhongMaterial({ color: 0x7a5a40, shininess: 3 })
  const matLeaf1 = new THREE.MeshPhongMaterial({ color: 0x53803c, shininess: 2, flatShading: true })
  const matLeaf2 = new THREE.MeshPhongMaterial({ color: 0x69984a, shininess: 2, flatShading: true })
  const matRock = new THREE.MeshPhongMaterial({ color: 0x8a8d90, shininess: 4, flatShading: true })
  const matStone = new THREE.MeshPhongMaterial({ color: 0xbab4a8, shininess: 5 })
  const matStoneLt = new THREE.MeshPhongMaterial({ color: 0xddd8cf, shininess: 5 })
  const matPost = new THREE.MeshPhongMaterial({ color: 0x3f464d, shininess: 10 })
  const matLampHead = new THREE.MeshBasicMaterial({ color: 0xf6f2df })
  const matGlass = new THREE.MeshPhongMaterial({
    color: 0xa8c4d6,
    transparent: true,
    opacity: 0.42,
    shininess: 120,
    specular: 0xffffff,
    side: THREE.DoubleSide,
  })
  const matGlassDk = new THREE.MeshPhongMaterial({
    color: 0x2c3e4c,
    transparent: true,
    opacity: 0.92,
    shininess: 90,
    specular: 0x99bbcc,
    emissive: new THREE.Color(0xc9944a),
    emissiveIntensity: 0,
  })
  const matWater = new THREE.MeshPhongMaterial({
    color: 0x4f8bb0,
    transparent: true,
    opacity: 0.88,
    shininess: 160,
    specular: 0xffffff,
  })
  const matWood = new THREE.MeshPhongMaterial({ color: 0x8a6a4e, shininess: 4 })
  const matHeli = new THREE.MeshPhongMaterial({ color: 0x3f4850, shininess: 4 })
  const matWhite = new THREE.MeshPhongMaterial({ color: 0xf2f2ec, shininess: 8 })
  const matTrainB = new THREE.MeshPhongMaterial({ color: 0xeef0f1, shininess: 50, specular: 0x8899aa })
  const matTrainS = new THREE.MeshPhongMaterial({ color: 0x2b4a6b, shininess: 60 })
  const matTrainW = new THREE.MeshPhongMaterial({
    color: 0x27333d,
    shininess: 90,
    specular: 0x9ab0c0,
    emissive: new THREE.Color(0xd9a84e),
    emissiveIntensity: 0,
  })
  const matRail = new THREE.MeshPhongMaterial({ color: 0x4a5057, shininess: 40 })
  const matChimney = new THREE.MeshPhongMaterial({ color: 0x9c6e57, shininess: 3 })
  const matTank = new THREE.MeshPhongMaterial({ color: 0xc2c6c9, shininess: 80, specular: 0xffffff })
  const matWare = new THREE.MeshPhongMaterial({ color: 0xc9c2b4, shininess: 3 })
  const matFlag = new THREE.MeshPhongMaterial({ color: 0xa33b32, shininess: 3, side: THREE.DoubleSide })
  const matOrange = new THREE.MeshPhongMaterial({ color: 0xc96b2a, shininess: 20 })
  const matCross = new THREE.MeshBasicMaterial({ color: 0xf4f4ef })
  const matLine = new THREE.LineBasicMaterial({ color: 0xf4f4ef, transparent: true, opacity: 0.85 })
  const matDashW = new THREE.LineDashedMaterial({
    color: 0xf4f4ef,
    dashSize: 1.8,
    gapSize: 1.7,
    transparent: true,
    opacity: 0.85,
  })
  const matFence = new THREE.LineDashedMaterial({
    color: 0x3c4248,
    dashSize: 0.7,
    gapSize: 0.5,
    transparent: true,
    opacity: 0.8,
  })
  const matCrowd = new THREE.PointsMaterial({
    color: 0x39475a,
    size: 0.55,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const matSpray = new THREE.PointsMaterial({
    color: 0xd9e8ef,
    size: 0.3,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const matFlow = new THREE.PointsMaterial({
    color: 0xbfe4f2,
    size: 0.6,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  })
  const matCarHead = new THREE.MeshBasicMaterial({ color: 0xfff6d8 })
  const matCarTail = new THREE.MeshBasicMaterial({ color: 0xb03028 })
  const matFieldA = new THREE.MeshPhongMaterial({ color: 0xc4bc66, shininess: 2 })
  const matFieldB = new THREE.MeshPhongMaterial({ color: 0xa8b058, shininess: 2 })

  const matDim = new THREE.LineBasicMaterial({ color: 0xd9862c, transparent: true, opacity: 1 })
  const matDimExt = new THREE.LineDashedMaterial({
    color: 0xb9721e,
    dashSize: 0.5,
    gapSize: 0.3,
    transparent: true,
    opacity: 0.75,
  })
  const matRing = new THREE.MeshBasicMaterial({
    color: 0xe0912f,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  })
  const matHoverBox = new THREE.LineBasicMaterial({ color: 0xe0912f, transparent: true, opacity: 0.8 })
  const matSelBox = new THREE.LineBasicMaterial({ color: 0xc0721c, transparent: true, opacity: 1 })

  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const spotMat = new THREE.MeshBasicMaterial({
    map: spotTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false })

  // ============================================
  // 4) Build tools
  // ============================================
  function v(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, z)
  }
  function L(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
  function sm(p: number): number {
    return p * p * (3 - 2 * p)
  }
  function clamp(x: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, x))
  }
  /** Modulo-wrapped total index pick for the authored fixed tables. */
  function pick<T>(arr: readonly T[], i: number): T {
    const v = arr[i % arr.length]
    if (v === undefined) throw new Error('city: pick on empty table')
    return v
  }

  const facadeMats: THREE.MeshPhongMaterial[] = []
  function solidBox(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    cast?: boolean
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.castShadow = cast !== false
    m.receiveShadow = true
    m.position.set(x, y, z)
    return m
  }
  function solidCyl(
    rt: number,
    rb: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    seg?: number
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 18), mat)
    m.castShadow = true
    m.receiveShadow = true
    m.position.set(x, y, z)
    return m
  }
  function bldg(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    styleKey: FacadeKey,
    opts?: { parapet?: boolean; ac?: boolean }
  ): THREE.Group {
    const st: FacadeStyle = FACADE_STYLES[styleKey]
    function sideMat(span: number): THREE.MeshPhongMaterial {
      const rx = Math.max(1, Math.floor(span / 10)),
        ry = Math.max(1, Math.floor(h / 12))
      const t = cloneTex(FACADE_TEX[styleKey], rx, ry)
      const em = cloneTex(FACADE_EMIT[styleKey], rx, ry)
      const m = new THREE.MeshPhongMaterial({
        map: t,
        emissiveMap: em,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0,
        shininess: st.glass ? 60 : 8,
        specular: st.glass ? 0xaabbcc : 0x333333,
      })
      facadeMats.push(m)
      return m
    }
    const mD = sideMat(d),
      mW = sideMat(w)
    const roof = new THREE.MeshPhongMaterial({ color: st.roof, shininess: 4 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mD, mD, roof, roof, mW, mW])
    mesh.castShadow = mesh.receiveShadow = true
    mesh.position.set(x, y, z)
    const g = new THREE.Group()
    g.add(mesh)
    if (!opts || opts.parapet !== false) {
      const ph = 0.45,
        pw = 0.32,
        top = y + h / 2 - ph / 2
      g.add(solidBox(w + 0.24, ph, pw, 0, top, d / 2, roof))
      g.add(solidBox(w + 0.24, ph, pw, 0, top, -d / 2, roof))
      g.add(solidBox(pw, ph, d + 0.24, w / 2, top, 0, roof))
      g.add(solidBox(pw, ph, d + 0.24, -w / 2, top, 0, roof))
    }
    if (opts && opts.ac) {
      const acMat = new THREE.MeshPhongMaterial({ color: 0x9aa1a7, shininess: 20 })
      g.add(solidBox(1.1, 0.7, 0.9, w * 0.22, y + h / 2 + 0.35, d * 0.15, acMat))
      g.add(solidBox(0.8, 0.55, 0.8, -w * 0.25, y + h / 2 + 0.28, -d * 0.18, acMat))
    }
    return g
  }
  const LEAF_BIG = new THREE.IcosahedronGeometry(1.15, 0)
  const LEAF_SM = new THREE.IcosahedronGeometry(0.78, 0)
  function tree(parent: THREE.Object3D, x: number, z: number, s?: number, alt?: boolean, yBase?: number): void {
    const g = new THREE.Group()
    g.add(solidCyl(0.13, 0.2, 1.9, 0, 0.95, 0, matTrunk, 8))
    const l1 = new THREE.Mesh(LEAF_BIG, alt ? matLeaf2 : matLeaf1)
    l1.castShadow = l1.receiveShadow = true
    l1.position.y = 2.45
    const l2 = new THREE.Mesh(LEAF_SM, alt ? matLeaf1 : matLeaf2)
    l2.castShadow = l2.receiveShadow = true
    l2.position.y = 3.45
    g.add(l1)
    g.add(l2)
    g.position.set(x, yBase || 0, z)
    g.scale.setScalar(s || 1)
    parent.add(g)
  }
  function lamp(parent: THREE.Object3D, x: number, z: number, dx: number, dz: number): void {
    const g = new THREE.Group()
    g.add(solidCyl(0.06, 0.09, 4.2, 0, 2.1, 0, matPost, 8))
    g.add(solidBox(0.95, 0.08, 0.12, dx * 0.5, 4.16, dz * 0.5, matPost, false))
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), matLampHead)
    head.position.set(dx * 0.95, 4.1, dz * 0.95)
    g.add(head)
    const glow = new THREE.Sprite(glowMat)
    glow.scale.set(2.4, 2.4, 1)
    glow.position.set(dx * 0.95, 4.1, dz * 0.95)
    g.add(glow)
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), spotMat)
    spot.rotation.x = -Math.PI / 2
    spot.position.set(dx * 1.6, 0.3, dz * 1.6)
    g.add(spot)
    g.position.set(x, 0, z)
    parent.add(g)
  }
  function bench(parent: THREE.Object3D, x: number, z: number, rotY?: number): void {
    const g = new THREE.Group()
    g.add(solidBox(1.8, 0.1, 0.5, 0, 0.55, 0, matWood))
    g.add(solidBox(1.8, 0.45, 0.08, 0, 0.9, -0.24, matWood))
    g.add(solidBox(0.12, 0.55, 0.45, -0.72, 0.28, 0, matPost, false))
    g.add(solidBox(0.12, 0.55, 0.45, 0.72, 0.28, 0, matPost, false))
    g.position.set(x, 0, z)
    g.rotation.y = rotY || 0
    parent.add(g)
  }
  function signBoard(parent: THREE.Object3D, text: string, x: number, z: number, rotY?: number, w?: number): void {
    const bw = w || 3.4
    const cv = makeCanvas(512, 128), ctx = ctx2d(cv)
    ctx.fillStyle = '#f2f0e9'
    ctx.fillRect(0, 0, 512, 128)
    ctx.strokeStyle = '#3a424b'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, 500, 116)
    ctx.fillStyle = '#2c343d'
    ctx.font = '600 56px "IBM Plex Sans Arabic", Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 68)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(bw, bw * 0.25),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    )
    board.position.y = 1.55
    const g = new THREE.Group()
    g.add(solidCyl(0.05, 0.05, 1.7, -(bw / 2 - 0.3), 0.85, 0, matPost, 8))
    g.add(solidCyl(0.05, 0.05, 1.7, bw / 2 - 0.3, 0.85, 0, matPost, 8))
    g.add(board)
    g.position.set(x, 0, z)
    g.rotation.y = rotY || 0
    parent.add(g)
  }
  function wallSign(
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rotY?: number,
    bg?: string,
    fg?: string
  ): THREE.Mesh {
    const cv = makeCanvas(512, 128), ctx = ctx2d(cv)
    ctx.fillStyle = bg || '#3a424b'
    ctx.fillRect(0, 0, 512, 128)
    ctx.fillStyle = fg || '#f2f5f7'
    ctx.font = '600 58px "IBM Plex Sans Arabic", Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 256, 68)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    )
    m.position.set(x, y, z)
    m.rotation.y = rotY || 0
    return m
  }
  function streetSign(parent: THREE.Object3D, text: string, x: number, z: number, rotY?: number): void {
    const g = new THREE.Group()
    g.add(solidCyl(0.06, 0.06, 2.8, 0, 1.4, 0, matPost, 8))
    const cv = makeCanvas(360, 100), ctx = ctx2d(cv)
    ctx.fillStyle = '#24527e'
    ctx.fillRect(0, 0, 360, 100)
    ctx.strokeStyle = '#f2f5f7'
    ctx.lineWidth = 5
    ctx.strokeRect(4, 4, 352, 92)
    ctx.fillStyle = '#f2f5f7'
    ctx.font = '600 46px "IBM Plex Sans Arabic", Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 180, 54)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.72),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    )
    m.position.y = 2.35
    g.add(m)
    g.position.set(x, 0, z)
    g.rotation.y = rotY || 0
    parent.add(g)
  }
  function trafficLight(x: number, z: number, rotY?: number): void {
    const g = new THREE.Group()
    g.add(solidCyl(0.08, 0.1, 3.4, 0, 1.7, 0, matPost, 8))
    g.add(solidBox(0.4, 1.05, 0.35, 0, 3.8, 0, matPost))
    const bulbs: [number, number][] = [
      [0.35, 0xb04040],
      [0, 0xd8a23a],
      [-0.35, 0x4a8f4a],
    ]
    bulbs.forEach(function (s) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: s[1] }))
      b.position.set(0, s[0] + 3.8, 0.2)
      g.add(b)
    })
    g.position.set(x, 0, z)
    g.rotation.y = rotY || 0
    city.add(g)
  }
  function crossPlane(w: number, d: number, x: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), matCross)
    m.rotation.x = -Math.PI / 2
    m.position.set(x, 0.24, z)
    return m
  }
  function markLine(p1: THREE.Vector3, p2: THREE.Vector3, mat: THREE.Material, dashed?: boolean): THREE.Line {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), mat)
    if (dashed) l.computeLineDistances()
    return l
  }
  const crowds: THREE.Points[] = []
  function makeCrowd(parent: THREE.Object3D, n: number, gen: () => [number, number, number]): THREE.Points {
    const pos: number[] = [],
      ph: number[] = []
    for (let i = 0; i < n; i++) {
      const p = gen()
      pos.push(p[0], p[1], p[2])
      ph.push(Math.random() * 6.28)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, matCrowd)
    pts.userData = { ph: ph, y0: pos[1] }
    parent.add(pts)
    crowds.push(pts)
    return pts
  }

  // ============================================
  // 5) Terrain: plain + hills + mountains + river valley + lake + fields
  // ============================================
  const city = new THREE.Group()
  scene.add(city)

  const RIVER_PTS: [number, number][] = [
    [-148, 195], [-136, 148], [-133, 95], [-137, 40], [-131, -20], [-134, -80],
    [-122, -128], [-96, -163], [-62, -186], [-20, -199], [30, -200], [80, -192],
    [112, -182], [140, -170],
  ]
  const LAKE = { x: 140, z: -170, r: 22 }
  function riverDist(x: number, z: number): number {
    let best = 1e9
    for (let i = 0; i < RIVER_PTS.length - 1; i++) {
      const a = RIVER_PTS[i]
      const b = RIVER_PTS[i + 1]
      if (a === undefined || b === undefined) continue
      const ax = a[0],
        az = a[1]
      const dx = b[0] - ax,
        dz = b[1] - az
      const L2 = dx * dx + dz * dz
      const tt = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1)
      const d = Math.hypot(x - (ax + dx * tt), z - (az + dz * tt))
      if (d < best) best = d
    }
    return best
  }
  const FIELD_SEGS: [[number, number], [number, number], number][] = []
  ;[5, 37, 330].forEach(function (deg) {
    const a = (deg * Math.PI) / 180
    const c = Math.cos(a), s = Math.sin(a)
    const cx = c * 130, cz = s * 130
    FIELD_SEGS.push([[cx + -s * 24, cz + c * 24], [cx - -s * 24, cz - c * 24], a])
  })
  function fieldDist(x: number, z: number): number {
    let best = 1e9
    for (const f of FIELD_SEGS) {
      const ax = f[0][0], az = f[0][1], bx = f[1][0], bz = f[1][1]
      const dx = bx - ax, dz = bz - az
      const L2 = dx * dx + dz * dz
      const tt = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1)
      const d = Math.hypot(x - (ax + dx * tt), z - (az + dz * tt))
      if (d < best) best = d
    }
    return best
  }
  function terrainH(x: number, z: number): number {
    const r = Math.sqrt(x * x + z * z)
    const plain = clamp((r - 118) / 50, 0, 1) // grassy plain
    const hills = clamp((r - 165) / 60, 0, 1) // hills
    const mtn = clamp((r - 215) / 75, 0, 1) // mountains
    let h = plain * 2.2 + hills * 10 + mtn * mtn * 40
    const n =
      Math.sin(x * 0.016) * Math.cos(z * 0.014) * 4 +
      Math.sin(x * 0.037 + 2.1) * Math.sin(z * 0.031 + 1.3) * 2.5 +
      Math.sin((x + z) * 0.009 + 0.7) * 3.5
    h += n * (plain * 0.25 + hills * 0.7 + mtn * 1.1)
    h += mtn * Math.abs(Math.sin(x * 0.021 + z * 0.017)) * 7 // mountain ridges
    // river valley (wide depression corridor) then carved channel
    const dR = riverDist(x, z)
    const corr = sm(clamp(1 - dR / 42, 0, 1))
    h = h * (1 - 0.92 * corr) - 1.0 * corr
    const ch = sm(clamp(1 - dR / 11, 0, 1))
    h = h * (1 - ch) + -3.2 * ch
    // estuary lake
    const dL = Math.hypot(x - LAKE.x, z - LAKE.z)
    const lkW = sm(clamp(1 - dL / 44, 0, 1))
    h = h * (1 - lkW * 0.85) - 0.8 * lkW
    const lk = sm(clamp(1 - dL / 26, 0, 1))
    h = h * (1 - lk) + -4 * lk
    // flatten the farmland patches
    const dF = fieldDist(x, z)
    const fl = sm(clamp(1 - dF / 22, 0, 1))
    h = L(h, 0.9, fl * 0.92)
    return h
  }

  const groundDayC = new THREE.Color(0xdfe3d2), groundNightC = new THREE.Color(0x4c5a70)
  const gGrass = cloneTex(grassTex, 75, 75)
  const groundMat = new THREE.MeshPhongMaterial({
    map: gGrass,
    color: groundDayC.clone(),
    shininess: 1,
    flatShading: true,
  })
  const groundGeo = new THREE.PlaneGeometry(600, 600, 130, 130)
  groundGeo.rotateX(-Math.PI / 2)
  {
    const pos = groundGeo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)))
    groundGeo.computeVertexNormals()
  }
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.receiveShadow = true
  city.add(ground)

  // global water surface: visible wherever the ground sinks below it (river
  // channel + lake)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), matWater)
  water.rotation.x = -Math.PI / 2
  water.position.y = -1.5
  city.add(water)

  // farmland strips (alternating tones along the eastern plain arc)
  FIELD_SEGS.forEach(function (f) {
    const a = f[2]
    const cx = Math.cos(a) * 130, cz = Math.sin(a) * 130
    for (let i = 0; i < 6; i++) {
      const off = -20 + i * 8
      const m = new THREE.Mesh(new THREE.PlaneGeometry(52, 7.5), i % 2 ? matFieldB : matFieldA)
      m.rotation.set(-Math.PI / 2, 0, -a - Math.PI / 2)
      m.position.set(cx + Math.cos(a) * off, 0.96, cz + Math.sin(a) * off)
      m.receiveShadow = true
      city.add(m)
    }
  })

  // hillside + mountain trees and rocks (clear of river, lake and fields)
  {
    let placed = 0, tries = 0
    while (placed < 88 && tries < 400) {
      tries++
      const ang = Math.random() * Math.PI * 2
      const rr = 126 + Math.random() * 155
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr
      if (riverDist(x, z) < 16) continue
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < 30) continue
      if (fieldDist(x, z) < 28) continue
      const h = terrainH(x, z)
      if (h < 0.2 || h > 34) continue
      tree(city, x, z, 0.9 + Math.random() * 1.0, placed % 2 === 0, h)
      placed++
    }
    let rocks = 0, rtries = 0
    while (rocks < 30 && rtries < 200) {
      rtries++
      const a2 = Math.random() * Math.PI * 2
      const r2 = 150 + Math.random() * 135
      const x2 = Math.cos(a2) * r2, z2 = Math.sin(a2) * r2
      if (riverDist(x2, z2) < 18) continue
      if (Math.hypot(x2 - LAKE.x, z2 - LAKE.z) < 32) continue
      if (fieldDist(x2, z2) < 28) continue
      const h2 = terrainH(x2, z2)
      if (h2 < 1) continue
      const s2 = 1 + Math.random() * 2.6
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), matRock)
      rock.scale.set(s2 * (0.8 + Math.random() * 0.5), s2 * (0.6 + Math.random() * 0.5), s2 * (0.8 + Math.random() * 0.5))
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      rock.position.set(x2, h2 + s2 * 0.2, z2)
      rock.receiveShadow = true
      city.add(rock)
      rocks++
    }
  }

  // river flow particles (drift with the current)
  const flowPts: THREE.Points & { userData: Record<string, unknown> } = ((): THREE.Points => {
    const lens = [0]
    let total = 0
    for (let i = 0; i < RIVER_PTS.length - 1; i++) {
      const a = RIVER_PTS[i]
      const b = RIVER_PTS[i + 1]
      if (a === undefined || b === undefined) continue
      total += Math.hypot(b[0] - a[0], b[1] - a[1])
      lens.push(total)
    }
    const pos: number[] = [],
      seeds: { u: number; lat: number }[] = []
    for (let k = 0; k < 26; k++) {
      seeds.push({ u: Math.random() * 0.9, lat: (Math.random() - 0.5) * 7 })
      pos.push(0, -1.15, 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, matFlow)
    pts.userData = { seeds: seeds, lens: lens, total: total }
    city.add(pts)
    return pts
  })()
  function riverPos(u: number): [number, number] {
    const d = u * (flowPts.userData.total as number)
    const lens = flowPts.userData.lens as number[]
    for (let i = 0; i < lens.length - 1; i++) {
      const l0 = lens[i]
      const l1 = lens[i + 1]
      const a = RIVER_PTS[i]
      const b = RIVER_PTS[i + 1]
      if (l0 === undefined || l1 === undefined || a === undefined || b === undefined) break
      if (d <= l1) {
        const f = (d - l0) / (l1 - l0)
        return [L(a[0], b[0], f), L(a[1], b[1], f)]
      }
    }
    const last = RIVER_PTS[RIVER_PTS.length - 1]
    return last ? [last[0], last[1]] : [0, 0]
  }

  const clouds: { g: THREE.Sprite; speed: number }[] = []
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Sprite(cloudMat)
    const w = 38 + Math.random() * 36
    cl.scale.set(w, w * 0.42, 1)
    cl.position.set(-240 + Math.random() * 480, 102 + Math.random() * 30, -220 + Math.random() * 440)
    city.add(cl)
    clouds.push({ g: cl, speed: 1.4 + Math.random() * 1.8 })
  }

  const paveDayC = new THREE.Color(0xffffff), paveNightC = new THREE.Color(0x66707e)
  const gPave = cloneTex(paveTex, 34, 34)
  const paveMat = new THREE.MeshPhongMaterial({ map: gPave, color: paveDayC.clone(), shininess: 3 })
  const pavement = new THREE.Mesh(new THREE.PlaneGeometry(170, 170), paveMat)
  pavement.rotation.x = -Math.PI / 2
  pavement.position.y = 0.08
  pavement.receiveShadow = true
  city.add(pavement)

  // ============================================
  // 6) Road network: inner grid + connectors + corrected-orientation ring
  // ============================================
  function roadStrip(len: number, w: number, y: number, vertical: boolean): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), asphMat(len, w))
    m.rotation.set(-Math.PI / 2, 0, vertical ? Math.PI / 2 : 0)
    m.position.y = y
    m.receiveShadow = true
    return m
  }
  /** The four cardinal connector directions (shared by roads/lamps/trees). */
  const DIRS: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]
  ;[-60, 0, 60].forEach(function (a) {
    const h = roadStrip(132, 12, 0.16, false)
    h.position.x = 0
    h.position.z = a
    city.add(h)
    const vv = roadStrip(132, 12, 0.19, true)
    vv.position.x = a
    vv.position.z = 0
    city.add(vv)
  })
  ;[-30, 30].forEach(function (a) {
    const h = roadStrip(116, 6, 0.22, false)
    h.position.x = 0
    h.position.z = a
    city.add(h)
    const vv = roadStrip(116, 6, 0.22, true)
    vv.position.x = a
    vv.position.z = 0
    city.add(vv)
  })
  ;DIRS.forEach(function (dir) {
    const vert = dir[0] === 0
    const m = roadStrip(37, 12, 0.12, vert)
    m.position.set(dir[0] * 82.5, 0.12, dir[1] * 82.5)
    city.add(m)
    const s = 68,
      e = 93
    const p1 = vert ? v(0, 0.26, dir[1] * s) : v(dir[0] * s, 0.26, 0)
    const p2 = vert ? v(0, 0.26, dir[1] * e) : v(dir[0] * e, 0.26, 0)
    city.add(markLine(p1, p2, matDashW, true))
  })

  // ring road — segments truly tangent to the circle (angle correction)
  const RING_R = 99, RING_W = 9, RING_SEG = 26
  {
    for (let i = 0; i < RING_SEG; i++) {
      const a = (i * Math.PI * 2) / RING_SEG
      const len = (Math.PI * 2 * RING_R) / RING_SEG + 1.4
      const t = new THREE.CanvasTexture(asphCv)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = MAX_ANISO
      t.colorSpace = THREE.SRGBColorSpace
      t.repeat.set(len / 7, RING_W / 7)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, RING_W), new THREE.MeshPhongMaterial({ map: t, shininess: 4 }))
      m.rotation.set(-Math.PI / 2, 0, -a - Math.PI / 2)
      m.position.set(Math.cos(a) * RING_R, 0.14, Math.sin(a) * RING_R)
      m.receiveShadow = true
      city.add(m)
    }
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 120; k++) {
      const aa = (k / 120) * Math.PI * 2
      pts.push(v(Math.cos(aa) * RING_R, 0.18, Math.sin(aa) * RING_R))
    }
    const ringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), matDashW)
    ringLine.computeLineDistances()
    city.add(ringLine)
    for (let s = 0; s < 12; s++) {
      const sa = s * (Math.PI / 6)
      lamp(city, Math.cos(sa) * 104, Math.sin(sa) * 104, -Math.cos(sa), -Math.sin(sa))
    }
  }

  const cuts: [number, number][] = [
    [-54, -33],
    [-27, -6],
    [6, 27],
    [33, 54],
  ]
  ;[-60, 0, 60].forEach(function (at) {
    cuts.forEach(function (c) {
      city.add(markLine(v(c[0], 0.26, at), v(c[1], 0.26, at), matDashW, true))
      city.add(markLine(v(c[0], 0.25, at - 5.3), v(c[1], 0.25, at - 5.3), matLine))
      city.add(markLine(v(c[0], 0.25, at + 5.3), v(c[1], 0.25, at + 5.3), matLine))
      city.add(markLine(v(at - 5.3, 0.27, c[0]), v(at - 5.3, 0.27, c[1]), matLine))
      city.add(markLine(v(at + 5.3, 0.27, c[0]), v(at + 5.3, 0.27, c[1]), matLine))
      city.add(markLine(v(at, 0.28, c[0]), v(at, 0.28, c[1]), matDashW, true))
    })
  })
  const laneCuts: [number, number][] = [
    [-54, -3],
    [3, 54],
  ]
  ;laneCuts.forEach(function (c) {
    city.add(markLine(v(c[0], 0.28, 30), v(c[1], 0.28, 30), matDashW, true))
    city.add(markLine(v(c[0], 0.28, -30), v(c[1], 0.28, -30), matDashW, true))
    city.add(markLine(v(30, 0.28, c[0]), v(30, 0.28, c[1]), matDashW, true))
    city.add(markLine(v(-30, 0.28, c[0]), v(-30, 0.28, c[1]), matDashW, true))
  })

  function crosswalk(x: number, z: number, vertical: boolean): void {
    for (let i = -2.8; i <= 2.8; i += 1.4)
      city.add(crossPlane(vertical ? 0.7 : 4.4, vertical ? 4.4 : 0.7, vertical ? x : x + i, vertical ? z + i : z))
  }
  crosswalk(0, 8.2, true)
  crosswalk(0, -8.2, true)
  crosswalk(8.2, 0, false)
  crosswalk(-8.2, 0, false)

  const tls: [number, number, number][] = [
    [-7.2, 7.2, 0.8],
    [7.2, 7.2, 2.4],
    [7.2, -7.2, 4.0],
    [-7.2, -7.2, 5.6],
  ]
  ;tls.forEach(function (t) {
    trafficLight(t[0], t[1], t[2])
  })
  streetSign(city, 'ساحة المدينة', 7.2, 7.2, -0.6)
  streetSign(city, 'شارع المدينة', 26.4, 22, Math.PI / 2)
  streetSign(city, 'شارع المتحف', -34, 8, Math.PI)
  streetSign(city, 'طريق الحديقة', -8, 67.5, 0)
  streetSign(city, 'زقاق السوق', 52.4, 20.5, Math.PI / 2)

  // street lamps of the two central avenues (offset from the rail pylons)
  ;[-40, -20, 20, 40].forEach(function (zz) {
    lamp(city, 7.6, zz, -1, 0)
    lamp(city, -7.6, zz, 1, 0)
    lamp(city, zz, 7.6, 0, -1)
    lamp(city, zz, -7.6, 0, 1)
  })
  const cornerLamps: [number, number][] = [
    [20, 67],
    [-20, 67],
    [20, -67],
    [-20, -67],
  ]
  ;cornerLamps.forEach(function (p) {
    lamp(city, p[0], p[1], 0, -1)
  })
  ;DIRS.forEach(function (dir) {
    ;[74, 82, 90].forEach(function (s) {
      const px = dir[0] ? dir[0] * s : 7.2 * (Math.floor(s / 14) % 2 ? 1 : -1)
      const pz = dir[0] ? 7.2 * (Math.floor(s / 14) % 2 ? -1 : 1) : dir[1] * s
      lamp(city, px, pz, dir[0] ? -dir[0] : 0, dir[1] ? -dir[1] : 0)
    })
  })

  // ============================================
  // 7) Interactive landmark registry
  // ============================================
  const pickables: THREE.Group[] = []
  function register(g: THREE.Group, spec: LandmarkSpec, cx: number, cz: number): LandmarkRuntime {
    const rt: LandmarkRuntime = {
      ...spec,
      root: g,
      cx: cx,
      cz: cz,
      code: 'BC-' + (100 + pickables.length),
      sector: spec.sector ?? (cz >= 0 ? 'N' : 'S') + (cx >= 0 ? 'E' : 'W'),
      dims: null,
    }
    g.userData.building = rt
    pickables.push(g)
    return rt
  }

  // Registry order is load-bearing (NODE codes BC-100…BC-117 follow it):
  // lm(i) throws if the fixed 18-entry table in data.ts ever drifts.
  function lm(i: number): LandmarkSpec {
    const spec = CITY_LANDMARKS[i]
    if (!spec) throw new Error('city: landmark registry order broken')
    return spec
  }
  const LM_TOWER = lm(0),
    LM_MARKET = lm(1),
    LM_MUSEUM = lm(2),
    LM_RESIDENTIAL = lm(3),
    LM_PARK = lm(4),
    LM_HOTEL = lm(5),
    LM_BUSINESS = lm(6),
    LM_HOSPITAL = lm(7),
    LM_CINEMA = lm(8),
    LM_NEIGHBORHOOD = lm(9),
    LM_SCHOOL = lm(10),
    LM_SPORTS = lm(11),
    LM_WEST_TOWER = lm(12),
    LM_CITY_HALL = lm(13),
    LM_LIBRARY = lm(14),
    LM_INDUSTRIAL = lm(15),
    LM_STATION = lm(16),
    LM_TRAIN = lm(17)

  // ---- City tower ----
  {
    const g = new THREE.Group()
    g.position.set(16.5, 0, 16.5)
    g.add(bldg(17, 6.5, 17, 0, 3.25, 0, 'A'))
    for (let i = 0; i < 4; i++) {
      g.add(solidBox(3.2, 3.3, 0.3, -5.6 + i * 3.75, 1.65, -8.6, matGlassDk))
      g.add(solidBox(3.2, 0.12, 0.95, -5.6 + i * 3.75, 3.5, -9, new THREE.MeshPhongMaterial({ map: awningTex })))
    }
    let y = 6.5
    const tiers: [number, number][] = [
      [12.5, 19],
      [9, 13],
      [5.5, 8],
    ]
    ;tiers.forEach(function (s) {
      g.add(bldg(s[0], s[1], s[0], 0, y + s[1] / 2, 0, 'G'))
      y += s[1]
    })
    g.add(solidBox(2.2, 1.4, 2.2, 0, 47.2, 0, matStone))
    g.add(solidCyl(0.06, 0.1, 7, 0, 50, 0, matPost, 8))
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xb04040 }))
    beacon.position.set(0, 53.6, 0)
    g.add(beacon)
    signBoard(g, 'برج المدينة', 0, -10.15, Math.PI)
    register(g, LM_TOWER, 16.5, 16.5)
    city.add(g)
  }

  // ---- Central market ----
  {
    const g = new THREE.Group()
    g.position.set(43.5, 0, 16.5)
    g.add(bldg(17, 7, 13, -1, 3.5, -3.5, 'B', { ac: true }))
    for (let i = 0; i < 3; i++) g.add(solidBox(3, 1, 3, -6 + i * 5, 7.5, -3.5, matGlass, false))
    g.add(wallSign('السوق', -1, 4.7, -10.06, 3.6, 0.9, Math.PI))
    const shopStyles: FacadeKey[] = ['C', 'D', 'E', 'C', 'D']
    const names = ['مخبز', 'مقهى', 'كتب', 'زهور', 'حلويات']
    for (let s = 0; s < 5; s++) {
      const sx = -8 + s * 4
      g.add(bldg(3.2, 3.4, 2.6, sx, 1.7, 6.2, pick(shopStyles, s)))
      g.add(solidBox(2.8, 2.4, 0.18, sx, 1.35, 7.55, matGlassDk))
      g.add(solidBox(3.4, 0.12, 1.1, sx, 3.55, 7.9, new THREE.MeshPhongMaterial({ map: awningTex })))
      g.add(wallSign(pick(names, s), sx, 3.05, 7.52, 2.4, 0.6, 0, '#f2f0e9', '#2c343d'))
    }
    makeCrowd(g, 34, function () {
      return [(Math.random() - 0.5) * 14, 0.4, 9.2 + (Math.random() - 0.5) * 1.4]
    })
    signBoard(g, 'السوق التجاري', 0, 10.15, 0)
    register(g, LM_MARKET, 43.5, 16.5)
    city.add(g)
  }

  // ---- City museum ----
  {
    const g = new THREE.Group()
    g.position.set(16.5, 0, 43.5)
    g.add(bldg(15, 5, 11, 0, 2.5, 0.5, 'E'))
    const domeGeo = new THREE.SphereGeometry(4.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    const dome = new THREE.Mesh(
      domeGeo,
      new THREE.MeshPhongMaterial({ color: 0xcfd8dd, flatShading: true, shininess: 60, transparent: true, opacity: 0.85 })
    )
    dome.castShadow = dome.receiveShadow = true
    dome.position.set(0, 5, 0.5)
    g.add(dome)
    g.add(solidCyl(0.25, 0.35, 1.5, 0, 9.9, 0.5, matGlass))
    for (let i = 0; i < 4; i++) g.add(solidCyl(0.42, 0.42, 4.6, -5.4 + i * 3.6, 2.3, -6.1, matStoneLt, 12))
    g.add(solidBox(13.4, 0.8, 1.3, 0, 5, -5.55, matStoneLt))
    g.add(solidBox(13, 0.3, 1, 0, 0.15, -7.0, matStone))
    g.add(solidBox(12, 0.3, 0.9, 0, 0.45, -7.5, matStone))
    g.add(solidBox(4, 3, 0.3, 0, 1.5, -5.2, matGlassDk))
    signBoard(g, 'متحف المدينة', 0, -9.6, Math.PI)
    register(g, LM_MUSEUM, 16.5, 43.5)
    city.add(g)
  }

  // ---- Eastern residential complex ----
  {
    const g = new THREE.Group()
    g.position.set(43.5, 0, 43.5)
    const towers: [number, number, number, number, FacadeKey][] = [
      [0, 2.5, 8, 26, 'C'],
      [-6, -4, 7, 17, 'D'],
      [6, -4, 7.5, 21, 'B'],
    ]
    ;towers.forEach(function (tw) {
      g.add(bldg(tw[2], tw[3], tw[2], tw[0], tw[3] / 2, tw[1], tw[4], { ac: true }))
      g.add(solidBox(2, 2.4, 0.3, tw[0], 1.2, tw[1] - tw[2] / 2 - 0.12, matGlassDk))
    })
    tree(g, -8, 7, 0.9)
    tree(g, 8, 7.5, 1.1, true)
    signBoard(g, 'المجمع السكني', 0, -9.8, Math.PI)
    register(g, LM_RESIDENTIAL, 43.5, 43.5)
    city.add(g)
  }

  // ---- Central park ----
  {
    const g = new THREE.Group()
    g.position.set(-16.5, 0, 16.5)
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.MeshPhongMaterial({ color: 0x79a455, shininess: 1 }))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.y = 0.12
    lawn.receiveShadow = true
    g.add(lawn)
    const paths: [number, number, number, number, number, number][] = [
      [18, 1.5, 0, 0, 11, 1],
      [1.5, 18, 0, 0, 1, 11],
    ]
    ;paths.forEach(function (p) {
      const t = pathTex.clone()
      t.needsUpdate = true
      // NOTE: the authored path strips carry an off-by-one repeat index
      // (p[6] is undefined — repeat.y ends up NaN) — preserved verbatim so
      // the rendered look matches the assessed model exactly.
      t.repeat.set(p[5], (p as number[])[6] as number)
      t.anisotropy = MAX_ANISO
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p[0], p[1]), new THREE.MeshPhongMaterial({ map: t, shininess: 2 }))
      m.rotation.x = -Math.PI / 2
      m.position.set(p[2], 0.09, p[3])
      m.receiveShadow = true
      g.add(m)
    })
    const pTex = pathTex.clone()
    pTex.needsUpdate = true
    pTex.repeat.set(4, 4)
    pTex.anisotropy = MAX_ANISO
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshPhongMaterial({ map: pTex, shininess: 2 }))
    plaza.rotation.x = -Math.PI / 2
    plaza.position.y = 0.1
    plaza.receiveShadow = true
    g.add(plaza)
    const edge = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.75, 32), matStone)
    edge.rotation.x = -Math.PI / 2
    edge.position.set(-4.5, 0.14, -4.2)
    g.add(edge)
    const lake = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), matWater)
    lake.rotation.x = -Math.PI / 2
    lake.position.set(-4.5, 0.15, -4.2)
    g.add(lake)
    g.add(solidCyl(1.7, 1.9, 0.8, 4.3, 0.4, -4.5, matStone, 20))
    g.add(solidCyl(0.18, 0.26, 1.3, 4.3, 1.6, -4.5, matStoneLt, 10))
    g.add(solidCyl(0.75, 0.5, 0.3, 4.3, 2.35, -4.5, matStone, 16))
    const fpos: number[] = [],
      fph: number[] = []
    for (let i = 0; i < 44; i++) {
      fpos.push(4.3, 2.5, -4.5)
      fph.push(Math.random())
    }
    const fgeo = new THREE.BufferGeometry()
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3))
    const fpts = new THREE.Points(fgeo, matSpray)
    fpts.userData = { ph: fph, isFountain: true, fx: 4.3, fz: -4.5 }
    g.add(fpts)
    crowds.push(fpts)
    const parkTrees: [number, number, number, boolean?][] = [
      [-7.6, -7.6, 1.2],
      [-7.6, 7, 1],
      [7.6, -7.8, 1.1, true],
      [-2, 8.3, 0.9, true],
      [8, 7, 1.3],
      [7.5, 0.4, 0.8],
      [-8, 2.6, 0.6, true],
      [2, 8.5, 0.7],
    ]
    ;parkTrees.forEach(function (tr) {
      tree(g, tr[0], tr[1], tr[2], tr[3])
    })
    bench(g, 3.8, 3.8, -Math.PI / 4)
    bench(g, -3.8, 3.8, Math.PI / 4)
    bench(g, -3.8, -3.8, Math.PI + Math.PI / 4)
    bench(g, 0, 4.4, Math.PI)
    makeCrowd(g, 42, function () {
      const r = Math.random()
      if (r < 0.4) return [(Math.random() - 0.5) * 16, 0.55, (Math.random() - 0.5) * 1.2]
      if (r < 0.8) return [(Math.random() - 0.5) * 1.2, 0.55, (Math.random() - 0.5) * 16]
      const a = Math.random() * 6.28,
        rr = 2.2 + Math.random() * 0.8
      return [Math.cos(a) * rr, 0.55, Math.sin(a) * rr]
    })
    signBoard(g, 'الحديقة المركزية', 9.2, 0, Math.PI / 2)
    register(g, LM_PARK, -16.5, 16.5)
    city.add(g)
  }

  // ---- City hotel ----
  {
    const g = new THREE.Group()
    g.position.set(-43.5, 0, 16.5)
    g.add(bldg(9, 23, 13, 0, 11.5, 0, 'D', { ac: true }))
    g.add(solidBox(9.8, 0.7, 13.8, 0, 23.35, 0, matStone))
    g.add(solidBox(3, 0.25, 4.5, 5.8, 3.6, 0, matGlass, false))
    g.add(solidCyl(0.1, 0.1, 3.5, 7, 1.75, 1.9, matPost, 8))
    g.add(solidCyl(0.1, 0.1, 3.5, 7, 1.75, -1.9, matPost, 8))
    g.add(solidBox(0.25, 3, 3.2, 4.62, 1.5, 0, matGlassDk))
    g.add(solidCyl(0.06, 0.06, 5.5, -3.5, 25.8, -5, matPost, 8))
    g.add(solidBox(1.3, 0.8, 0.06, -2.8, 26.6, -5, matFlag, false))
    signBoard(g, 'فندق المدينة', 9.8, 0, Math.PI / 2)
    register(g, LM_HOTEL, -43.5, 16.5)
    city.add(g)
  }

  // ---- Business building ----
  {
    const g = new THREE.Group()
    g.position.set(-16.5, 0, 43.5)
    g.add(bldg(11, 17, 11, 0, 8.5, 0, 'G', { ac: true }))
    g.add(solidBox(3, 1.2, 3, 0, 17.6, 0, matStone))
    g.add(solidBox(4, 3, 0.3, 0, 1.5, -5.62, matGlassDk))
    g.add(solidBox(3.6, 0.3, 1.6, 0, 3.3, -6.1, matGlass, false))
    signBoard(g, 'مبنى الأعمال', 0, -9.8, Math.PI)
    register(g, LM_BUSINESS, -16.5, 43.5)
    city.add(g)
  }

  // ---- General hospital ----
  {
    const g = new THREE.Group()
    g.position.set(-43.5, 0, 43.5)
    g.add(bldg(12, 7, 6, 0, 3.5, 4, 'D'))
    g.add(bldg(12, 7, 6, 0, 3.5, -4.6, 'B'))
    g.add(solidBox(5, 5, 3.4, 0, 2.6, -0.3, matStone))
    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), matHeli)
    pad.rotation.x = -Math.PI / 2
    pad.position.set(0, 7.06, 4)
    g.add(pad)
    g.add(solidBox(0.22, 0.04, 1.5, -0.45, 7.1, 4, matWhite, false))
    g.add(solidBox(0.22, 0.04, 1.5, 0.45, 7.1, 4, matWhite, false))
    g.add(solidBox(1.12, 0.04, 0.22, 0, 7.1, 4, matWhite, false))
    g.add(solidBox(5, 0.3, 2.4, 0, 3.15, -8.5, matGlass, false))
    g.add(solidBox(3, 2.8, 0.25, 0, 1.4, -7.72, matGlassDk))
    const amb = new THREE.Group()
    amb.add(solidBox(1.25, 0.95, 2.2, 0, 0.55, 0, matWhite))
    amb.add(solidBox(1.29, 0.3, 1.1, 0, 0.62, 0, new THREE.MeshPhongMaterial({ color: 0xa33b32 })))
    const wheelPos: [number, number][] = [
      [0.6, 0.75],
      [-0.6, 0.75],
      [0.6, -0.75],
      [-0.6, -0.75],
    ]
    ;wheelPos.forEach(function (p) {
      const w = solidCyl(0.2, 0.2, 0.14, p[0], 0.2, p[1], matPost, 10)
      w.rotation.z = Math.PI / 2
      amb.add(w)
    })
    amb.position.set(4.5, 0, -8.7)
    g.add(amb)
    signBoard(g, 'المستشفى العام', 0, -10.1, Math.PI)
    register(g, LM_HOSPITAL, -43.5, 43.5)
    city.add(g)
  }

  // ---- City cinema ----
  {
    const g = new THREE.Group()
    g.position.set(16.5, 0, -16.5)
    g.add(bldg(14, 7, 10, 0, 3.5, 1, 'C'))
    g.add(solidBox(5.5, 1.05, 1.8, 2.5, 4.3, -5.2, new THREE.MeshPhongMaterial({ color: 0xa8453a, shininess: 30 })))
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), matLampHead)
      b.position.set(0.5 + i * 1, 3.72, -5.9)
      g.add(b)
    }
    g.add(solidBox(2.6, 10.5, 1, -4.5, 5.25, -4.5, matPost))
    g.add(wallSign('السينما', -4.5, 8.3, -5.06, 2.2, 0.8, Math.PI))
    g.add(solidBox(4, 3, 0.3, 2.5, 1.5, -4.05, matGlassDk))
    signBoard(g, 'سينما المدينة', 0, -9.8, Math.PI)
    register(g, LM_CINEMA, 16.5, -16.5)
    city.add(g)
  }

  // ---- Residential neighborhood ----
  {
    const g = new THREE.Group()
    g.position.set(43.5, 0, -16.5)
    const styles: FacadeKey[] = ['B', 'C', 'B', 'C', 'B']
    for (let i = 0; i < 5; i++) {
      const x = -8 + i * 4
      g.add(bldg(3.6, 5.2, 6, x, 2.6, 1, pick(styles, i)))
      g.add(solidBox(3.8, 0.4, 6.2, x, 5.4, 1, matStone))
      g.add(solidBox(0.95, 2, 0.2, x, 1, -2.06, matGlassDk))
    }
    g.add(markLine(v(-10, 0.55, -5.5), v(10, 0.55, -5.5), matFence, true))
    g.add(markLine(v(-10, 0.55, -5.5), v(-10, 0.55, -2.2), matFence, true))
    g.add(markLine(v(10, 0.55, -5.5), v(10, 0.55, -2.2), matFence, true))
    tree(g, -6, -4, 0.75)
    tree(g, 2, -4, 0.7, true)
    tree(g, 6, -4, 0.8)
    signBoard(g, 'الحي السكني', 0, -9.8, Math.PI)
    register(g, LM_NEIGHBORHOOD, 43.5, -16.5)
    city.add(g)
  }

  // ---- City school ----
  {
    const g = new THREE.Group()
    g.position.set(16.5, 0, -43.5)
    g.add(bldg(13, 6.5, 5.5, -2.5, 3.25, 3, 'E'))
    g.add(bldg(5, 6.5, 5.5, 6, 3.25, -1, 'C'))
    const court = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 5.5), new THREE.MeshPhongMaterial({ color: 0xb7bab4, shininess: 4 }))
    court.rotation.x = -Math.PI / 2
    court.position.set(-5.75, 0.1, -5.75)
    court.receiveShadow = true
    g.add(court)
    const courtLines: [number, number, number, number][] = [
      [-9.4, -8.4, -2.1, -8.4],
      [-2.1, -8.4, -2.1, -3.1],
      [-2.1, -3.1, -9.4, -3.1],
      [-9.4, -3.1, -9.4, -8.4],
      [-5.75, -8.4, -5.75, -3.1],
    ]
    ;courtLines.forEach(function (l) {
      g.add(markLine(v(l[0], 0.14, l[1]), v(l[2], 0.14, l[3]), matLine))
    })
    g.add(solidCyl(0.08, 0.08, 3.2, -2.4, 1.6, -5.75, matPost, 8))
    g.add(solidBox(0.08, 1, 1.3, -2.6, 3, -5.75, matWhite))
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 18), matOrange)
    rim.rotation.y = Math.PI / 2
    rim.position.set(-2.85, 2.9, -5.75)
    g.add(rim)
    g.add(solidCyl(0.06, 0.06, 7, -8.5, 3.5, 6.5, matPost, 8))
    g.add(solidBox(1.35, 0.85, 0.06, -7.8, 6.6, 6.5, matFlag, false))
    g.add(solidBox(4, 0.3, 1.5, -2.5, 3.35, 6.1, matGlass, false))
    signBoard(g, 'مدرسة المدينة', 0, 9.2, 0)
    register(g, LM_SCHOOL, 16.5, -43.5)
    city.add(g)
  }

  // ---- Sports center ----
  {
    const g = new THREE.Group()
    g.position.set(43.5, 0, -43.5)
    g.add(bldg(8, 5.5, 6.5, -6, 2.75, 5, 'D', { ac: true }))
    const field = new THREE.Mesh(new THREE.PlaneGeometry(12, 8.5), new THREE.MeshPhongMaterial({ color: 0x6f9c4c, shininess: 1 }))
    field.rotation.x = -Math.PI / 2
    field.position.set(3, 0.11, -3.2)
    field.receiveShadow = true
    g.add(field)
    const fieldLines: [number, number, number, number][] = [
      [-3, -7.4, 9, -7.4],
      [9, -7.4, 9, 1],
      [9, 1, -3, 1],
      [-3, 1, -3, -7.4],
      [3, -7.4, 3, 1],
    ]
    ;fieldLines.forEach(function (l) {
      g.add(markLine(v(l[0], 0.15, l[1]), v(l[2], 0.15, l[3]), matLine))
    })
    const cc = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.44, 24), matLine)
    cc.rotation.x = -Math.PI / 2
    cc.position.set(3, 0.16, -3.2)
    g.add(cc)
    g.add(solidBox(2, 0.65, 0.25, 3, 0.33, -7.3, matWhite))
    g.add(solidBox(2, 0.65, 0.25, 3, 0.33, 0.9, matWhite))
    const masts: [number, number][] = [
      [-3.2, -7.6],
      [9.2, -7.6],
      [-3.2, 1.2],
      [9.2, 1.2],
    ]
    ;masts.forEach(function (p) {
      g.add(solidCyl(0.09, 0.12, 7, p[0], 3.5, p[1], matPost, 8))
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), matLampHead)
      glow.position.set(p[0], 7.3, p[1])
      g.add(glow)
    })
    signBoard(g, 'المركز الرياضي', 0, 9.2, 0)
    register(g, LM_SPORTS, 43.5, -43.5)
    city.add(g)
  }

  // ---- Western business tower ----
  {
    const g = new THREE.Group()
    g.position.set(-16.5, 0, -16.5)
    g.add(bldg(10.5, 26, 10.5, 0, 13, 0, 'G', { ac: true }))
    g.add(bldg(6.5, 6, 6.5, 0, 29, 0, 'D'))
    g.add(solidCyl(0.06, 0.09, 5, 0, 34.5, 0, matPost, 8))
    const pad = new THREE.Mesh(new THREE.CircleGeometry(2.1, 24), matHeli)
    pad.rotation.x = -Math.PI / 2
    pad.position.set(0, 32.06, 0)
    g.add(pad)
    g.add(solidBox(0.22, 0.04, 1.5, -0.45, 32.1, 0, matWhite, false))
    g.add(solidBox(0.22, 0.04, 1.5, 0.45, 32.1, 0, matWhite, false))
    g.add(solidBox(1.12, 0.04, 0.22, 0, 32.1, 0, matWhite, false))
    g.add(solidBox(2.8, 0.3, 4, 5.9, 3.5, 0, matGlass, false))
    g.add(solidBox(0.25, 2.8, 2.6, 5.42, 1.4, 0, matGlassDk))
    signBoard(g, 'برج الأعمال', 9.6, 4, Math.PI / 2)
    register(g, LM_WEST_TOWER, -16.5, -16.5)
    city.add(g)
  }

  // ---- City hall ----
  {
    const g = new THREE.Group()
    g.position.set(-43.5, 0, -16.5)
    g.add(bldg(12, 9, 12, 0, 4.5, 0, 'E'))
    const domeGeo = new THREE.SphereGeometry(2.6, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2)
    const dome = new THREE.Mesh(domeGeo, new THREE.MeshPhongMaterial({ color: 0x6b7f63, flatShading: true, shininess: 30 }))
    dome.castShadow = true
    dome.position.y = 9
    g.add(dome)
    g.add(solidCyl(0.18, 0.22, 1.2, 0, 11.8, 0, matStoneLt, 10))
    for (let i = 0; i < 4; i++) g.add(solidCyl(0.45, 0.45, 7, 7.2, 3.5, -4.5 + i * 3, matStoneLt, 14))
    g.add(solidBox(1.6, 1, 13, 7.2, 7.5, 0, matStoneLt))
    g.add(solidBox(1, 0.3, 11, 8.6, 0.15, 0, matStone))
    g.add(solidBox(0.9, 0.3, 11, 9.2, 0.45, 0, matStone))
    g.add(solidCyl(0.06, 0.06, 6.5, -4, 12.25, -4, matPost, 8))
    g.add(solidBox(1.4, 0.9, 0.06, -3.2, 14.75, -4, matFlag, false))
    bench(g, 8.4, 6.5, -Math.PI / 2)
    bench(g, 8.4, -6.5, -Math.PI / 2)
    signBoard(g, 'مبنى البلدية', 9.3, 7, Math.PI / 2)
    register(g, LM_CITY_HALL, -43.5, -16.5)
    city.add(g)
  }

  // ---- Public library ----
  {
    const g = new THREE.Group()
    g.position.set(-16.5, 0, -43.5)
    g.add(bldg(12, 6.5, 9, 0, 3.25, -1, 'B', { ac: true }))
    for (let i = 0; i < 3; i++) g.add(solidCyl(0.4, 0.4, 5.5, -3.5 + i * 3.5, 2.75, 4.2, matStoneLt, 12))
    g.add(solidBox(11, 0.8, 1.6, 0, 5.9, 4.2, matStoneLt))
    g.add(solidBox(9, 0.3, 1.3, 0, 0.15, 5.6, matStone))
    g.add(solidBox(3, 2.8, 0.25, 0, 1.4, 3.62, matGlassDk))
    signBoard(g, 'المكتبة العامة', 0, 9.2, 0)
    register(g, LM_LIBRARY, -16.5, -43.5)
    city.add(g)
  }

  // ---- Industrial zone ----
  {
    const g = new THREE.Group()
    g.position.set(-43.5, 0, -43.5)
    g.add(solidBox(16, 6.5, 7, -1, 3.25, 2.5, matWare))
    g.add(solidBox(16.4, 0.5, 7.4, -1, 6.75, 2.5, matStone))
    ;[-6.5, -1.5, 3.5].forEach(function (door) {
      g.add(solidBox(3, 4, 0.15, door, 2, 6.05, matGlassDk, false))
    })
    g.add(solidBox(7, 4.5, 6, 6, 2.25, -5.5, matWare))
    g.add(solidCyl(0.55, 0.95, 12, -7.5, 6, 5.5, matChimney, 14))
    g.add(solidBox(5.6, 0.7, 3.2, 6.5, 0.35, 7.5, matStone))
    const tank = solidCyl(1.5, 1.5, 5, 6.5, 2, 7.5, matTank, 16)
    tank.rotation.z = Math.PI / 2
    g.add(tank)
    g.add(solidBox(0.9, 0.9, 0.9, 2, 0.45, 8.2, matWare))
    g.add(solidBox(0.7, 0.7, 0.7, 1.1, 0.35, 8.5, matWare))
    const fenceLines: THREE.Vector3[] = [
      v(-9.5, 0.6, -9.5), v(-3.2, 0.6, -9.5), v(5.2, 0.6, -9.5), v(9.5, 0.6, -9.5),
      v(9.5, 0.6, -9.5), v(9.5, 0.6, 9.5), v(9.5, 0.6, 9.5), v(-9.5, 0.6, 9.5),
      v(-9.5, 0.6, 9.5), v(-9.5, 0.6, -9.5),
    ]
    for (let fi = 0; fi < fenceLines.length; fi += 2) {
      const a = fenceLines[fi],
        b = fenceLines[fi + 1]
      if (a === undefined || b === undefined) continue
      g.add(markLine(a, b, matFence, true))
    }
    g.add(solidBox(1.6, 1.7, 1.6, -8.5, 0.85, -8.2, matStone))
    signBoard(g, 'المنطقة الصناعية', 0, 8.6, 0)
    register(g, LM_INDUSTRIAL, -43.5, -43.5)
    city.add(g)
  }

  // ============================================
  // 8) Elevated rail: alternating-side pylons with side arms —
  //    nothing ever crosses the track centerline
  // ============================================
  const railY = 8.8
  {
    const rail = new THREE.Group()
    for (let z = -78; z <= 78; z += 8) {
      const east = Math.round((z + 78) / 8) % 2 === 0
      const sx = east ? 6.7 : -6.7
      rail.add(solidBox(0.45, 8.6, 0.45, sx, 4.3, z, matPost))
      rail.add(solidBox(5.5, 0.3, 0.34, east ? 3.8 : -3.8, 8.6, z, matRail))
    }
    rail.add(solidBox(0.22, 0.25, 160, 1.15, railY, 0, matRail, false))
    rail.add(solidBox(0.22, 0.25, 160, -1.15, railY, 0, matRail, false))
    city.add(rail)
  }

  let elevCab: THREE.Mesh
  {
    const g = new THREE.Group()
    g.position.set(4, 0, -16.5)
    g.add(solidBox(4.2, 0.5, 7, 0, 8.5, 0, matStone))
    g.add(solidBox(5, 0.25, 7.6, 0, 11.9, 0, matGlass, false))
    g.add(solidCyl(0.09, 0.09, 3.1, 1.7, 10.3, 0, matPost, 8))
    g.add(solidCyl(0.09, 0.09, 3.1, -1.7, 10.3, 0, matPost, 8))
    g.add(solidBox(1, 1.5, 1.4, 1.3, 9.55, 2.4, matStone))
    g.add(solidCyl(0.14, 0.14, 8.5, 2, 4.25, 2.5, matPost, 10))
    g.add(solidCyl(0.14, 0.14, 8.5, 2, 4.25, -2.5, matPost, 10))
    g.add(solidBox(2.4, 9.4, 2.8, 4, 4.7, 0, matGlass, false))
    g.add(solidBox(2.6, 0.35, 3, 4, 9.55, 0, matRail, false))
    elevCab = solidBox(1.7, 2, 2.2, 4, 4, 0, new THREE.MeshPhongMaterial({ color: 0x8ea3b2, shininess: 60 }))
    g.add(elevCab)
    g.add(solidBox(1.3, 0.2, 2.2, 2.65, 8.35, 0, matGlass, false))
    g.add(solidBox(0.1, 0.7, 0.1, 2.2, 8.0, 1.0, matPost, false))
    g.add(solidBox(0.1, 0.7, 0.1, 2.2, 8.0, -1.0, matPost, false))
    signBoard(g, 'محطة المدينة', 6.5, 8, 0, 3.2)
    register(g, LM_STATION, 4, -16.5)
    city.add(g)
  }

  const trainG = new THREE.Group()
  {
    ;[-7.6, 0, 7.6].forEach(function (zi) {
      trainG.add(solidBox(2.3, 1.9, 6.4, 0, 9.85, zi, matTrainB))
      trainG.add(solidBox(2.34, 0.68, 5.7, 0, 10.18, zi, matTrainW, false))
      trainG.add(solidBox(2.34, 0.22, 5.7, 0, 9.2, zi, matTrainS, false))
    })
    trainG.add(solidBox(2.2, 1.7, 0.3, 0, 9.85, -11.15, matTrainS))
    trainG.add(solidBox(2.2, 1.7, 0.3, 0, 9.85, 11.15, matTrainS))
    register(trainG, LM_TRAIN, 0, 0)
    city.add(trainG)
  }

  // city gate walls (north + south entries)
  ;[1, -1].forEach(function (s) {
    const g = new THREE.Group()
    g.add(solidBox(1, 7, 1, -8.6, 3.5, 0, matStoneLt))
    g.add(solidBox(1, 7, 1, 8.6, 3.5, 0, matStoneLt))
    g.add(solidBox(18.2, 1.2, 1.1, 0, 7.6, 0, matStoneLt))
    g.add(wallSign('مدينة المخطط', 0, 7.6, -0.58, 6, 1.05, Math.PI))
    g.add(wallSign('مدينة المخطط', 0, 7.6, 0.58, 6, 1.05, 0))
    g.position.set(0, 0, 69.5 * s)
    city.add(g)
  })

  // ============================================
  // 9) Suburbs + plane + cars
  // ============================================
  {
    const seeds = [0.1, 0.55, 0.3, 0.8, 0.2, 0.65, 0.4, 0.9, 0.5, 0.15, 0.35, 0.7]
    const styles: FacadeKey[] = ['B', 'C', 'D', 'E', 'A', 'B', 'D', 'E', 'C', 'A']
    function strip(axis: 'x' | 'z', pos: number, off: number): void {
      for (let i = 0; i < 7; i++) {
        const c = -48 + i * 16 + pick(seeds, i + off) * 4
        const w = 7 + pick(seeds, i + 3 + off) * 3,
          h = 5 + pick(seeds, i + 6 + off) * 9
        if (c + w / 2 > -10 && c - w / 2 < 10) continue
        const x = axis === 'x' ? c : pos
        const z = axis === 'x' ? pos : c
        city.add(bldg(w, h, 8, x, h / 2, z, pick(styles, i + off), { ac: true }))
        const tc = c + 8.5
        if (i % 2 === 0 && Math.abs(tc) >= 10) tree(city, axis === 'x' ? tc : pos, axis === 'x' ? pos : tc, 0.85, i % 4 === 0)
      }
      tree(city, axis === 'x' ? 8.8 : pos, axis === 'x' ? pos : 8.8, 0.9)
      tree(city, axis === 'x' ? -8.8 : pos, axis === 'x' ? pos : -8.8, 0.9, true)
    }
    strip('x', 73, 0)
    strip('x', -73, 3)
    strip('z', 73, 6)
    strip('z', -73, 9)
    for (let i = 0; i < 16; i++) {
      const a = i * 0.39 + 0.2,
        r = 110 + (i % 5) * 5
      const tx = Math.cos(a) * r, tz = Math.sin(a) * r
      if ((Math.abs(tx) < 10 && Math.abs(tz) > 64) || (Math.abs(tz) < 10 && Math.abs(tx) > 64)) continue
      if (Math.abs(Math.sqrt(tx * tx + tz * tz) - RING_R) < 9) continue
      if (fieldDist(tx, tz) < 28) continue
      tree(city, tx, tz, 1 + (i % 4) * 0.15, i % 2 === 0, terrainH(tx, tz))
    }
    ;DIRS.forEach(function (dir) {
      ;[76, 88].forEach(function (s, idx) {
        const side = idx % 2 ? 8.6 : -8.6
        const px = dir[0] ? dir[0] * s : side
        const pz = dir[0] ? side : dir[1] * s
        tree(city, px, pz, 0.95, idx % 2 === 0)
      })
    })
  }

  const planeG = new THREE.Group()
  let planeBeacon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  {
    const cone = new THREE.ConeGeometry(0.55, 3.6, 8)
    const body = new THREE.Mesh(cone, new THREE.MeshPhongMaterial({ color: 0xf1f1ef, shininess: 60 }))
    body.rotation.x = Math.PI / 2
    body.castShadow = true
    planeG.add(body)
    planeG.add(solidBox(3.9, 0.12, 1, 0, 0.05, 0.3, matTrainB))
    planeG.add(solidBox(1.5, 0.12, 0.6, 0, 0.32, -1.5, matTrainB))
    planeG.add(solidBox(0.12, 0.9, 0.8, 0, 0.6, -1.55, matOrange))
    planeBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4038, transparent: true, opacity: 0 })
    )
    planeBeacon.position.set(0, 0.7, -1.9)
    planeG.add(planeBeacon)
    city.add(planeG)
  }

  interface CarRoute {
    ax: 'x' | 'z'
    at: number
    dir: number
    bound: number
    lat: number
  }
  interface StreetCar {
    g: THREE.Group
    ax: 'x' | 'z'
    dir: number
    speed: number
    bound: number
  }
  interface RingCar {
    g: THREE.Group
    a: number
    r: number
    va: number
  }
  const cars: StreetCar[] = []
  const ringCars: RingCar[] = []
  {
    const carMats = [
      new THREE.MeshPhongMaterial({ color: 0xe8e8e6, shininess: 80 }),
      new THREE.MeshPhongMaterial({ color: 0x30343a, shininess: 90 }),
      new THREE.MeshPhongMaterial({ color: 0xbcc1c6, shininess: 100 }),
      new THREE.MeshPhongMaterial({ color: 0x8e3030, shininess: 70 }),
      new THREE.MeshPhongMaterial({ color: 0x33506e, shininess: 70 }),
    ]
    function makeCar(mi: number): THREE.Group {
      const g = new THREE.Group()
      g.add(solidBox(1.15, 0.55, 2.3, 0, 0.45, 0, pick(carMats, mi)))
      g.add(solidBox(0.95, 0.45, 1.15, 0, 0.95, -0.15, matGlassDk, false))
      g.add(solidBox(0.2, 0.12, 0.1, 0.36, 0.45, 1.16, matCarHead, false))
      g.add(solidBox(0.2, 0.12, 0.1, -0.36, 0.45, 1.16, matCarHead, false))
      g.add(solidBox(0.2, 0.12, 0.1, 0.36, 0.45, -1.16, matCarTail, false))
      g.add(solidBox(0.2, 0.12, 0.1, -0.36, 0.45, -1.16, matCarTail, false))
    const carWheelPos: [number, number][] = [
      [0.55, 0.78],
      [-0.55, 0.78],
      [0.55, -0.78],
      [-0.55, -0.78],
    ]
    ;carWheelPos.forEach(function (p) {
      const wheel = solidCyl(0.21, 0.21, 0.14, p[0], 0.21, p[1], matPost, 10)
      wheel.rotation.z = Math.PI / 2
      g.add(wheel)
    })
      return g
    }
    const routes: CarRoute[] = [
      { ax: 'x', at: 0, dir: 1, bound: 96, lat: 2.6 },
      { ax: 'x', at: 0, dir: -1, bound: 96, lat: 2.6 },
      { ax: 'z', at: 0, dir: 1, bound: 96, lat: 2.6 },
      { ax: 'z', at: 0, dir: -1, bound: 96, lat: 2.6 },
      { ax: 'x', at: 60, dir: 1, bound: 64, lat: 2.6 },
      { ax: 'x', at: -60, dir: -1, bound: 64, lat: 2.6 },
      { ax: 'z', at: 60, dir: 1, bound: 64, lat: 2.6 },
      { ax: 'z', at: -60, dir: -1, bound: 64, lat: 2.6 },
      { ax: 'x', at: 30, dir: 1, bound: 52, lat: 1.4 },
      { ax: 'x', at: -30, dir: -1, bound: 52, lat: 1.4 },
      { ax: 'z', at: 30, dir: -1, bound: 52, lat: 1.4 },
      { ax: 'z', at: -30, dir: 1, bound: 52, lat: 1.4 },
    ]
    for (let i = 0; i < 20; i++) {
      const r = pick(routes, i)
      const car = makeCar(i)
      const along = Math.random() * r.bound
      if (r.ax === 'x') {
        car.position.set(r.dir > 0 ? along : -along, 0, r.at + (r.dir > 0 ? r.lat : -r.lat))
        car.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2
      } else {
        car.position.set(r.at + (r.dir > 0 ? -r.lat : r.lat), 0, r.dir > 0 ? along : -along)
        car.rotation.y = r.dir > 0 ? 0 : Math.PI
      }
      city.add(car)
      cars.push({ g: car, ax: r.ax, dir: r.dir, speed: 3.5 + Math.random() * 3, bound: r.bound })
    }
    for (let k = 0; k < 6; k++) {
      const rc = makeCar(k + 2)
      const inner = k % 2 === 0
      const rr = inner ? 97 : 101.5
      const a0 = Math.random() * 6.28
      rc.position.set(Math.cos(a0) * rr, 0, Math.sin(a0) * rr)
      rc.rotation.y = -a0 + (inner ? 0 : Math.PI)
      city.add(rc)
      ringCars.push({ g: rc, a: a0, r: rr, va: inner ? 0.055 + Math.random() * 0.02 : -(0.055 + Math.random() * 0.02) })
    }
  }

  // ============================================
  // 10) Selection tools
  // ============================================
  function dimLabel(txt: string, x: number, y: number, z: number, s: number): THREE.Sprite {
    const cv = makeCanvas(320, 120), ctx = ctx2d(cv)
    ctx.fillStyle = '#f4f2ea'
    ctx.fillRect(0, 0, 320, 120)
    ctx.strokeStyle = '#b9721e'
    ctx.lineWidth = 7
    ctx.strokeRect(5, 5, 310, 110)
    ctx.fillStyle = '#2c343d'
    ctx.font = '600 52px "IBM Plex Sans Arabic", Tahoma, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(txt, 160, 62)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    sp.scale.set(s, s * 0.375, 1)
    sp.position.set(x, y, z)
    sp.renderOrder = 999
    sp.userData.dm = 1
    return sp
  }
  function buildDims(b: LandmarkRuntime): THREE.Group {
    const g = new THREE.Group()
    const w = b.w,
      d = b.d,
      h = b.h
    const by = b.ringY || 0,
      yy = by + 0.35,
      off = 3.4
    function dseg(p1: THREE.Vector3, p2: THREE.Vector3, mat?: THREE.Material): void {
      const l = markLine(p1, p2, mat || matDim)
      l.userData.dg = 1
      g.add(l)
    }
    function ddash(p1: THREE.Vector3, p2: THREE.Vector3): void {
      const l = markLine(p1, p2, matDimExt, true)
      l.userData.dg = 1
      g.add(l)
    }
    const zf = -(d / 2 + off)
    ddash(v(-w / 2, yy, -d / 2 - 0.8), v(-w / 2, yy, zf - 1.2))
    ddash(v(w / 2, yy, -d / 2 - 0.8), v(w / 2, yy, zf - 1.2))
    dseg(v(-w / 2, yy, zf), v(w / 2, yy, zf))
    dseg(v(-w / 2 - 0.55, yy, zf + 0.55), v(-w / 2 + 0.55, yy, zf - 0.55))
    dseg(v(w / 2 - 0.55, yy, zf + 0.55), v(w / 2 + 0.55, yy, zf - 0.55))
    g.add(dimLabel('عرض ' + Math.round(w) + ' م', 0, yy + 1.7, zf - 0.8, 5))
    const xr = w / 2 + off
    ddash(v(w / 2 + 0.8, yy, -d / 2), v(xr + 1.2, yy, -d / 2))
    ddash(v(w / 2 + 0.8, yy, d / 2), v(xr + 1.2, yy, d / 2))
    dseg(v(xr, yy, -d / 2), v(xr, yy, d / 2))
    dseg(v(xr - 0.55, yy, -d / 2 + 0.55), v(xr + 0.55, yy, -d / 2 - 0.55))
    dseg(v(xr - 0.55, yy, d / 2 + 0.55), v(xr + 0.55, yy, d / 2 - 0.55))
    g.add(dimLabel('عمق ' + Math.round(d) + ' م', xr + 0.6, yy + 1.7, 0, 5))
    const xh = -(w / 2 + off),
      zh = -(d / 2 + off)
    ddash(v(-w / 2 - 0.8, by + 0.15, zh), v(xh - 1.2, by + 0.15, zh))
    ddash(v(-w / 2 - 0.8, by + h, zh), v(xh - 1.2, by + h, zh))
    dseg(v(xh, by + 0.15, zh), v(xh, by + h, zh))
    g.add(dimLabel('ارتفاع ' + Math.round(h) + ' م', xh - 0.6, by + h + 1.5, zh, 5.4))
    const rr = b.ringR || Math.max(w, d) / 2 + 3.5
    const ring = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 0.45, 48), matRing)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = by + 0.18
    ring.userData.dg = 1
    g.add(ring)
    g.userData.ring = ring
    return g
  }
  function disposeGroup(g: THREE.Group): void {
    g.traverse(function (o) {
      if (o.userData.dg && (o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose()
      if (o.userData.dm && (o as THREE.Sprite).material) {
        const sm = (o as THREE.Sprite).material as THREE.SpriteMaterial
        if (sm.map) sm.map.dispose()
        sm.dispose()
      }
    })
  }
  const hoverBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), matHoverBox)
  hoverBox.visible = false
  scene.add(hoverBox)
  const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), matSelBox)
  selBox.visible = false
  scene.add(selBox)
  const selFill = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xe0912f, transparent: true, opacity: 0.1, depthWrite: false })
  )
  selFill.visible = false
  scene.add(selFill)
  function fitBox(obj: THREE.Object3D, b: LandmarkRuntime, pad: number): void {
    obj.scale.set(b.w + pad, b.h + pad, b.d + pad)
    obj.position.set(b.cx, (b.ringY || 0) + b.h / 2, b.cz)
  }

  // ============================================
  // 11) Selection logic (DOM chrome handled by the React wrapper)
  // ============================================
  let selected: LandmarkRuntime | null = null
  let hovered: LandmarkRuntime | null = null

  function select(b: LandmarkRuntime): void {
    if (selected === b) return
    if (selected) clearSel()
    selected = b
    b.dims = buildDims(b)
    b.root.add(b.dims)
    fitBox(selBox, b, 0.5)
    fitBox(selFill, b, 0.45)
    selBox.visible = selFill.visible = true
    if (hovered === b) {
      hovered = null
      hoverBox.visible = false
      cb.onHover?.(null, lastPtrX, lastPtrY)
    }
    cb.onSelect?.(b)
    breakIntro()
    camState.theta = Math.atan2(camera.position.x - b.cx, camera.position.z - b.cz)
    wantTarget.set(b.cx, b.fy !== undefined ? b.fy : b.h * 0.45, b.cz)
    wantRadius = Math.min(b.fdist || Math.max(b.h * 1.5, Math.max(b.w, b.d) * 2.7, 26), 95)
  }
  function clearSel(): void {
    if (!selected) return
    if (selected.dims) {
      disposeGroup(selected.dims)
      selected.root.remove(selected.dims)
      selected.dims = null
    }
    selected = null
    selBox.visible = selFill.visible = false
  }
  function deselect(): void {
    clearSel()
    cb.onSelect?.(null)
    wantTarget.set(0, 6, 0)
    wantRadius = 105
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let mouseMoved = false,
    groundX = 0,
    groundZ = 0
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const tmpV = new THREE.Vector3()
  // last pointer state (container-relative position + type) for the tooltip
  let lastPtrX = 0,
    lastPtrY = 0
  let lastPtrType: string = 'mouse'
  function setNDC(e: { clientX: number; clientY: number }): void {
    const r = dom.getBoundingClientRect()
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }
  function pickBuilding(): LandmarkRuntime | null {
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(pickables, true)
    const hit = hits[0]
    if (hit) {
      let o: THREE.Object3D | null = hit.object
      while (o && !o.userData.building) o = o.parent
      if (o) return o.userData.building as LandmarkRuntime
    }
    return null
  }
  /** Node whose name the tooltip may show (mouse pointers, not the selected). */
  function tipLm(): LandmarkRuntime | null {
    return hovered && hovered !== selected && lastPtrType === 'mouse' ? hovered : null
  }
  function updateHover(): void {
    const b = pickBuilding()
    if (b !== hovered) {
      hovered = b
      if (hovered && hovered !== selected) {
        fitBox(hoverBox, hovered, 0.5)
        hoverBox.visible = true
        dom.style.cursor = 'pointer'
      } else {
        hoverBox.visible = false
        dom.style.cursor = manual ? 'grab' : 'default'
      }
      cb.onHover?.(tipLm(), lastPtrX, lastPtrY)
    }
  }

  // ============================================
  // 12) Camera system
  // ============================================
  let mode: 'intro' | 'free' = 'intro'
  let introT = 0
  let manual = false
  const camState = { theta: 0, phi: 0.8 }
  let camRadius = 105,
    wantRadius = 105
  const camTarget = new THREE.Vector3(0, 20, 60)
  const wantTarget = new THREE.Vector3(0, 6, 0)
  let inputT = -100,
    autoBlend = 0
  const curLook = new THREE.Vector3(0, 20, 60)
  const tPos = new THREE.Vector3()

  function orbitPos(tt: number, out: THREE.Vector3): THREE.Vector3 {
    const a = tt * 0.05
    return out.set(Math.sin(a) * 95, 72 + Math.sin(tt * 0.13) * 4, Math.cos(a) * 95)
  }
  function introPath(tt: number): void {
    if (tt < 5) {
      const p = tt / 5,
        e = sm(p)
      const x = Math.sin(tt * 0.9) * 16 * (1 - p * 0.7)
      camera.position.set(x, L(95, 62, e), L(170, 55, e))
      curLook.set(0, L(20, 12, e), L(60, 10, e))
    } else {
      const p2 = Math.min((tt - 5) / 4, 1),
        e2 = sm(p2)
      const x1 = Math.sin(4.5) * 16 * 0.3
      const o = orbitPos(9, tPos)
      camera.position.set(L(x1, o.x, e2), L(62, o.y, e2), L(55, o.z, e2))
      curLook.set(0, L(12, 4, e2), L(10, 0, e2))
    }
    camera.lookAt(curLook)
  }
  function breakIntro(): void {
    if (mode !== 'intro') return
    mode = 'free'
    camTarget.copy(curLook)
    const d = camera.position.clone().sub(curLook)
    camRadius = wantRadius = d.length()
    camState.theta = Math.atan2(d.x, d.z)
    camState.phi = clamp(Math.acos(clamp(d.y / camRadius, -1, 1)), 0.15, 1.35)
  }
  function minR(): number {
    return selected ? 10 : 34
  }
  function setManual(on: boolean): void {
    manual = on
    cb.onManual?.(on)
    dom.classList.toggle('manual', on)
    dom.style.touchAction = on ? 'none' : 'pan-y'
    if (!on) inputT = t - 10
    dom.style.cursor = on ? 'grab' : hovered ? 'pointer' : 'default'
  }

  const ptrs = new Map<number, { x: number; y: number }>()
  let lastPinch = 0,
    dragged = false,
    downX = 0,
    downY = 0
  function onPointerDown(e: PointerEvent): void {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    downX = e.clientX
    downY = e.clientY
    dragged = false
    if (manual) dom.style.cursor = 'grabbing'
    if (ptrs.size === 2) {
      const [p0, p1] = Array.from(ptrs.values())
      if (p0 && p1) lastPinch = Math.hypot(p0.x - p1.x, p0.y - p1.y)
    }
  }
  function onPointerMove(e: PointerEvent): void {
    setNDC(e)
    mouseMoved = true
    const r = dom.getBoundingClientRect()
    lastPtrX = e.clientX - r.left
    lastPtrY = e.clientY - r.top
    lastPtrType = e.pointerType
    // tooltip position tracks the pointer instantly; the hovered node is
    // resolved once per frame by updateHover (same async cadence as authored)
    cb.onHover?.(tipLm(), lastPtrX, lastPtrY)
    raycaster.setFromCamera(ndc, camera)
    if (raycaster.ray.intersectPlane(groundPlane, tmpV)) {
      groundX = tmpV.x
      groundZ = tmpV.z
    }
    if (!manual) return
    const prev = ptrs.get(e.pointerId)
    if (!prev) return
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
    inputT = t
    if (ptrs.size === 1) {
      if (dx !== 0 || dy !== 0) {
        breakIntro()
        camState.theta -= dx * 0.0048
        camState.phi = clamp(camState.phi - dy * 0.0048, 0.15, 1.35)
        if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) dragged = true
      }
    } else if (ptrs.size === 2) {
      const [p0, p1] = Array.from(ptrs.values())
      const d = p0 && p1 ? Math.hypot(p0.x - p1.x, p0.y - p1.y) : 0
      if (lastPinch > 0 && d > 0) {
        breakIntro()
        wantRadius = clamp((wantRadius * lastPinch) / d, minR(), 300)
      }
      lastPinch = d
      dragged = true
    }
  }
  function endPtr(e: PointerEvent): void {
    ptrs.delete(e.pointerId)
    lastPinch = 0
    if (manual) dom.style.cursor = 'grab'
  }
  function onPointerUp(e: PointerEvent): void {
    endPtr(e)
    if (!dragged && Math.hypot(e.clientX - downX, e.clientY - downY) < 7) {
      setNDC(e)
      const b = pickBuilding()
      if (b) select(b)
      else if (selected) deselect()
    }
  }
  function onWheel(e: WheelEvent): void {
    // Embedded-box adaptation: auto mode lets the page scroll through the
    // canvas (no preventDefault → no scroll dead zone); manual mode claims
    // the gesture (and stops propagation so the smooth-scroll layer never
    // races the camera zoom).
    if (!manual) return
    e.preventDefault()
    e.stopPropagation()
    breakIntro()
    wantRadius = clamp(wantRadius * Math.pow(1.0015, e.deltaY), minR(), 300)
    inputT = t
  }
  dom.addEventListener('pointerdown', onPointerDown)
  dom.addEventListener('pointermove', onPointerMove)
  dom.addEventListener('pointerup', onPointerUp)
  dom.addEventListener('pointercancel', endPtr)
  dom.addEventListener('wheel', onWheel, { passive: false })

  // ============================================
  // 13) Night system
  // ============================================
  let targetNight = 0,
    nightBlend = 0,
    lampLit = false
  const waterDayC = new THREE.Color(0x4f8bb0), waterNightC = new THREE.Color(0x16324a)
  const crowdDayC = new THREE.Color(0x39475a), crowdNightC = new THREE.Color(0x8a97a8)
  const cloudDayC = new THREE.Color(0xffffff), cloudNightC = new THREE.Color(0x39435c)

  const starMat = new THREE.PointsMaterial({
    color: 0xdfe8f5,
    size: 1.8,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  })
  {
    const pos: number[] = []
    for (let i = 0; i < 420; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.random() * 1.25
      const r = 320
      pos.push(Math.cos(th) * Math.sin(ph) * r, Math.cos(ph) * r + 15, Math.sin(th) * Math.sin(ph) * r)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    scene.add(new THREE.Points(geo, starMat))
  }
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xf2f4f8, transparent: true, opacity: 0, fog: false })
  const moon = new THREE.Mesh(new THREE.CircleGeometry(11, 26), moonMat)
  moon.position.set(175, 165, -235)
  moon.lookAt(0, 0, 0)
  scene.add(moon)
  const moonHaloMat = new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const moonHalo = new THREE.Sprite(moonHaloMat)
  moonHalo.scale.set(46, 46, 1)
  moonHalo.position.copy(moon.position)
  scene.add(moonHalo)

  function applyNightFrame(): void {
    const nb = nightBlend
    sun.intensity = L(1.5, 0.26, nb)
    sun.color.copy(sunDayC).lerp(sunNightC, nb)
    hemi.intensity = L(HEMI_DAY, HEMI_NIGHT, nb)
    hemi.color.copy(hemiDayC).lerp(hemiNightC, nb)
    hemi.groundColor.copy(gDayC).lerp(gNightC, nb)
    fillLight.intensity = L(0.3, 0.14, nb)
    fog.color.copy(fogDayC).lerp(fogNightC, nb)
    for (const m of facadeMats) m.emissiveIntensity = nb * 1.1
    matGlassDk.emissiveIntensity = nb * 0.9
    matTrainW.emissiveIntensity = nb * 1.2
    glowMat.opacity = nb * 0.85
    spotMat.opacity = nb * 0.55
    starMat.opacity = nb * 0.9
    moonMat.opacity = nb * 0.95
    moonHaloMat.opacity = nb * 0.22
    groundMat.color.copy(groundDayC).lerp(groundNightC, nb)
    paveMat.color.copy(paveDayC).lerp(paveNightC, nb)
    matWater.color.copy(waterDayC).lerp(waterNightC, nb)
    matCrowd.color.copy(crowdDayC).lerp(crowdNightC, nb)
    cloudMat.color.copy(cloudDayC).lerp(cloudNightC, nb)
    if ((nb > 0.5) !== lampLit) {
      lampLit = nb > 0.5
      matLampHead.color.setHex(lampLit ? 0xdfefff : 0xf6f2df)
    }
  }

  // ============================================
  // 14) Animation loop
  // ============================================
  const clock = new THREE.Clock()
  let t = 0,
    frame = 0
  let rafId = -1
  let running = false
  let disposed = false

  function loop(): void {
    if (!running || disposed) return
    rafId = requestAnimationFrame(loop)
    const dt = Math.min(clock.getDelta(), 0.05)
    t += dt
    frame++

    for (const c of cars) {
      if (c.ax === 'x') {
        c.g.position.x += c.dir * c.speed * dt
        if (c.g.position.x > c.bound) c.g.position.x = -c.bound
        if (c.g.position.x < -c.bound) c.g.position.x = c.bound
      } else {
        c.g.position.z += c.dir * c.speed * dt
        if (c.g.position.z > c.bound) c.g.position.z = -c.bound
        if (c.g.position.z < -c.bound) c.g.position.z = c.bound
      }
    }
    for (const rc of ringCars) {
      rc.a += rc.va * dt
      rc.g.position.set(Math.cos(rc.a) * rc.r, 0, Math.sin(rc.a) * rc.r)
      rc.g.rotation.y = -rc.a + (rc.va > 0 ? 0 : Math.PI)
    }
    for (const cg of clouds) {
      cg.g.position.x += cg.speed * dt
      if (cg.g.position.x > 260) cg.g.position.x = -260
    }
    // river current
    {
      const posAttr = flowPts.geometry.getAttribute('position')
      const fa = posAttr.array as Float32Array
      const seeds = flowPts.userData.seeds as { u: number; lat: number }[]
      for (const [fq, seed] of seeds.entries()) {
        const u = (seed.u + t * 0.012) % 0.9
        const rp = riverPos(u)
        fa[fq * 3] = rp[0]
        fa[fq * 3 + 1] = -1.15
        fa[fq * 3 + 2] = rp[1]
      }
      posAttr.needsUpdate = true
    }

    trainG.position.z = 68 * Math.sin(t * 0.085)
    elevCab.position.y = 4.2 + 3 * Math.sin(t * 0.35)
    const pa = t * 0.055
    planeG.position.set(Math.cos(pa) * 118, 56 + Math.sin(t * 0.3) * 3, Math.sin(pa) * 118)
    planeG.lookAt(Math.cos(pa + 0.06) * 118, 56, Math.sin(pa + 0.06) * 118)
    planeBeacon.material.opacity = nightBlend * (0.35 + 0.65 * Math.abs(Math.sin(t * 4)))

    for (const pts of crowds) {
      const posAttr = pts.geometry.getAttribute('position')
      const arr = posAttr.array as Float32Array
      if (pts.userData.isFountain) {
        const ph = pts.userData.ph as number[]
        const fx = pts.userData.fx as number
        const fz = pts.userData.fz as number
        for (const [k, phase] of ph.entries()) {
          const cyc = (t * 0.55 + phase) % 1
          const ang = phase * 23
          const rad = 0.25 + cyc * 1.05
          arr[k * 3] = fx + Math.cos(ang) * rad
          arr[k * 3 + 1] = 2.5 + cyc * 2.3
          arr[k * 3 + 2] = fz + Math.sin(ang) * rad
        }
      } else {
        const php = pts.userData.ph as number[]
        const y0 = pts.userData.y0 as number
        for (let k = 0; k < php.length; k++) {
          const phase = php[k]
          if (phase === undefined) continue
          arr[k * 3 + 1] = y0 + 0.3 + Math.abs(Math.sin(t * 2 + phase)) * 0.25
        }
      }
      posAttr.needsUpdate = true
    }

    if (selected) {
      const dims = selected.dims
      const ring = dims ? (dims.userData.ring as THREE.Mesh | undefined) : undefined
      if (ring) {
        ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06)
        matRing.opacity = 0.42 + 0.22 * Math.sin(t * 3)
      }
      if (selected.dynamic) {
        selected.cx = trainG.position.x
        selected.cz = trainG.position.z
        fitBox(selBox, selected, 0.5)
        fitBox(selFill, selected, 0.45)
      }
    }
    if (mouseMoved) {
      mouseMoved = false
      updateHover()
    }

    if (Math.abs(targetNight - nightBlend) > 0.0008) {
      nightBlend += (targetNight - nightBlend) * Math.min(1, dt * 1.1)
      applyNightFrame()
      cb.onNight?.(nightBlend, targetNight === 1)
    }

    if (mode === 'intro') {
      introT += dt
      if (introT < 9) introPath(introT)
      else breakIntro()
    } else {
      if (selected) {
        const b = selected
        if (b.dynamic) {
          b.cx = trainG.position.x
          b.cz = trainG.position.z
        }
        wantTarget.set(b.cx, b.fy !== undefined ? b.fy : b.h * 0.45, b.cz)
      } else wantTarget.set(0, 6, 0)
      const kT = 1 - Math.exp(-(selected && selected.dynamic ? 3.5 : 2.2) * dt)
      camTarget.lerp(wantTarget, kT)
      camRadius += (wantRadius - camRadius) * (1 - Math.exp(-2.5 * dt))
      const wantBlend = !manual && t - inputT > 3 ? 1 : 0
      autoBlend += (wantBlend - autoBlend) * Math.min(1, dt * (manual ? 8 : 1.4))
      camState.theta += 0.05 * autoBlend * dt
      const sp = Math.sin(camState.phi)
      camera.position.set(
        camTarget.x + camRadius * sp * Math.sin(camState.theta),
        camTarget.y + camRadius * Math.cos(camState.phi),
        camTarget.z + camRadius * sp * Math.cos(camState.theta)
      )
      camera.lookAt(camTarget)
    }

    if (frame % 8 === 0) {
      const hd = (Math.atan2(camera.position.x, camera.position.z) * 180) / Math.PI
      const camText =
        ('000' + Math.round((hd + 360) % 360)).slice(-3) + '° · ALT ' + ('000' + Math.round(camera.position.y)).slice(-3) + 'M'
      const gx = Math.round(groundX),
        gz = Math.round(groundZ)
      const curText =
        (gx >= 0 ? 'X+' : 'X-') +
        ('000' + Math.abs(gx)).slice(-3) +
        ' · ' +
        (gz >= 0 ? 'Z+' : 'Z-') +
        ('000' + Math.abs(gz)).slice(-3)
      cb.onHud?.(camText, curText)
    }

    renderer.render(scene, camera)
  }
  function startLoop(): void {
    if (running || disposed) return
    running = true
    clock.getDelta() // flush the pause gap so dt resumes clean
    rafId = requestAnimationFrame(loop)
  }
  function stopLoop(): void {
    running = false
    if (rafId !== -1) cancelAnimationFrame(rafId)
    rafId = -1
  }

  // ---- Engine API ----
  function setActive(on: boolean): void {
    if (active === on) return
    active = on
    if (on) startLoop()
    else stopLoop()
  }
  function setMobile(on: boolean): void {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, on ? 1.5 : 2))
    sun.shadow.mapSize.set(on ? 1024 : 2048, on ? 1024 : 2048)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
  }
  function toggleManual(): void {
    setManual(!manual)
  }
  function zoomBy(f: number): void {
    // On-screen ± buttons (touch discoverability): the same radius clamp
    // the wheel/pinch path applies, with the intro broken so a zoom on the
    // tour path hands control over immediately.
    breakIntro()
    wantRadius = clamp(wantRadius * f, minR(), 300)
    inputT = t
  }
  function toggleNight(): void {
    targetNight = targetNight ? 0 : 1
    cb.onNight?.(nightBlend, targetNight === 1)
  }
  function replayTour(): void {
    deselect()
    setManual(false)
    mode = 'intro'
    introT = 0
    camera.position.set(0, 95, 170)
    curLook.set(0, 20, 60)
    camera.lookAt(curLook)
  }
  function nudge(dxPx: number, dyPx: number): void {
    breakIntro()
    camState.theta -= dxPx * 0.0048
    camState.phi = clamp(camState.phi - dyPx * 0.0048, 0.15, 1.35)
    inputT = t
  }
  function disposeInner(): void {
    if (disposed) return
    disposed = true
    stopLoop()
    dom.removeEventListener('pointerdown', onPointerDown)
    dom.removeEventListener('pointermove', onPointerMove)
    dom.removeEventListener('pointerup', onPointerUp)
    dom.removeEventListener('pointercancel', endPtr)
    dom.removeEventListener('wheel', onWheel)
    // dispose every geometry / material / texture in the graph (materials
    // and textures are shared across meshes — dispose is idempotent)
    type Disposable = {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    scene.traverse(function (o) {
      const d = o as unknown as Disposable
      if (d.geometry) d.geometry.dispose()
      if (d.material) {
        const mats = Array.isArray(d.material) ? d.material : [d.material]
        for (const m of mats) {
          const mm = m as THREE.MeshPhongMaterial
          if (mm.map) mm.map.dispose()
          if (mm.emissiveMap) mm.emissiveMap.dispose()
          m.dispose()
        }
      }
    })
    baseTextures.forEach(function (tx) {
      tx.dispose()
    })
  }

  // First frame at the top of the tour, then readiness — the React loader
  // fades out ~700ms after this (authored safeStart cadence).
  introPath(0)
  renderer.render(scene, camera)
  cb.onReady?.()
  if (active) startLoop()

  return {
    setActive,
    setMobile,
    toggleManual,
    setManual,
    toggleNight,
    replayTour,
    nudge,
    zoomBy,
    deselect,
    dispose: disposeInner,
  }
}
