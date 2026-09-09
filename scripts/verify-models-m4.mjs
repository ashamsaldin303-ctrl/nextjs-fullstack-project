/**
 * MODEL-4 verification — the SEMANTIC-MATCH bodies + the interactivity
 * layer, machine-checked end-to-end on the dev server.
 *
 * Runs HEADED under a self-managed Xvfb display: this sandbox's
 * Chromium (headless AND headed) does not recompute IntersectionObservers
 * after instant programmatic scrolls — but real WHEEL events DO wake the
 * IO pipeline (documented REF-4-A environment limitation; lazy sections
 * mount via wheel scrolling, exactly like a real user's trackpad).
 *
 * Checks per route:
 *  · route resolution (runePresetKeyForPath)
 *  · every slot's kit resolves (ready) and its section mounts (found —
 *    lazy sections walked into view with real wheel events)
 *  · presence: the body materialises once its section is centred
 *  · the expected body occupies each slot (slug identity)
 *  · DRIVES MOVE: two scroll positions produce different part states
 *    (assemblies, packets, glow — the scroll choreography is live)
 *  · INTERACTIVITY: pointer moves advance the frame counter (the poke
 *    bus answers every move); hovering the body raises prox; the lean
 *    springs deflect (sprx/spry leave zero)
 *  · FREEZE: once all input stops, the frame counter parks (Δ=0)
 *  · console clean
 *
 * Plus the follow-cursor special (websites): the on-screen cursor's
 * position changes with pointer moves.
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const FOV = 34
const CAM_Z = 7.5

/* --- self-managed Xvfb (xvfb-run lacks xauth on this machine) --------- */
let xvfbProc = null
if (!process.env.DISPLAY) {
  const { spawn } = await import('node:child_process')
  xvfbProc = spawn('Xvfb', [':64', '-screen', '0', '1440x900x24'], {
    stdio: 'ignore',
  })
  process.env.DISPLAY = ':64'
  await new Promise((r) => setTimeout(r, 1200))
}

const results = []
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
      { id: 'hero-title', slug: 'experienceStack', z: -0.5 },
      { id: 'method-title', slug: 'pipelineJourney', z: -0.3, lazy: true },
    ],
  },
  {
    path: '/services/websites', key: 'websites',
    slots: [{ id: 'page-hero-title', slug: 'siteCanvas', z: -0.35 }],
    followCursor: 'ui_cursor',
  },
  {
    path: '/services/automation', key: 'automation',
    slots: [{ id: 'page-hero-title', slug: 'flowGraph', z: -0.3 }],
  },
  {
    path: '/work', key: 'work',
    slots: [{ id: 'page-hero-title', slug: 'resultsDeck', z: -0.45 }],
  },
  {
    path: '/about', key: 'about',
    slots: [
      { id: 'page-hero-title', slug: 'explodedDetail', z: -0.35 },
      { id: 'story-title', slug: 'braidMerge', z: -0.25 },
    ],
  },
  {
    path: '/contact', key: 'contact',
    slots: [{ id: 'page-hero-title', slug: 'messageComposer', z: -0.4 }],
  },
  {
    path: '/ar/elyra-model4-notfound', key: 'default',
    slots: [{ id: 'nf-recovery-heading', slug: 'brokenLink', z: -0.3 }],
  },
]

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: false })
const W = 1440
const H = 900
const page = await browser.newPage({ viewport: { width: W, height: H } })
const consoleErrors = []
/** 404 responses whose URL is a page we deliberately visited (the
 *  not-found document itself — semantically correct, its console
 *  “failed to load resource” twin is expected noise, not an error). */
let expectedDoc404s = 0
page.on('response', (r) => {
  if (r.status() === 404 && ROUTES.some((rt) => rt.path !== '/' && r.url().endsWith(rt.path))) {
    expectedDoc404s += 1
  }
})
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

