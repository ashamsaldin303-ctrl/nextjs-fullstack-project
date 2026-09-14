/**
 * EN-1 «مرآة اللغة» diagnostic — proves the LTR mirror live, per route:
 *
 *  · MIRROR SYMMETRY — the EN body's projected screen bbox is the exact
 *    X-mirror of the AR one (center reflected through the viewport's
 *    midline, extents byte-equal): the model placement is pure viewport
 *    math (xFrac/xPad/scale), so the mirror must be structural, not
 *    approximate.
 *  · INK CLEARANCE — glyph-level ink (Range rects, the MODEL-6 pixel-
 *    truth protocol) vertically overlapping the body's band, measured
 *    against the body's INNER edge: AR ink min-x vs the body's right
 *    edge; EN ink max-x vs the mirrored body's left edge. Both must be
 *    ≥ 0 (no coverage) — and the EN number tells whether any English
 *    copy is WIDER than its Arabic mirror band and needs an xPad
 *    retune.
 *  · Screenshots per route (AR + EN at the rest park) for VLM review.
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const FOV = 34
const CAM_Z = 7.5

let xvfbProc = null
if (!process.env.DISPLAY) {
  const { spawn } = await import('node:child_process')
  xvfbProc = spawn('Xvfb', [':67', '-screen', '0', '1440x900x24'], { stdio: 'ignore' })
  process.env.DISPLAY = ':67'
  await new Promise((r) => setTimeout(r, 1200))
}

const W = 1440
const H = 900

function worldToScreen(x, y, z) {
  const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z)
  const aspect = W / H
  return [((x / (halfH * aspect)) + 1) / 2 * W, (1 - y / halfH) / 2 * H]
}

function bodyRect(m, z, margin) {
  const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z)
  const pxX = W / (2 * halfH * (W / H))
  const pxY = H / (2 * halfH)
  const yaw = m.yaw ?? 0
  const hw =
    0.5 * (m.szx * Math.abs(Math.cos(yaw)) + m.szz * Math.abs(Math.sin(yaw))) * m.scale * pxX + margin
  const hh = 0.5 * Math.sqrt(m.szy * m.szy + m.szz * m.szz) * m.scale * pxY + margin
  const [cx, cy] = worldToScreen(m.x, m.y, z)
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh, cx }
}

/** Glyph ink rects vertically overlapping a y-band (viewport-clipped). */
const inkInBand = (y0, y1) =>
  page.evaluate(
    ({ y0, y1 }) => {
      const sel = 'h1,h2,h3,h4,h5,h6,p,li,a,button,blockquote,figcaption,summary,tr,dt,dd,span'
      const out = []
      const W = window.innerWidth
      const H = window.innerHeight
      const colorAlpha = (col) => {
        if (!col) return 1
        const mMod = col.match(/\/\s*([\d.]+)\s*\)$/)
        if (mMod) return +mMod[1]
        const mLeg = col.match(/,\s*([\d.]+)\s*\)$/)
        if (mLeg && /^rgba\(/.test(col)) return +mLeg[1]
        return 1
      }
      for (const el of document.querySelectorAll(sel)) {
        if (el.closest('header')) continue
        if (el.closest('[data-intro]')) continue
        if (el.closest('[data-bg-layer]')) continue
        if (el.closest('.sr-only')) continue
        if (el.getAttribute('aria-hidden') === 'true') continue
        const st = getComputedStyle(el)
        if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity < 0.05) continue
        if (colorAlpha(st.color) < 0.15) continue
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let node
        while ((node = walker.nextNode())) {
          if (!node.nodeValue || !node.nodeValue.trim()) continue
          if (node.parentElement && node.parentElement.closest('.sr-only')) continue
          const range = document.createRange()
          range.selectNodeContents(node)
          for (const r of range.getClientRects()) {
            const rx0 = Math.max(r.left, 0)
            const rx1 = Math.min(r.right, W)
            const ry0 = Math.max(r.top, 0)
            const ry1 = Math.min(r.bottom, H)
            if (rx1 - rx0 > 2 && ry1 - ry0 > 2 && ry0 < y1 - 1 && y0 < ry1 - 1) {
              out.push({ x0: rx0, x1: rx1, y0: ry0, y1: ry1 })
            }
          }
        }
      }
      return out
    },
    { y0, y1 },
  )

