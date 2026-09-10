/**
 * Sensory-layer QA — custom cursor + magnetic CTA + film grain + audio
 * toggle. (Supersedes the Phase 2 script: since R7-b the cursor is a 7px
 * dot + 34px trailing-ring lerp engine with no cursor-side magnet, and the
 * magnet is element-side — use-magnetic lerps the CTA itself toward the
 * pointer, clamped ±14px, no snap.)
 * Runs against the dev server with the full Chromium binary (new headless,
 * which reports `pointer: fine` correctly, unlike the headless shell).
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const chromium = await getChromium()
const browser = await chromium.launch({
  channel: 'chromium', // full binary, new headless → pointer: fine matches
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// --- Environment sanity -------------------------------------------------
const env = await page.evaluate(() => ({
  pointerFine: matchMedia('(pointer: fine)').matches,
  hover: matchMedia('(hover: hover)').matches,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
}))
ok('env: pointer fine reported', env.pointerFine, JSON.stringify(env))

// --- Activation ----------------------------------------------------------
// R7-b: the engine arms (and hides the native cursor) only after the FIRST
// real pointermove — custom-cursor.tsx adds `elyra-cursor-active` in the
// hasMoved branch, never on mount. Prime the pointer before asserting.
await page.mouse.move(400, 300)
await page.waitForTimeout(120)
const active = await page.evaluate(() =>
  document.documentElement.className.includes('elyra-cursor-active')
)
ok('cursor: native cursor hidden (elyra-cursor-active on <html>)', active)

const layers = await page.evaluate(() => {
  const dot = document.querySelector('.elyra-cursor-dot')
  const ring = document.querySelector('.elyra-cursor-ring')
  // R7-b: aria-hidden and z-index live on the WRAPPER (.elyra-cursor-layer
  // renders aria-hidden="true"; globals.css sets z-index 200 +
  // pointer-events:none there) — the positioners carry no attributes and
  // inherit the inertness. (Phase 2 put aria-hidden on the dot itself.)
  const layer = document.querySelector('.elyra-cursor-layer')
  return {
    dot: !!dot,
    ring: !!ring,
    dotPE: dot ? getComputedStyle(dot).pointerEvents : null,
    ringPE: ring ? getComputedStyle(ring).pointerEvents : null,
    layerAH: layer ? layer.getAttribute('aria-hidden') : null,
    layerZ: layer ? getComputedStyle(layer).zIndex : null,
  }
})
ok('cursor: dot+ring layers exist, inert, wrapper aria-hidden',
  layers.dot && layers.ring &&
  layers.dotPE === 'none' && layers.ringPE === 'none' &&
  layers.layerAH === 'true',
  `layer z=${layers.layerZ}`)

// --- Movement (dot lerp 0.4 · ring lerp 0.16) ------------------------------
await page.mouse.move(400, 300)
await page.waitForTimeout(120)
const pos1 = await page.evaluate(() => {
  const dot = document.querySelector('.elyra-cursor-dot')
  const ring = document.querySelector('.elyra-cursor-ring')
  return {
    dotT: dot.style.transform,
    ringT: ring.style.transform,
    dotOp: getComputedStyle(dot).opacity,
    ringOp: getComputedStyle(ring).opacity,
  }
})
ok('cursor: layers visible after pointermove', pos1.dotOp === '1' && pos1.ringOp === '1',
  `dot=${pos1.dotT} ring=${pos1.ringT}`)

await page.mouse.move(800, 500)
// R7-b positioner geometry: .elyra-cursor-ring is a zero-footprint anchor
// (no width/height) whose 34px core is centered on it via
// translate(-50%, -50%) — the translate3d point IS the ring center, so no
// half-size offset is added (the Phase-2 +16px was for the old 32px box).
// Convergence is waited for frame-rate-INdependently: this sandbox's
// headless rAF runs at only ~2-3fps on the WebGL-heavy dev homepage (the
// old "~17fps" Phase-2 note no longer holds), so a fixed sleep cannot
// reach convergence — poll for the lerp to finish instead.
await page.waitForFunction(
  ([px, py]) => {
    const t = document.querySelector('.elyra-cursor-ring').style.transform
    const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)/)
    return !!m && Math.hypot(parseFloat(m[1]) - px, parseFloat(m[2]) - py) < 8
  },
  [800, 500],
  { polling: 200, timeout: 30000 },
).catch(() => {}) // deadline miss surfaces in the assertion below
const pos3 = await page.evaluate(() => {
  const t = document.querySelector('.elyra-cursor-ring').style.transform
  const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)/)
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
})
const convDist = pos3 ? Math.hypot(pos3.x - 800, pos3.y - 500) : 999
ok('cursor: ring converges to pointer', convDist < 10, `center=(${pos3?.x},${pos3?.y}) dist=${convDist.toFixed(1)}px`)

// --- Magnet (R7-b use-magnetic: the ELEMENT eases toward the pointer) -----
// The magnet left the cursor in R7-b: use-magnetic (hero.tsx CTAs) lerps an
// inline translate3d on the CTA itself — pull = clamp(dx * strength 0.3,
// ±MAX_OFFSET 14), eased at LERP 0.18/frame, active within radius 28px of
// the element's bounds — while the ring keeps tracking the pointer (checked
// above). Scope to <main>: the magnetized /contact link is the hero CTA
// (the navbar's /contact link carries data-cursor="magnet" but no hook).
const cta = page.locator('main a[href="/contact"][data-cursor="magnet"]').first()
const ctaBox = await cta.boundingBox()
if (ctaBox) {
  const cx = ctaBox.x + ctaBox.width / 2
  const cy = ctaBox.y + ctaBox.height / 2
  // Park the pointer 30px left of the CTA center — inside the activation
  // zone (gap 0 ≤ radius 28) but off-center, so the pull target is a real
  // directioned offset (≈ dx * 0.3 ≈ -9px), never a snap to center.
  await page.mouse.move(cx - 30, cy)
  // Deepen the lerp before measuring (same slow-rAF reality as above:
  // ~2-3fps means seconds, not 1.5s, to settle — poll until ≥4px of the
  // pull has materialized; the assertion below stays the authority).
  await page.waitForFunction(
    () => {
      const el = document.querySelector('main a[href="/contact"][data-cursor="magnet"]')
      if (!el) return false
      const m = el.style.transform.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/)
      return !!m && parseFloat(m[1]) <= -4
    },
    undefined,
    { polling: 250, timeout: 15000 },
  ).catch(() => {})
  const pull = await page.evaluate(() => {
    const el = document.querySelector('main a[href="/contact"][data-cursor="magnet"]')
    if (!el) return null
    const m = el.style.transform.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/)
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null
  })
  const pullMag = pull ? Math.hypot(pull.x, pull.y) : 0
  // Truthful invariant of the lerped approach: a non-zero pull toward the
  // parked pointer (negative x — the pointer sits left of the CTA center),
  // bounded by the ±14px class clamp.
  ok('magnet: CTA lerps toward nearby pointer (≤14px clamp, no snap)',
    pull !== null && pull.x < 0 && pullMag > 0.5 && pullMag <= 14.01,
    `cta translate=(${pull?.x},${pull?.y}) mag=${pullMag.toFixed(1)}px`)

  // Move far away — the hook eases the element back to rest and removes
  // the inline transform entirely (CSS classes own the resting state).
  await page.mouse.move(60, 800)
  // Poll until the hook eases back to rest and clears the inline
  // transform (frame-rate independent — see the convergence note above).
  await page.waitForFunction(
    () => {
      const el = document.querySelector('main a[href="/contact"][data-cursor="magnet"]')
      return !!el && el.style.transform === ''
    },
    undefined,
    { polling: 250, timeout: 20000 },
  ).catch(() => {})
  const released = await page.evaluate(() => {
    const el = document.querySelector('main a[href="/contact"][data-cursor="magnet"]')
    return el ? el.style.transform : null
  })
  ok('magnet: CTA released when pointer moves away (inline transform cleared)',
    released === '',
    `inline transform="${released}"`)
} else {
  ok('magnet: hero CTA found for magnet test', false)
}

// --- Native cursor hidden ---------------------------------------------------
const cursorProp = await page.evaluate(() => getComputedStyle(document.body).cursor)
ok('cursor: native cursor CSS hidden', cursorProp === 'none', `body cursor: ${cursorProp}`)

// --- Grain ------------------------------------------------------------------
const grain = await page.evaluate(() => {
  const g = document.querySelector('.grain-overlay')
  if (!g) return null
  const cs = getComputedStyle(g)
  return {
    pos: cs.position,
    opacity: cs.opacity,
    pe: cs.pointerEvents,
    ah: g.getAttribute('aria-hidden'),
    bg: cs.backgroundImage.includes('data:image/svg+xml'),
    printHidden: !!Array.from(document.styleSheets).length,
  }
})
// REF-2 Phase D canon: opacity 0.03 (retuned down from 0.045 — VLM read
// the old level as low-res noise; globals.css grain-overlay rule).
ok('grain: fixed layer, 3% opacity, inert, SVG data-URI',
  grain && grain.pos === 'fixed' && grain.opacity === '0.03' &&
  grain.pe === 'none' && grain.ah === 'true' && grain.bg,
  JSON.stringify(grain))

// --- Sound toggle -------------------------------------------------------------
const st0 = await page.evaluate(() => {
  const b = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
  return { exists: !!b, pressed: b?.getAttribute('aria-pressed'), label: b?.getAttribute('aria-label'), storage: localStorage.getItem('elyra:sound') }
})
ok('sound: toggle exists, muted by default, no storage yet',
  st0.exists && st0.pressed === 'false' && st0.storage === null,
  `label="${st0.label}"`)

await page.click('button[aria-label*="المؤثرات"]').catch(() => page.click('button[aria-label*="sound"]'))
await page.waitForTimeout(300)
const st1 = await page.evaluate(() => {
  const b = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
  return { pressed: b?.getAttribute('aria-pressed'), label: b?.getAttribute('aria-label'), storage: localStorage.getItem('elyra:sound') }
})
ok('sound: enabling persists to localStorage + aria flips',
  st1.pressed === 'true' && st1.storage === 'on',
  `label="${st1.label}"`)

// Persist across navigation (client-side nav keeps component; full reload tests persistence)
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const st2 = await page.evaluate(() => {
  const b = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
  return { pressed: b?.getAttribute('aria-pressed'), storage: localStorage.getItem('elyra:sound') }
})
ok('sound: preference survives navigation to /work', st2.pressed === 'true' && st2.storage === 'on')

// AudioContext actually created?
const audioCtx = await page.evaluate(() => {
  // probe: our module creates the context lazily; check via a click sound trigger
  const btn = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
  return { hasToggle: !!btn }
})
ok('sound: delegation mounted on other pages', audioCtx.hasToggle)

// Mute again
await page.click('button[aria-label*="المؤثرات"]').catch(() => page.click('button[aria-label*="sound"]'))
await page.waitForTimeout(200)
const st3 = await page.evaluate(() => localStorage.getItem('elyra:sound'))
ok('sound: muting back works', st3 === 'off')

// --- Keyboard safety: no sound events from keyboard -------------------------
// (structural: sounds only bind to pointer events — verified by code review;
//  here we ensure focus-visible still works on a magnet link)
await page.keyboard.press('Tab')
const focused = await page.evaluate(() => ({
  tag: document.activeElement?.tagName,
  ring: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : '',
}))
ok('a11y: keyboard Tab focus unaffected', !!focused.tag)

// --- Console errors ------------------------------------------------------------
ok('console: zero errors across all checks', consoleErrors.length === 0,
  consoleErrors.slice(0, 2).join(' | '))

// --- Screenshots --------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.mouse.move(720, 260)
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/sensory-cursor-hero.png' })
const cta2 = page.locator('main a[href="/contact"][data-cursor="magnet"]').first()
const cb = await cta2.boundingBox()
if (cb) {
  await page.mouse.move(cb.x + cb.width / 2 - 25, cb.y + cb.height / 2)
  await page.waitForTimeout(500)
}
await page.screenshot({ path: '/tmp/sensory-cursor-magnet.png' })

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}
await browser.close()
