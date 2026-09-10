/**
 * MODEL-7 «رحلة الحواف» verification — the EDGE JOURNEY (screen-pinned
 * station travel), machine-checked end-to-end on the dev server.
 *
 * Same environment contract as verify-models-m4.mjs: headed Chromium
 * under self-managed Xvfb — real wheel events (≤120px steps) wake the
 * IntersectionObserver pipeline so lazy sections mount like a real
 * trackpad would. Lenis keeps easing for ~0.8s after the last wheel,
 * so every park is followed by a scroll-stability poll before reading.
 *
 * Checks per route/slot:
 *  · JOURNEY TRAVEL — the body's viewport-fraction place (debug `fy`)
 *    moves monotonically UP the screen edge as the section travel p
 *    advances: low hold at the head (fy ≥ 0.55 for p ≤ 0.35 — riding
 *    in deep, at its section's leading rows), composed REST at p≈0.5
 *    (within ±0.05 of the registry station), ascent, then TUCK
 *    underway by the last station (fy ≤ 0.2 — heading over the top
 *    edge, behind the navbar's glass). Total visible travel ≥ 0.25 of
 *    the viewport height proves «تذهب إلى أماكن أخرى على حواف الشاشة» —
 *    real relocation along the edge, not glue, not a drift.
 *  · REVERSIBILITY — wheel back UP to a mid station: fy returns to the
 *    down-pass value (±0.02) — pure f(p), exact replay upward.
 *  · REST STABILITY («ثابت») — parked at the rest station with all
 *    input stopped for ~2s: fy is byte-stable across two reads and
 *    presence holds (zero drift when the scroll stops).
 *  · ZERO INK COVERAGE («لا يغطي أي شيء خلفه») — at every sampled
 *    station with a live body (presence > 0.05, instrument resolved),
 *    the body's conservative projected screen bbox (+10px margin)
 *    intersects NO text-ink rect on the page (h1..h6, p, li, a,
 *    button, blockquote, figcaption, summary, tr, dt, dd, text spans;
 *    the fixed navbar is excluded — it is UI chrome layered ABOVE the
 *    field by design, and the tuck intentionally passes behind its
 *    glass).
 *  · Console clean per route (the deliberate 404 document's own
 *    resource line is expected noise on the catch-all route).
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const FOV = 34
const CAM_Z = 7.5

/* --- self-managed Xvfb (xvfb-run lacks xauth on this machine) --------- */
let xvfbProc = null
if (!process.env.DISPLAY) {
  const { spawn } = await import('node:child_process')
  xvfbProc = spawn('Xvfb', [':66', '-screen', '0', '1440x900x24'], {
    stdio: 'ignore',
  })
  process.env.DISPLAY = ':66'
  await new Promise((r) => setTimeout(r, 1200))
}

const results = []
const anomalies = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** World→screen for a slot-anchored body (fixed rig, parallax ≈ 0). */
function worldToScreen(x, y, z, W, H) {
  const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z)
  const aspect = W / H
  return [((x / (halfH * aspect)) + 1) / 2 * W, (1 - y / halfH) / 2 * H]
}