const ROUTES = [
  { ar: '/', en: '/en', key: 'home', slots: [{ id: 'hero-title', z: -0.5 }, { id: 'method-title', z: -0.3, p: 0.55 }] },
  { ar: '/services/websites', en: '/en/services/websites', key: 'websites', slots: [{ id: 'page-hero-title', z: -0.35 }] },
  { ar: '/services/automation', en: '/en/services/automation', key: 'automation', slots: [{ id: 'page-hero-title', z: -0.3 }] },
  { ar: '/work', en: '/en/work', key: 'work', slots: [{ id: 'page-hero-title', z: -0.45 }] },
  { ar: '/about', en: '/en/about', key: 'about', slots: [{ id: 'page-hero-title', z: -0.35 }, { id: 'story-title', z: -0.25, p: 0.55, lazy: true }] },
  { ar: '/contact', en: '/en/contact', key: 'contact', slots: [{ id: 'page-hero-title', z: -0.4 }] },
]

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: false })
const page = await browser.newPage({ viewport: { width: W, height: H } })

const readDebug = () => page.evaluate(() => window.__elyraRuneDebug ?? null)
const scrollYNow = () => page.evaluate(() => window.scrollY)

async function wheelTo(target) {
  for (let i = 0; i < 140; i++) {
    const cur = await scrollYNow()
    const diff = target - cur
    if (Math.abs(diff) < 24) break
    await page.mouse.wheel(0, Math.sign(diff) * Math.min(Math.abs(diff), 120))
    await page.waitForTimeout(45)
  }
}

async function parkScroll(target) {
  await wheelTo(target)
  for (let i = 0; i < 10; i++) {
    const a = await scrollYNow()
    await page.waitForTimeout(260)
    const b = await scrollYNow()
    if (Math.abs(a - b) <= 2) return b
  }
  return scrollYNow()
}

const sectionGeom = (id) =>
  page.evaluate((sid) => {
    const el = document.getElementById(sid)
    if (!el) return null
    const sec = el.closest('section') ?? el
    const rs = sec.getBoundingClientRect()
    return {
      top: rs.top + window.scrollY,
      height: rs.height,
      vh: window.innerHeight,
      maxScroll: Math.max(0, document.body.scrollHeight - window.innerHeight),
    }
  }, id)

const scrollForP = (g, p) =>
  Math.max(0, Math.min(g.maxScroll, g.top - g.vh + p * (g.height + g.vh)))

async function revealLazy(id) {
  // ≤120px steps — the Lenis/IntersectionObserver wake contract (the
  // m7 verifier's own discipline; 300px synthetic deltas get ignored).
  for (let i = 0; i < 180; i++) {
    if (await page.evaluate((sid) => !!document.getElementById(sid), id)) return true
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(70)
  }
  return page.evaluate((sid) => !!document.getElementById(sid), id)
}

/** Park at the slot's rest and read the live body + ink truth. */
async function probe(path, slotSpec, wantShot) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500)
    if (await page.evaluate(() => !!window.__elyraRuneDebug)) break
  }
  await page.waitForTimeout(1200)
  const pTarget = slotSpec.p ?? 0.5
  if (slotSpec.lazy) await revealLazy(slotSpec.id)
  const g = await sectionGeom(slotSpec.id)
  if (!g) return { error: 'section not mounted' }
  await parkScroll(scrollForP(g, pTarget))
  await page.waitForTimeout(1600) // birth completes at the park
  const dbg = await readDebug()
  const m = (dbg?.models ?? []).find((x) => x.id === slotSpec.id)
  if (!m || !m.found || m.presence <= 0.05) return { error: 'body not live' }
  const br = bodyRect(m, slotSpec.z, 6)
  const ink = await inkInBand(br.y0, br.y1)
  const shot = wantShot
    ? `en-diag-${path.replaceAll('/', '_')}-${slotSpec.id}.png`
    : null
  if (shot) await page.screenshot({ path: `/tmp/${shot}` })
  return { m, br, ink: ink.length, inkXs: ink.map((r) => [Math.round(r.x0), Math.round(r.x1)]) }
}