const readDebug = () => page.evaluate(() => window.__elyraRuneDebug ?? null)
const scrollYNow = () => page.evaluate(() => window.scrollY)

/** Wheel toward an absolute scroll position (real events, ≤120px steps —
 *  wakes the IO pipeline so lazy sections mount, like a real trackpad). */
async function wheelTo(target) {
  for (let i = 0; i < 90; i++) {
    const cur = await scrollYNow()
    const diff = target - cur
    if (Math.abs(diff) < 30) break
    const step = Math.sign(diff) * Math.min(Math.abs(diff), 120)
    await page.mouse.wheel(0, step)
    await page.waitForTimeout(45)
  }
  await page.waitForTimeout(260)
}

/** Reveal a section (mounting lazy gates by walking the page down with
 *  wheel events), then centre it in the viewport. */
async function revealSection(id) {
  const center = () => page.evaluate((sid) => {
    const el = document.getElementById(sid)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return Math.max(0, window.scrollY + r.top + r.height / 2 - window.innerHeight / 2)
  }, id)
  let target = await center()
  if (target !== null) {
    await wheelTo(target)
    return
  }
  // lazy: walk down until the section mounts
  const maxY = await page.evaluate(() => document.body.scrollHeight)
  let y = await scrollYNow()
  for (let i = 0; i < 60 && y < maxY - 40; i++) {
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(85)
    y = await scrollYNow()
    if (await page.evaluate((sid) => !!document.getElementById(sid), id)) break
  }
  target = await center()
  if (target !== null) await wheelTo(target)
}

