/**
 * EN-2 · MOBILE FEASIBILITY PROBE («تحليل ورؤية إمكانية إضافة المجسمات
 * على الموبايل بريفيو») — an HONEST experiment, not an implementation:
 * defeat the mobile-tier gate at the source (matchMedia) so the FULL rune
 * field mounts inside the real 390×844 mobile layout, then measure:
 *
 *  · PERF — mount time, SwiftShader fps at rest (alive bodies ⇒ the
 *    demand loop renders) and under wheeling (software GL = the
 *    pessimistic bound for low-end hardware; real phones run hardware
 *    GL and will only be faster).
 *  · GEOMETRY — where the DESKTOP slot table places the bodies at a
 *    390px viewport (expect: over the reading column — the mobile hero
 *    text spans nearly the full width; the desktop edge-band premise
 *    does not exist here).
 *  · FREE SPACE — the mobile hero's own whitespace bands (above/below
 *    the text block) — the honest room a mobile-native composition
 *    could use.
 *  · VLM screenshot for the composition truth.
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const W = 390
const H = 844

let xvfbProc = null
if (!process.env.DISPLAY) {
  const { spawn } = await import('node:child_process')
  xvfbProc = spawn('Xvfb', [':70', '-screen', '0', '390x844x24'], { stdio: 'ignore' })
  process.env.DISPLAY = ':70'
  await new Promise((r) => setTimeout(r, 1200))
}

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: false })
const ctx = await browser.newContext({ viewport: { width: W, height: H } })

// Defeat the tier gate at the source — the rune field (and every other
// tiered canvas) mounts inside the real mobile layout.
await ctx.addInitScript(() => {
  const orig = window.matchMedia.bind(window)
  window.matchMedia = (q) => {
    if (q.includes('max-width: 767px') || q.includes('pointer: coarse')) {
      const stub = orig('(min-width: 0)')
      Object.defineProperty(stub, 'matches', { get: () => false })
      return stub
    }
    return orig(q)
  }
})

const page = await ctx.newPage()
const t0 = Date.now()
await page.goto(BASE + '/', { waitUntil: 'networkidle' })

let mountedAt = null
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500)
  if (await page.evaluate(() => !!window.__elyraRuneDebug)) { mountedAt = Date.now() - t0; break }
}
console.log(`\n[mount] rune field mounted in ${mountedAt}ms (incl. idle-gate 2.5s + chunk fetch)`)

await page.waitForTimeout(4000) // birth completes

const rest = await page.evaluate(() => {
  const d = window.__elyraRuneDebug
  const hero = document.getElementById('hero-title')
  const sec = hero?.closest('section')
  const rs = sec?.getBoundingClientRect()
  // glyph ink of the hero text block (Range truth)
  const sel = 'h1,h2,p,a,button,span'
  const rects = []
  for (const el of sec.querySelectorAll(sel)) {
    if (el.closest('[data-bg-layer]') || el.getAttribute('aria-hidden') === 'true') continue
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || +st.opacity < 0.05) continue
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      if (!node.nodeValue?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) rects.push(r)
    }
  }
  const ink = {
    x0: Math.min(...rects.map((r) => r.left)),
    x1: Math.max(...rects.map((r) => r.right)),
    y0: Math.min(...rects.map((r) => r.top)),
    y1: Math.max(...rects.map((r) => r.bottom)),
  }
  return {
    fps: d.fps, frames: d.frames, life: d.life, dir: d.dir,
    vh: window.innerHeight, vw: window.innerWidth,
    heroH: rs?.height, heroTop: rs?.top,
    ink, inkCount: rects.length,
    scrollY: window.scrollY,
    models: d.models.map((m) => ({ id: m.id, p: m.p, fy: m.fy, x: m.x, y: m.y, scale: m.scale, szx: m.szx, szy: m.szy, szz: m.szz, presence: m.presence, build: m.build })),
  }
})

// projected screen bbox at 390×844 (same rig as the verifier)
const FOV = 34, CAM_Z = 7.5
function bodyRectMobile(m, z) {
  const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z)
  const pxX = W / (2 * halfH * (W / H))
  const pxY = H / (2 * halfH)
  const yaw = 0.3
  const hw = 0.5 * (m.szx * Math.abs(Math.cos(yaw)) + m.szz * Math.abs(Math.sin(yaw))) * m.scale * pxX
  const hh = 0.5 * Math.sqrt(m.szy * m.szy + m.szz * m.szz) * m.scale * pxY
  const cx = ((m.x / (halfH * (W / H))) + 1) / 2 * W
  const cy = (1 - m.y / halfH) / 2 * H
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }
}

console.log(`[perf] SwiftShader fps≈${rest.fps.toFixed(1)} · frames=${rest.frames} · life=${rest.life}s`)
console.log(`[hero ] section ${Math.round(rest.heroH)}px tall · text ink x[${Math.round(rest.ink.x0)}..${Math.round(rest.ink.x1)}] y[${Math.round(rest.ink.y0)}..${Math.round(rest.ink.y1)}] (${rest.inkCount} glyph rects)`)
console.log(`[free ] ABOVE text: ${Math.round(rest.ink.y0 - rest.heroTop)}px · BELOW text (to hero bottom): ${Math.round(rest.heroTop + rest.heroH - rest.ink.y1)}px`)

for (const m of rest.models) {
  if (m.presence < 0.05) continue
  const z = -0.5
  const br = bodyRectMobile(m, z)
  const overlapX = br.x0 < rest.ink.x1 && rest.ink.x0 < br.x1
  const overlapY = br.y0 < rest.ink.y1 && rest.ink.y0 < br.y1
  console.log(
    `[body ] ${m.id}: presence=${m.presence.toFixed(2)} build=${m.build} → screen [${Math.round(br.x0)},${Math.round(br.y0)}..${Math.round(br.x1)},${Math.round(br.y1)}] (w=${Math.round(br.x1 - br.x0)}px h=${Math.round(br.y1 - br.y0)}px) ${overlapX && overlapY ? '⚠️ OVERLAPS the text ink' : 'clear of ink'}`,
  )
}

// wheel-scroll perf (the demand loop under input)
for (let i = 0; i < 12; i++) {
  await page.mouse.wheel(0, 80)
  await page.waitForTimeout(120)
}
await page.waitForTimeout(1500)
const during = await page.evaluate(() => window.__elyraRuneDebug.fps)
console.log(`[perf] after scroll burst: fps≈${during.toFixed(1)}`)

await page.screenshot({ path: '/tmp/mobile-feasibility-home.png' })
console.log('[shot ] /tmp/mobile-feasibility-home.png')

await browser.close()
if (xvfbProc) xvfbProc.kill()
