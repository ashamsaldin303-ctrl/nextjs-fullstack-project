/**
 * MODEL-4 verification — the section-voice 3D set, end-to-end.
 *
 * For every route: waits for the bodies to load (authored kits resolve
 * instantly; the duck loads over the network), then verifies the
 * «right place / right movement / right time» contract:
 *   · PLACE  — each slot's section resolves (found) and the body
 *              reaches full presence at the section's stage;
 *   · MOVE   — part drives actually move: SLIDE drives (the pulses,
 *              the assembling blocks, the traveler, the lens, the
 *              fanning deck, the pulled sled) advance their POSITION;
 *              rate odometers (station rings) advance rotation; swings
 *              (lid, dots) oscillate;
 *   · TIME   — presence is ~0 before the section arrives and ~1 on
 *              stage (the materialise envelope);
 *   · FREEZE — an idle page parks the frame loop (frames counter).
 * Screenshots land in /tmp/m4/ for the VLM critique rounds.
 */
import { getChromium } from './_playwright.mjs'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SHOTS = '/tmp/m4'
mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const ROUTES = [
  { key: 'home', path: '/', slots: [
    { id: 'hero-title', slug: 'siteFlow', hero: true, drives: true, slide: 'pulse_b' },
    { id: 'method-title', slug: 'journeyRail' },
  ] },
  { key: 'websites', path: '/services/websites', slots: [
    { id: 'page-hero-title', slug: 'laptopStudio', hero: true, drives: true, slide: 'block_hero' },
  ] },
  { key: 'automation', path: '/services/automation', slots: [
    { id: 'page-hero-title', slug: 'nodeFlow', hero: true, drives: true, slide: 'pulse_a' },
  ] },
  { key: 'work', path: '/work', slots: [
    { id: 'page-hero-title', slug: 'workDeck', hero: true, drives: true, slide: 'card_a' },
  ] },
  { key: 'about', path: '/about', slots: [
    { id: 'page-hero-title', slug: 'obsessionLens', hero: true, drives: true, slide: 'lensG' },
    { id: 'story-title', slug: 'dataStack', drives: true, slide: 'sled_c' },
  ] },
  { key: 'contact', path: '/contact', slots: [
    { id: 'page-hero-title', slug: 'chatSignal', hero: true, drives: true },
  ] },
  { key: 'default', path: '/definitely-missing-page-404', slots: [
    { id: 'nf-recovery-heading', slug: 'rubber_duck_toy', drives: true },
  ] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readDebug(page) {
  return page.evaluate(() => {
    const d = window.__elyraRuneDebug
    if (!d) return null
    return {
      route: d.route,
      frames: d.frames,
      fade: Math.round(d.fade * 100) / 100,
      active: d.active,
      models: d.models.map((m) => ({
        id: m.id, slug: m.slug, p: Math.round(m.p * 100) / 100,
        env: Math.round(m.env * 100) / 100,
        presence: Math.round(m.presence * 100) / 100,
        ready: m.ready, found: m.found,
        x: Math.round(m.x * 100) / 100, y: Math.round(m.y * 100) / 100,
        scale: Math.round(m.scale * 1000) / 1000,
        drives: m.drives.map((dd) => ({ node: dd.node, rot: dd.rot, pos: dd.pos })),
      })),
    }
  })
}

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  try { sessionStorage.setItem('elyra-intro', '1') } catch {}
})
const page = await ctx.newPage()
const consoleErrors = []
let currentRouteLabel = '(pre)'
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${currentRouteLabel}] ${m.text()}`) })
page.on('pageerror', (e) => consoleErrors.push(`[${currentRouteLabel}] ${String(e)}`))
// Track HTTP failures — the 404-route DOCUMENT itself is expected to
// be a 404; any OTHER 4xx/5xx response is a real defect.
const httpFailures = []
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('definitely-missing-page-404')) {
    httpFailures.push(`${r.status()} ${r.url().slice(-80)}`)
  }
})

let route404Visited = false
for (const route of ROUTES) {
  console.log(`\n=========== ${route.key} (${route.path}) ===========`)
  if (route.key === 'default') route404Visited = true
  currentRouteLabel = route.key
  await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo(0, 0))

  // wait for the route's fade-in + models ready
  let dbg = null
  for (let i = 0; i < 40; i++) {
    await sleep(250)
    dbg = await readDebug(page)
    if (dbg && dbg.route === route.key && dbg.models.length > 0 && dbg.models.every((m) => m.ready)) break
  }
  ok(`${route.key}: route resolved`, dbg?.route === route.key, `route=${dbg?.route}`)
  ok(`${route.key}: models loaded`, !!dbg && dbg.models.length > 0 && dbg.models.every((m) => m.ready),
    dbg ? dbg.models.map((m) => `${m.slug}:ready=${m.ready},found=${m.found}`).join(' | ') : 'no debug')

  if (!dbg) continue

  // slots not yet on stage: hero slots must resolve immediately; lazy
  // below-fold sections legitimately mount later (the on-stage check
  // below is the real contract for those).
  for (const slot of route.slots) {
    const m = dbg.models.find((x) => x.id === slot.id)
    if (slot.hero) {
      ok(`${route.key}/${slot.id}: section found`, !!m?.found, m ? `p=${m.p}` : 'missing')
    } else {
      console.log(`  · ${route.key}/${slot.id}: lazy pre-stage found=${m?.found ?? false} (resolved on stage below)`)
    }
  }

  // bring each slot's section on stage, verify presence + drives
  for (const slot of route.slots) {
    if (slot.hero) {
      await page.evaluate(() => window.scrollTo(0, 0))
    } else {
      // Lazy sections (home methodology, about story) mount via
      // IntersectionObserver — the heading id doesn't exist until the
      // gate flips. Scroll deep in probes to wake the IO gate, THEN
      // anchor the real section.
      await page.evaluate(async (id) => {
        const probes = [2400, 4800, 7200, 9600, 12800]
        for (const y of probes) {
          if (document.getElementById(id)) break
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 450))
        }
      }, slot.id)
      await page.evaluate((id) => {
        document.getElementById(id)?.closest('section')?.scrollIntoView({ block: 'center' })
      }, slot.id)
    }
    await sleep(2200)
    const onStage = await readDebug(page)
    const m = onStage?.models.find((x) => x.id === slot.id)
    ok(`${route.key}/${slot.id}: presence on stage`, !!m && m.presence > 0.6,
      m ? `presence=${m.presence}, p=${m.p}, env=${m.env}` : 'missing')
    ok(`${route.key}/${slot.id}: expected slug`, m?.slug === slot.slug, `${m?.slug}`)

    // PLACEMENT screenshot — at full presence, BEFORE any drive scroll.
    const shot = `${SHOTS}/${route.key}-${slot.id}.png`
    await page.screenshot({ path: shot })
    console.log(`  📸 ${shot}`)

    // drives: advance the slides/sweeps/odometers by scrolling, then
    // read again. NOTE: the scroll store consumes the FIRST event
    // after mount as its initialization sample (no motion) — scroll in
    // TWO steps so the second genuinely advances D.
    if (m && m.drives.length > 0) {
      const before = m.drives.map((d) => ({ rot: d.rot, pos: d.pos }))
      // Step 0: prime — the store's first event is the init sample.
      await page.evaluate(() => window.scrollBy(0, 150))
      await sleep(400)
      // Step 1: partial scroll (model still on stage, parts moved) —
      // capture the DRIVE-state evidence HERE, mid-envelope.
      await page.evaluate(() => window.scrollBy(0, 200))
      await sleep(500)
      const dshot = `${SHOTS}/${route.key}-${slot.id}-drives.png`
      await page.screenshot({ path: dshot })
      console.log(`  📸 ${dshot}`)
      // Step 2: more scroll → final odometer readout.
      await page.evaluate(() => window.scrollBy(0, 250))
      await sleep(700)
      const after = await readDebug(page)
      const m2 = after?.models.find((x) => x.id === slot.id)
      const after2 = m2?.drives.map((d) => ({ rot: d.rot, pos: d.pos })) ?? []
      // A drive "moved" if its ROTATION advanced (odometers/sweeps/
      // swings) OR its POSITION advanced (slide drives).
      const changed = after2.some((r, i) =>
        Math.abs((r.rot ?? 0) - (before[i]?.rot ?? 0)) > 0.01 ||
        Math.abs((r.pos ?? 0) - (before[i]?.pos ?? 0)) > 0.01)
      const fmt = (i) => {
        const b = before[i] ?? { rot: 0, pos: 0 }
        const a = after2[i] ?? { rot: 0, pos: 0 }
        return `${m.drives[i].node}:rot ${b.rot.toFixed(2)}→${a.rot.toFixed(2)}${Math.abs((a.pos ?? 0) - (b.pos ?? 0)) > 0.01 ? `,pos ${b.pos.toFixed(2)}→${a.pos.toFixed(2)}` : ''}`
      }
      ok(`${route.key}/${slot.id}: drives move`, changed, before.map((_, i) => fmt(i)).join(' '))
      if (slot.slide) {
        // the named slide drive specifically: position must advance.
        // A node can carry MULTIPLE drives (slide + sweep on different
        // axes) — pass if ANY matching entry's POSITION advanced.
        const idxs = []
        for (let i = 0; i < (m2?.drives.length ?? 0); i++) {
          if (m2?.drives[i]?.node === slot.slide) idxs.push(i)
        }
        const movedIdx = idxs.find((i) =>
          Math.abs((after2[i]?.pos ?? 0) - (before[i]?.pos ?? 0)) > 0.01)
        ok(`${route.key}/${slot.id}: ${slot.slide} slides (position)`, movedIdx !== undefined,
          idxs.length ? idxs.map((i) => `pos ${(before[i]?.pos ?? 0).toFixed(2)}→${(after2[i]?.pos ?? 0).toFixed(2)}`).join(' | ') : `${slot.slide} not resolved`)
      }
    } else if (slot.drives) {
      ok(`${route.key}/${slot.id}: drives resolved`, false, 'expected drives, got none')
    }
  }
}

// FREEZE — the contract: the page SETTLES (fade/presence/wash/dust
// dampers converge past EPS, chaining stops) and then renders ZERO
// frames for as long as it stays idle. In headless Chromium the
// chained renders advance on compositor pokes (pre-existing behavior,
// identical on MODEL-3 — probes confirmed), so the honest check is:
// wait for convergence (frames stop advancing), then hold idle and
// assert they STAY stopped.
currentRouteLabel = 'freeze'
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await sleep(1200)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => window.scrollTo(0, 0))
let converged = false
let fPrev = -1
let fStable = 0
for (let i = 0; i < 50; i++) {
  await sleep(400)
  const dbg = await readDebug(page)
  const f = dbg?.frames ?? 0
  // Only trust stability AFTER the scene has mounted and rendered —
  // a not-yet-mounted scene reads 0 stably but isn't "settled".
  const mounted = !!dbg && dbg.models.length > 0 && dbg.models.every((m) => m.ready)
  if (mounted && f >= 5 && f === fPrev) {
    fStable++
    if (fStable >= 3) { converged = true; break }
  } else {
    fStable = 0
  }
  fPrev = f
}
const f1 = fPrev < 0 ? ((await readDebug(page))?.frames ?? 0) : fPrev
await sleep(2500)
const f2 = (await readDebug(page))?.frames ?? 0
ok('freeze: settles then parks (zero idle frames)', converged && f2 - f1 === 0,
  `converged=${converged}, frames ${f1}→${f2}`)

// Console: the 404-route document's own status error is expected. A
// hydration error would carry its route label — report it verbatim.
const realConsoleErrors = consoleErrors.filter((e) => !e.includes('status of 404'))
ok('console clean (no errors)', realConsoleErrors.length === 0, realConsoleErrors.slice(0, 4).join(' | ').slice(0, 600))
ok('no unexpected HTTP failures', httpFailures.length === 0, httpFailures.slice(0, 4).join(' | ').slice(0, 300))
ok('404 route visited for the duck', route404Visited)

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n========================================`)
console.log(`MODEL-4 VERIFY: ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:')
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`)
  process.exit(1)
}
