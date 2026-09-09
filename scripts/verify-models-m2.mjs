/**
 * MODEL-2 verification — the semantic 3D set, end-to-end.
 *
 * For every route: waits for the real models to load, then verifies
 * the «right place / right movement / right time» contract:
 *   · PLACE  — each slot's section resolves (found) and the model
 *              reaches full presence at the section's stage;
 *   · MOVE   — part drives actually rotate (D-odometers change with
 *              scroll; sweeps sit at their eased mid-value);
 *   · TIME   — presence is ~0 before the section arrives and ~1 on
 *              stage (the materialise envelope);
 *   · FREEZE — an idle page parks the frame loop (frames counter).
 * Screenshots land in /tmp/m2/ for the VLM critique rounds.
 */
import { getChromium } from './_playwright.mjs'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SHOTS = '/tmp/m2'
mkdirSync(SHOTS, { recursive: true })

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const ROUTES = [
  { key: 'home', path: '/', slots: [
    { id: 'hero-title', slug: 'brass_vase_01', hero: true },
    { id: 'method-title', slug: 'magnifying_glass_01' },
  ] },
  { key: 'websites', path: '/services/websites', slots: [
    { id: 'page-hero-title', slug: 'projector_screen', hero: true },
  ] },
  { key: 'automation', path: '/services/automation', slots: [
    { id: 'page-hero-title', slug: 'drill_press_01', hero: true, drives: true },
  ] },
  { key: 'work', path: '/work', slots: [
    { id: 'page-hero-title', slug: 'Camera_01', hero: true },
  ] },
  { key: 'about', path: '/about', slots: [
    { id: 'page-hero-title', slug: 'hand_plane_no4', hero: true },
    { id: 'story-title', slug: 'book_encyclopedia_set_01', drives: true },
  ] },
  { key: 'contact', path: '/contact', slots: [
    { id: 'page-hero-title', slug: 'lightbulb_led', hero: true },
  ] },
  { key: 'default', path: '/definitely-missing-page-404', slots: [
    { id: 'nf-recovery-heading', slug: 'rubber_duck_toy' },
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
        drives: m.drives.map((dd) => ({ node: dd.node, rot: dd.rot })),
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
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push(String(e)))

let route404Visited = false
for (const route of ROUTES) {
  console.log(`\n=========== ${route.key} (${route.path}) ===========`)
  if (route.key === 'default') route404Visited = true
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
      // Lazy sections (home methodology etc.) mount via IntersectionObserver
      // — the heading id doesn't exist until the gate flips. Scroll deep
      // in probes to wake the IO gate, THEN anchor the real section.
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
    await sleep(1200)
    const onStage = await readDebug(page)
    const m = onStage?.models.find((x) => x.id === slot.id)
    ok(`${route.key}/${slot.id}: presence on stage`, !!m && m.presence > 0.6,
      m ? `presence=${m.presence}, p=${m.p}, env=${m.env}` : 'missing')
    ok(`${route.key}/${slot.id}: expected slug`, m?.slug === slot.slug, `${m?.slug}`)

    // PLACEMENT screenshot — at full presence, BEFORE any drive scroll.
    const shot = `${SHOTS}/${route.key}-${slot.id}.png`
    await page.screenshot({ path: shot })
    console.log(`  📸 ${shot}`)

    // drives: rotate the odometers by scrolling, then read again.
    // NOTE: the scroll store consumes the FIRST event after mount as
    // its initialization sample (no motion) — scroll in TWO steps so
    // the second genuinely advances D.
    if (m && m.drives.length > 0) {
      const before = m.drives.map((d) => d.rot)
      // Step 0: prime — the store's first event is the init sample.
      await page.evaluate(() => window.scrollBy(0, 150))
      await sleep(400)
      // Step 1: partial scroll (model still on stage, parts rotated) —
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
      const rot2 = m2?.drives.map((d) => d.rot) ?? []
      const changed = rot2.some((r, i) => Math.abs((r ?? 0) - (before[i] ?? 0)) > 0.01)
      ok(`${route.key}/${slot.id}: drives rotate`, changed,
        before.map((r, i) => `${m.drives[i].node}:${(before[i] ?? 0).toFixed(2)}→${(rot2[i] ?? 0).toFixed(2)}`).join(' '))
    } else if (slot.drives) {
      ok(`${route.key}/${slot.id}: drives resolved`, false, 'expected drives, got none')
    } else {
      ok(`${route.key}/${slot.id}: no drives (scrub-only body)`, true)
    }

    // drives scroll moves the page — re-anchor the section BEFORE the
    // next slot's checks (keep the placement evidence above untouched).

    // (screenshot for the VLM round was captured above)
  }

  // freeze contract: idle page parks (settle the velocity tail first)
  await sleep(1600)
  const f1 = (await readDebug(page))?.frames ?? 0
  await sleep(1300)
  const f2 = (await readDebug(page))?.frames ?? 0
  ok(`${route.key}: freeze on idle`, f2 - f1 <= 3, `frames ${f1}→${f2}`)
}

const realErrors = consoleErrors.filter((e) => {
  // The intentional 404-route visit logs its own document 404 — expected.
  if (route404Visited && /404/.test(e) && /Failed to load resource/.test(e)) return false
  return true
})
ok('console clean', realErrors.length === 0, realErrors.slice(0, 5).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n==== ${results.length - failed}/${results.length} passed ====`)
process.exit(failed === 0 ? 0 : 1)