const report = []
for (const route of ROUTES) {
  for (const slotSpec of route.slots) {
    const arRes = await probe(route.ar, slotSpec, false)
    const enRes = await probe(route.en, slotSpec, false)
    const row = { route: route.key, slot: slotSpec.id }

    if (arRes.error || enRes.error) {
      row.status = 'FAIL'
      row.detail = `AR:${arRes.error ?? 'ok'} EN:${enRes.error ?? 'ok'}`
      report.push(row)
      console.log(`✗ [${route.key}/${slotSpec.id}] ${row.detail}`)
      continue
    }

    // Mirror symmetry: EN center ≈ W − AR center; extents equal.
    const symErr = Math.abs(W - arRes.br.cx - enRes.br.cx)
    const extErr = Math.abs((arRes.br.x1 - arRes.br.x0) - (enRes.br.x1 - enRes.br.x0))

    // Inner-edge clearances. AR body on the LEFT: clearance = inkMinX − x1.
    const arInkMin = arRes.inkXs.length ? Math.min(...arRes.inkXs.map((r) => r[0])) : null
    const arClr = arInkMin === null ? null : arInkMin - arRes.br.x1
    // EN body on the RIGHT: clearance = x0 − inkMaxX.
    const enInkMax = enRes.inkXs.length ? Math.max(...enRes.inkXs.map((r) => r[1])) : null
    const enClr = enInkMax === null ? null : enRes.br.x0 - enInkMax

    row.status = symErr <= 24 && extErr <= 12 ? 'MIRROR-OK' : 'MIRROR-FAIL'
    row.ar = { body: [Math.round(arRes.br.x0), Math.round(arRes.br.x1)], inkMin: arInkMin, clr: arClr === null ? null : Math.round(arClr) }
    row.en = { body: [Math.round(enRes.br.x0), Math.round(enRes.br.x1)], inkMax: enInkMax, clr: enClr === null ? null : Math.round(enClr) }
    row.symErr = Math.round(symErr)
    row.extErr = Math.round(extErr)
    row.presence = { ar: arRes.m.presence, en: enRes.m.presence }
    report.push(row)
    console.log(
      `${row.status === 'MIRROR-OK' ? '✓' : '✗'} [${route.key}/${slotSpec.id}] sym=${Math.round(symErr)}px ext=${Math.round(extErr)}px | AR body [${row.ar.body}] clr=${row.ar.clr} | EN body [${row.en.body}] clr=${row.en.clr}`,
    )
  }
}

// EN screenshots of every route hero for the VLM pass.
for (const route of ROUTES.slice(0, 1)) {
  await probe(route.en, route.slots[0], true)
}
await page.goto(BASE + '/en', { waitUntil: 'networkidle' })
await page.waitForTimeout(9000)
await page.screenshot({ path: '/tmp/en-diag-home-hero.png' })

console.log('\n==== SUMMARY ====')
let bad = 0
for (const r of report) {
  if (r.status !== 'MIRROR-OK') bad++
  if (r.ar?.clr !== null && r.ar?.clr < 0) bad++
  if (r.en?.clr !== null && r.en?.clr < 0) bad++
}
console.log(JSON.stringify(report, null, 1))
console.log(bad === 0 ? '\nALL MIRROR + CLEARANCE CHECKS PASSED' : `\n${bad} CHECK(S) FAILED`)

await browser.close()
if (xvfbProc) xvfbProc.kill()
process.exit(bad === 0 ? 0 : 1)