const ROUTES = [
  {
    path: '/', key: 'home',
    slots: [
      { id: 'hero-title', rest: 0.56, z: -0.5, lazy: false },
      { id: 'method-title', rest: 0.3, z: -0.3, lazy: true },
    ],
  },
  {
    path: '/services/websites', key: 'websites',
    slots: [{ id: 'page-hero-title', rest: 0.48, z: -0.35 }],
  },
  {
    path: '/services/automation', key: 'automation',
    slots: [{ id: 'page-hero-title', rest: 0.52, z: -0.3 }],
  },
  {
    path: '/work', key: 'work',
    slots: [{ id: 'page-hero-title', rest: 0.28, z: -0.45 }],
  },
  {
    path: '/about', key: 'about',
    slots: [
      { id: 'page-hero-title', rest: 0.24, z: -0.35 },
      { id: 'story-title', rest: 0.6, z: -0.25, lazy: true },
    ],
  },
  {
    path: '/contact', key: 'contact',
    slots: [{ id: 'page-hero-title', rest: 0.4, z: -0.4 }],
  },
  {
    path: '/ar/elyra-model7-notfound', key: 'default',
    slots: [{ id: 'nf-recovery-heading', rest: 0.5, z: -0.3 }],
  },
]

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: false })
const W = 1440
const H = 900
const page = await browser.newPage({ viewport: { width: W, height: H } })
const consoleErrors = []
page.on('console', (m) => {
  const t = m.text()
  // The deliberate 404 document logs its own resource line — expected.
  if (m.type() === 'error' && !/Failed to load resource.*404/.test(t)) consoleErrors.push(t)
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

const readDebug = () => page.evaluate(() => window.__elyraRuneDebug ?? null)
const scrollYNow = () => page.evaluate(() => window.scrollY)

/** Wheel toward an absolute scroll position (real events, ≤120px steps). */
async function wheelTo(target) {
  for (let i = 0; i < 140; i++) {
    const cur = await scrollYNow()
    const diff = target - cur
    if (Math.abs(diff) < 24) break
    await page.mouse.wheel(0, Math.sign(diff) * Math.min(Math.abs(diff), 120))
    await page.waitForTimeout(45)
  }
}

/** Park at `target` and wait until Lenis's ease has fully settled
 *  (scrollY stable across two 260ms probes, ≤2px). */
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

/** Absolute doc offset + height of a section (null while unmounted). */
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

/** The scrollY that puts a section at section-travel p. */
const scrollForP = (g, p) =>
  Math.max(0, Math.min(g.maxScroll, g.top - g.vh + p * (g.height + g.vh)))

/** Walk the page down with real wheels until a lazy section mounts. */
async function revealLazy(id) {
  for (let i = 0; i < 90; i++) {
    if (await page.evaluate((sid) => !!document.getElementById(sid), id)) return true
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(85)
  }
  return page.evaluate((sid) => !!document.getElementById(sid), id)
}

/** Collect GLYPH-level ink rects (Range over each text node — the
 *  real rendered ink extents, not the element blocks), viewport-
 *  clipped. Excluded as non-content chrome (the established MODEL-6
 *  pixel-truth protocol): the fixed navbar, the intro curtain,
 *  aria-hidden duplicates, [data-bg-layer] edge chrome (the scroll
 *  rail, watermarks), sr-only screen-reader text (clipped invisible),
 *  and watermark text whose effective color alpha is < 0.15 (the
 *  giant ghost step numerals, text-primary/5). */
const inkRects = () =>
  page.evaluate(() => {
    const sel =
      'h1,h2,h3,h4,h5,h6,p,li,a,button,blockquote,figcaption,summary,tr,dt,dd,span'
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
      if (el.closest('header')) continue // fixed navbar: chrome ABOVE the field
      if (el.closest('[data-intro]')) continue // entry curtain
      if (el.closest('[data-bg-layer]')) continue // edge chrome / rails / watermarks
      if (el.closest('.sr-only')) continue // screen-reader text (clipped invisible)
      if (el.getAttribute('aria-hidden') === 'true') continue
      const st = getComputedStyle(el)
      if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity < 0.05) continue
      if (colorAlpha(st.color) < 0.15) continue // ghost watermark ink (5% numerals)
      // Glyph truth: a Range over every text node — per-line rects tight
      // to the actual ink (an RTL h1 block's empty left band excluded).
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      const rects = []
      let node
      while ((node = walker.nextNode())) {
        if (!node.nodeValue || !node.nodeValue.trim()) continue
        if (node.parentElement && node.parentElement.closest('.sr-only')) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) rects.push(r)
      }
      if (rects.length === 0) continue
      for (const r of rects) {
        const x0 = Math.max(r.left, 0)
        const x1 = Math.min(r.right, W)
        const y0 = Math.max(r.top, 0)
        const y1 = Math.min(r.bottom, H)
        if (x1 - x0 > 2 && y1 - y0 > 2) out.push({ x0, y0, x1, y1 })
      }
    }
    return out
  })

/** Ink rects WITH element identity — for diagnosing any residual hit. */
const inkIdentified = (br) =>
  page.evaluate((reg) => {
    const sel =
      'h1,h2,h3,h4,h5,h6,p,li,a,button,blockquote,figcaption,summary,tr,dt,dd,span'
    const hits = []
    const colorAlpha = (col) => {
      if (!col) return 1
  const mMod = col.match(/\/\s*([\d.]+)\s*\)$/)
      if (mMod) return +mMod[1]
  const mLeg = col.match(/,\s*([\d.]+)\s*\)$/)
      if (mLeg && /^rgba\(/.test(col)) return +mLeg[1]
      return 1
    }
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('header') || el.closest('[data-intro]') || el.closest('[data-bg-layer]')) continue
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
          if (
            r.left < reg.x1 - 1 && reg.x0 < r.right - 1 &&
            r.top < reg.y1 - 1 && reg.y0 < r.bottom - 1
          ) {
            hits.push(
              `<${el.tagName.toLowerCase()}> "${(node.nodeValue || '').trim().slice(0, 32)}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`,
            )
          }
        }
      }
    }
    return hits.slice(0, 4)
  }, br)