for (const route of ROUTES) {
  const tag = `[${route.key}]`
  await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
  // wait for the rune field to mount (idle gate + chunk)
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500)
    if (await page.evaluate(() => !!window.__elyraRuneDebug)) break
  }
  await page.waitForTimeout(700)

  // 1. route resolution
  let dbg = await readDebug()
  ok(`${tag} route resolved`, dbg?.route === route.key, `got ${dbg?.route}`)

  // 2. sections mount + bodies materialise + identity + drives + pointer
  for (const slot of route.slots) {
    await revealSection(slot.id)
    await page.waitForTimeout(800)
    dbg = await readDebug()
    const m = dbg?.models?.find((mm) => mm.id === slot.id)
    ok(`${tag} ${slot.id}: section found`, !!m?.found, `found=${m?.found}`)
    ok(`${tag} ${slot.id}: kit ready`, !!m?.ready, `ready=${m?.ready}`)
    ok(`${tag} ${slot.id}: expected body`, m?.slug === slot.slug, `got ${m?.slug}`)
    ok(`${tag} ${slot.id}: presence materialised`, (m?.presence ?? 0) > 0.35, `presence=${m?.presence?.toFixed(2)}`)

    // 3. DRIVES MOVE between two wheel-scroll positions
    const d1 = JSON.stringify(m?.drives ?? [])
    const here = await scrollYNow()
    await wheelTo(here + 320)
    await page.waitForTimeout(500)
    dbg = await readDebug()
    const m2 = dbg?.models?.find((mm) => mm.id === slot.id)
    const d2 = JSON.stringify(m2?.drives ?? [])
    ok(`${tag} ${slot.id}: drives move with scroll`, d1 !== d2 && (m?.drives?.length ?? 0) > 0,
      `${m?.drives?.length ?? 0} drives`)

    // 4. INTERACTIVITY — pointer poke + prox + lean springs
    await wheelTo(here)
    await page.waitForTimeout(1000)
    const f0 = (await readDebug())?.frames ?? 0
    await page.mouse.move(220, 180, { steps: 3 })
    await page.waitForTimeout(300)
    const f1 = (await readDebug())?.frames ?? 0
    ok(`${tag} ${slot.id}: pointer moves advance frames`, f1 > f0, `${f0} → ${f1}`)

    // hover the body itself (world → screen)
    const mh = await readDebug()
    const mm = mh?.models?.find((x) => x.id === slot.id)
    if (mm && (mm.presence ?? 0) > 0.3) {
      const [sx, sy] = worldToScreen(mm.x, mm.y, slot.z, W, H)
      await page.mouse.move(Math.round(sx), Math.round(sy), { steps: 4 })
      await page.waitForTimeout(500)
      const hb = await readDebug()
      const hm = hb?.models?.find((x) => x.id === slot.id)
      ok(`${tag} ${slot.id}: proximity rises over body`, (hm?.prox ?? 0) > 0.25, `prox=${hm?.prox}`)
      const spr = Math.abs(hm?.sprx ?? 0) + Math.abs(hm?.spry ?? 0)
      ok(`${tag} ${slot.id}: lean springs deflect`, spr > 0.05, `spr=${spr.toFixed(2)}`)
    } else {
      ok(`${tag} ${slot.id}: proximity rises over body`, false, 'body not on stage for hover test')
    }

    // 5. FREEZE — input stops, the loop parks. Long wheel travels leave
    // a genuine Lenis easing tail (real scroll motion — the scene is
    // SUPPOSED to render while the page still glides): poll until the
    // frames stabilise (≤8s), then assert a strict 900ms flat window.
    let stable = false
    let prev = -1
    for (let i = 0; i < 16 && !stable; i++) {
      await page.waitForTimeout(500)
      const f = (await readDebug())?.frames ?? 0
      stable = prev === f
      prev = f
    }
    ok(`${tag} ${slot.id}: frame loop settles after input`, stable, `frames=${prev}`)
    const fA = (await readDebug())?.frames ?? 0
    await page.waitForTimeout(900)
    const fB = (await readDebug())?.frames ?? 0
    ok(`${tag} ${slot.id}: frame loop parks on idle`, fA === fB, `${fA} → ${fB}`)
  }

  // 6. follow-cursor special (websites): on-screen cursor tracks pointer
  if (route.followCursor) {
    await wheelTo(0)
    await page.waitForTimeout(900)
    const c1 = await readDebug()
    const cur1 = c1?.models?.[0]?.drives?.find((d) => d.node === route.followCursor)
    await page.mouse.move(1100, 260, { steps: 4 })
    await page.waitForTimeout(300)
    const c2 = await readDebug()
    const cur2 = c2?.models?.[0]?.drives?.find((d) => d.node === route.followCursor)
    const moved = cur1 && cur2 && (cur1.fx !== cur2.fx || cur1.fy !== cur2.fy)
    ok(`[websites] screen cursor follows pointer`, !!moved,
      `fx ${cur1?.fx} → ${cur2?.fx}, fy ${cur1?.fy} → ${cur2?.fy}`)
  }
}

// console clean across all routes. The not-found document's own 404
// status — and its console twin — is correct behavior: this script
// deliberately visits it, so drop one console twin per counted
// response (order-independent: count each side, drop the pairs; the
// floor of 1 covers a soft-rewritten 200 that logged no response).
let doc404ConsoleMsgs = 0
for (const t of consoleErrors) {
  if (/status of 404/.test(t)) doc404ConsoleMsgs += 1
}
const dropped404s = Math.min(doc404ConsoleMsgs, Math.max(expectedDoc404s, 1))
let toDrop = dropped404s
const realErrors = consoleErrors.filter((t) => {
  if (toDrop > 0 && /status of 404/.test(t)) {
    toDrop -= 1
    return false
  }
  return true
})
ok('console clean (no errors)', realErrors.length === 0,
  realErrors.length ? realErrors.slice(0, 3).join(' | ') : `(${dropped404s} expected not-found doc 404s filtered)`)

await browser.close()
if (xvfbProc) xvfbProc.kill()

const failed = results.filter((r) => !r.pass)
console.log(`\n===== ${results.length - failed.length}/${results.length} checks passed =====`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`)
  process.exit(1)
}
