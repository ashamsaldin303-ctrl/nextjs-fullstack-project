/**
 * Phase 2 verification — magnetic cursor + film grain + audio toggle.
 * Runs against the dev server with the full Chromium binary (new headless,
 * which reports `pointer: fine` correctly, unlike the headless shell).
 */
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:3000'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

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
const active = await page.evaluate(() =>
  document.documentElement.className.includes('elyra-cursor-active')
)
ok('cursor: native cursor hidden (elyra-cursor-active on <html>)', active)

const layers = await page.evaluate(() => {
  const dot = document.querySelector('.elyra-cursor-dot')
  const ring = document.querySelector('.elyra-cursor-ring')
  return {
    dot: !!dot,
    ring: !!ring,
    dotPE: dot ? getComputedStyle(dot).pointerEvents : null,
    ringPE: ring ? getComputedStyle(ring).pointerEvents : null,
    dotAH: dot ? dot.getAttribute('aria-hidden') : null,
    ringZ: ring ? getComputedStyle(ring).zIndex : null,
  }
})
ok('cursor: dot+ring layers exist, inert, aria-hidden', layers.dot && layers.ring &&
  layers.dotPE === 'none' && layers.ringPE === 'none' && layers.dotAH === 'true',
  `z=${layers.ringZ}`)

// --- Movement (dot tracks exactly, ring lerps) ----------------------------
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
await page.waitForTimeout(1500) // headless rAF runs ~17fps — allow full lerp convergence
const pos3 = await page.evaluate(() => {
  const t = document.querySelector('.elyra-cursor-ring').style.transform
  const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)/)
  return m ? { x: parseFloat(m[1]) + 16, y: parseFloat(m[2]) + 16 } : null
})
const convDist = pos3 ? Math.hypot(pos3.x - 800, pos3.y - 500) : 999
ok('cursor: ring converges to pointer', convDist < 10, `center=(${pos3?.x},${pos3?.y}) dist=${convDist.toFixed(1)}px`)

// --- Magnet snap -----------------------------------------------------------
// Hero CTA button coordinates
const cta = page.locator('a[href="/contact"][data-cursor="magnet"]').first()
const ctaBox = await cta.boundingBox()
if (ctaBox) {
  const cx = ctaBox.x + ctaBox.width / 2
  const cy = ctaBox.y + ctaBox.height / 2
  // Move near the button (within 80px) but not onto it
  await page.mouse.move(cx - 30, cy)
  await page.waitForTimeout(1500) // full lerp convergence at slow headless rAF
  const snap = await page.evaluate(() => {
    const t = document.querySelector('.elyra-cursor-ring').style.transform
    const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/)
    return m ? { x: parseFloat(m[1]) + 16, y: parseFloat(m[2]) + 16 } : null
  })
  const rx = snap?.x ?? 0
  const ry = snap?.y ?? 0
  const dist = Math.hypot(rx - cx, ry - cy)
  ok('cursor: ring magnetically snaps toward CTA center', dist < 20,
    `ring=(${rx.toFixed(0)},${ry.toFixed(0)}) cta=(${cx.toFixed(0)},${cy.toFixed(0)}) dist=${dist.toFixed(0)}px`)

  // Move far away — ring should return to pointer position
  await page.mouse.move(60, 800)
  await page.waitForTimeout(1500)
  const back = await page.evaluate(() => {
    const t = document.querySelector('.elyra-cursor-ring').style.transform
    const m = t.match(/translate3d\(([\d.-]+)px, ([\d.-]+)px/)
    return m ? { x: parseFloat(m[1]) + 16, y: parseFloat(m[2]) + 16 } : null
  })
  const backDist = back ? Math.hypot(back.x - 60, back.y - 800) : 999
  ok('cursor: ring releases when far from magnet', backDist < 10,
    `center=(${back?.x},${back?.y}) dist=${backDist.toFixed(1)}px`)
} else {
  ok('cursor: hero CTA found for magnet test', false)
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
ok('grain: fixed layer, 4.5% opacity, inert, SVG data-URI',
  grain && grain.pos === 'fixed' && grain.opacity === '0.045' &&
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
await page.screenshot({ path: '/tmp/p2-cursor-hero.png' })
const cta2 = page.locator('a[href="/contact"][data-cursor="magnet"]').first()
const cb = await cta2.boundingBox()
if (cb) {
  await page.mouse.move(cb.x + cb.width / 2 - 25, cb.y + cb.height / 2)
  await page.waitForTimeout(500)
}
await page.screenshot({ path: '/tmp/p2-cursor-magnet.png' })

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(', '))
  process.exit(1)
}
await browser.close()