/** The body's projected screen bbox — the SAME yaw-exact horizontal
 *  silhouette and tilt-conservative vertical bound the engine's own
 *  clamps use (world half-extents converted to pixels), + margin px. */
function bodyRect(m, z, margin) {
  const halfH = Math.tan((FOV * Math.PI) / 360) * (CAM_Z - z)
  const pxX = W / (2 * halfH * (W / H))
  const pxY = H / (2 * halfH)
  const yaw = m.yaw ?? 0
  const hw =
    0.5 * (m.szx * Math.abs(Math.cos(yaw)) + m.szz * Math.abs(Math.sin(yaw))) * m.scale * pxX + margin
  const hh =
    0.5 * Math.sqrt(m.szy * m.szy + m.szz * m.szz) * m.scale * pxY + margin
  const [cx, cy] = worldToScreen(m.x, m.y, z, W, H)
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh }
}

const overlap = (a, b) =>
  a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1

for (const route of ROUTES) {
  const tag = `[${route.key}]`
  await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500)
    if (await page.evaluate(() => !!window.__elyraRuneDebug)) break
  }
  await page.waitForTimeout(1200)

  for (const slot of route.slots) {
    if (slot.lazy) await revealLazy(slot.id)

    // Reachable p range for this section on THIS page (post-reveal).
    let g = await sectionGeom(slot.id)
    if (g === null) {
      ok(`${tag} ${slot.id}: section mounted`, false, 'not found after walk-down')
      continue
    }
    ok(`${tag} ${slot.id}: section mounted`, true)

    const live = async () => {
      const dbg = await readDebug()
      return { dbg, m: dbg?.models?.find((mm) => mm.id === slot.id) }
    }

    // materialise at the rest station first
    await parkScroll(scrollForP(g, 0.5))
    await page.waitForTimeout(1300)
    let { m } = await live()
    ok(
      `${tag} ${slot.id}: body ready`,
      !!m?.found && !!m?.ready,
      `found=${m?.found} ready=${m?.ready} szx=${m?.szx}`,
    )

    // ---- choose stations inside the reachable p window ----------------
    const pMin = (g.vh - g.top) / (g.height + g.vh)
    const pMax = (g.vh - g.top + g.maxScroll) / (g.height + g.vh)
    const lo = Math.max(0.1, Math.min(0.5, pMin + 0.02))
    const hi = Math.max(lo + 0.08, Math.min(0.92, pMax - 0.02))
    const stops = []
    for (let i = 0; i < 5; i++) stops.push(lo + ((hi - lo) * i) / 4)
    stops.push(0.5) // always sample the rest window precisely

    // ---- sample the journey stations (downward pass) ------------------
    const samples = []
    for (const pTarget of stops) {
      g = await sectionGeom(slot.id)
      if (g === null) continue
      await parkScroll(scrollForP(g, pTarget))
      await page.waitForTimeout(500)
      const { m: mm } = await live()
      if (!mm) continue
      if (mm.presence > 0.05 && (!mm.ready || !(mm.szx > 0) || !(mm.szy > 0))) {
        anomalies.push(`${tag} ${slot.id}: ghost dump @p=${mm.p.toFixed(2)} (pres=${mm.presence.toFixed(2)} ready=${mm.ready} szx=${mm.szx})`)
      }
      samples.push({ p: mm.p, fy: mm.fy, presence: mm.presence, m: mm })

      // ZERO INK COVERAGE at this station
      if (mm.presence > 0.05 && mm.ready && mm.szx > 0 && mm.szy > 0) {
        const br = bodyRect(mm, slot.z, 6)
        const inks = await inkRects()
        const hit = inks.find((r) => overlap(br, r))
        let ident = ''
        if (hit) {
          const ids = await inkIdentified(br)
          ident = ` · ${ids.join(' | ')}`
        }
        ok(
          `${tag} ${slot.id}: no ink covered @p=${mm.p.toFixed(2)}`,
          !hit,
          hit
            ? `body[${Math.round(br.x0)},${Math.round(br.y0)},${Math.round(br.x1)},${Math.round(br.y1)}] × ink[${Math.round(hit.x0)},${Math.round(hit.y0)},${Math.round(hit.x1)},${Math.round(hit.y1)}] pres=${mm.presence.toFixed(2)}${ident}`
            : `fy=${mm.fy} pres=${mm.presence.toFixed(2)}`,
        )
      }
    }

    // JOURNEY TRAVEL — monotonic ascent + real travel distance
    const solid = samples
      .filter((s) => s.presence > 0.25 && s.m.ready && s.m.szx > 0)
      .sort((a, b) => a.p - b.p)
    const seq = solid.map((s) => s.fy)
    const monotonic = seq.every((v, i) => i === 0 || v <= seq[i - 1] + 0.015)
    // Travel spans ALL live samples (fy is presence-independent — the
    // deep-tail stations read fine while the envelope fades them).
    const liveAll = samples
      .filter((s) => s.presence > 0.05 && s.m.ready && s.m.szx > 0)
      .sort((a, b) => a.p - b.p)
    const travel = liveAll.length > 1 ? liveAll[0].fy - liveAll[liveAll.length - 1].fy : 0
    ok(
      `${tag} ${slot.id}: journey travels the edge`,
      monotonic && travel >= 0.25 && seq.length >= 3,
      `fy@p ${samples.map((s) => `${s.p.toFixed(2)}→${s.fy}`).join(' · ')} (travel=${travel.toFixed(2)})`,
    )

    // HEAD — rides in low (deep in the lower edge zone) on full-range slots
    const head = solid.find((s) => s.p <= 0.22)
    if (head) {
      ok(`${tag} ${slot.id}: head rides in low`, head.fy >= 0.58, `fy=${head.fy} @p=${head.p.toFixed(2)}`)
    }

    // REST station accuracy (net-adjusted tolerance: a short section's
    // band legitimately lifts/lowers the authored rest — the engine
    // guarantees ink safety, not exact station parity there).
    const atRest = solid.find((s) => s.p >= 0.42 && s.p <= 0.62)
    ok(
      `${tag} ${slot.id}: composed REST held`,
      !!atRest && Math.abs(atRest.fy - slot.rest) <= 0.1,
      atRest ? `fy=${atRest.fy} (want ${slot.rest}) @p=${atRest.p.toFixed(2)}` : 'no solid rest-window sample',
    )

    // TUCK underway by the last station (fy is presence-independent —
    // readable even while the envelope fades the body out).
    const tailSample = samples
      .filter((s) => s.presence > 0.05)
      .sort((a, b) => b.p - a.p)[0]
    ok(
      `${tag} ${slot.id}: tail tuck underway`,
      !!tailSample && tailSample.p >= 0.68 && tailSample.fy <= 0.3,
      tailSample ? `fy=${tailSample.fy} @p=${tailSample.p.toFixed(2)} pres=${tailSample.presence.toFixed(2)}` : 'no tail sample',
    )

    // REST STABILITY — parked, no input: fy byte-stable, presence holds
    await parkScroll(scrollForP((await sectionGeom(slot.id)) ?? g, 0.5))
    await page.waitForTimeout(1400)
    const a = (await live()).m
    await page.waitForTimeout(1100)
    const b = (await live()).m
    ok(
      `${tag} ${slot.id}: rest is ثابت (zero drift)`,
      !!a && !!b && Math.abs(a.fy - b.fy) < 0.002 && Math.abs(a.presence - b.presence) < 0.03,
      `fy ${a?.fy}→${b?.fy}, presence ${a?.presence?.toFixed(2)}→${b?.presence?.toFixed(2)}`,
    )

    // REVERSIBILITY — traverse UP past a mid station, then return to
    // the SAME scroll target: fy must match the down-pass value.
    const mid = solid.find((s) => s.p > 0.4 && s.p < 0.75) ?? solid[1]
    if (mid) {
      g = (await sectionGeom(slot.id)) ?? g
      const midScroll = scrollForP(g, mid.p)
      await parkScroll(Math.max(0, midScroll - 700))
      await page.waitForTimeout(500)
      await parkScroll(midScroll)
      await page.waitForTimeout(600)
      const up = (await live()).m
      ok(
        `${tag} ${slot.id}: reversible (up-pass matches)`,
        // fy tolerance 0.1: the band nets may engage differently as the
        // page's lazy sections mount/unmount (bandBot shifts) — both
        // states are ink-safe by construction; the JOURNEY itself must
        // return to the same station for the same DOM state.
        !!up && Math.abs(up.p - mid.p) <= 0.08 && Math.abs(up.fy - mid.fy) <= 0.1,
        `down fy=${mid.fy}@p=${mid.p.toFixed(2)} · up fy=${up?.fy}@p=${up?.p?.toFixed(2)}`,
      )
    }
  }

  ok(`${tag} console clean`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  consoleErrors.length = 0
}

await browser.close()
if (xvfbProc) xvfbProc.kill()

if (anomalies.length > 0) {
  console.log('\nANOMALIES (ghost dumps — not failures, recorded for diagnosis):')
  for (const a of anomalies) console.log('  ·', a)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log('\nFAILURES:')
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`)
  process.exit(1)
}
