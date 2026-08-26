/**
 * Phase 3 performance verification (dev server — production measurement
 * deferred to scripts/lighthouse-prod.sh per prompt §4.4).
 *
 * Proves the structural LCP fixes:
 *   1. Server HTML carries NO framer `opacity:0` inline styles on the
 *      above-fold hero content (kicker/h1/subtitle/CTAs) — the old
 *      implementation hid the LCP element until JS hydration animated it
 *      (elementRenderDelay ≈ 1.9s). Now the CSS animation starts at first
 *      paint, hydration-independent.
 *   2. With JS ON, the hero paints visibly almost immediately (CSS
 *      keyframes) — well before Three.js and long before hydration could
 *      have been a gate.
 *   3. The Three.js chunk is NOT fetched at load — only after idle/interact.
 *   4. The light Reveal (IO + CSS) shows below-fold content on scroll.
 *   5. Zero console/page errors across all routes + sensory layer intact.
 *
 * NOTE on no-JS: in DEV, React streams Suspense boundaries via inline
 * $RC() scripts, so a JS-disabled browser keeps the route loading fallback
 * (dev-only artifact). Production pages are statically prerendered and
 * serve complete HTML. The structural guarantee is therefore verified via
 * the server HTML itself (check 1).
 */
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:3000'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const browser = await chromium.launch({ channel: 'chromium', headless: true })

/* ---------- 1) Server HTML: no hydration-gated opacity on LCP ---------- */
{
  const res = await fetch(BASE)
  const html = await res.text()
  const heroStart = html.indexOf('id="hero-title"')
  const heroChunk = html.slice(Math.max(0, heroStart - 400), heroStart + 3000)
  const framerFingerprint = /style="[^"]*opacity:\s*0/.test(heroChunk)
  const hasHeroEnter = heroChunk.includes('hero-enter')
  ok(
    'server HTML: hero LCP content NOT hidden by inline opacity (framer fingerprint gone)',
    !framerFingerprint && hasHeroEnter,
    `hero-enter class=${hasHeroEnter}, inline opacity:0=${framerFingerprint}`
  )

  // Same for an inner page (PageHero)
  const aboutRes = await fetch(`${BASE}/about`)
  const aboutHtml = await aboutRes.text()
  const aboutStart = aboutHtml.indexOf('id="page-hero-title"')
  const aboutChunk = aboutHtml.slice(Math.max(0, aboutStart - 300), aboutStart + 1500)
  ok(
    'server HTML: /about PageHero NOT hidden by inline opacity',
    !/style="[^"]*opacity:\s*0/.test(aboutChunk) && aboutChunk.includes('hero-enter')
  )
}

/* ---------- 2) Hero paints early with JS ON (CSS, not hydration) ------ */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    window.__heroInsertedAt = null
    window.__heroVisibleAt = null
    // Record when the hero h1 enters the DOM (streamed content arrival)…
    const mo = new MutationObserver(() => {
      if (!window.__heroInsertedAt && document.getElementById('hero-title')) {
        window.__heroInsertedAt = Math.round(performance.now())
      }
    })
    // Observe `document` — documentElement may not exist yet at init time.
    mo.observe(document, { childList: true, subtree: true })
    // …and when it becomes visible (opacity leaves 0).
    const check = () => {
      const h1 = document.getElementById('hero-title')
      if (h1 && getComputedStyle(h1).opacity !== '0' && window.__heroVisibleAt === null) {
        window.__heroVisibleAt = Math.round(performance.now())
      }
      if (window.__heroVisibleAt === null) requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
  // Warm-up visit: dev compiles routes/chunks on first hit — the timing
  // measurement must reflect the CSS animation, not the compiler.
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(800)
  await page.goto(BASE, { waitUntil: 'commit' })
  await page.waitForTimeout(4000)
  const timing = await page.evaluate(() => ({
    insertedAt: window.__heroInsertedAt,
    visibleAt: window.__heroVisibleAt,
  }))
  // Decisive dev-compatible signal: the delta between the h1 entering the
  // DOM and becoming visible must equal the CSS entrance animation window
  // (~0.7s). Under the old framer implementation the element sat at inline
  // opacity:0 until HYDRATION animated it — a delta gated on script
  // execution, and detectably larger than the animation itself.
  const delta =
    timing.insertedAt !== null && timing.visibleAt !== null
      ? timing.visibleAt - timing.insertedAt
      : null
  ok(
    'hero visibility driven by CSS entrance (insert→visible ≈ animation window)',
    delta !== null && delta >= 0 && delta <= 1200,
    `inserted@${timing.insertedAt}ms → visible@${timing.visibleAt}ms (Δ=${delta}ms ≈ 0.7s animation)`
  )
  await ctx.close()
}

/* ---------- 3) Three.js deferred out of the critical path -------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(700)
  const earlyThree = await page.evaluate(() =>
    performance.getEntriesByType('resource').filter((r) => r.name.includes('three')).length
  )
  ok('Three.js NOT loaded right after page load', earlyThree === 0, `three-resources@load=${earlyThree}`)
  await page.waitForTimeout(3500)
  const lateThree = await page.evaluate(() =>
    performance.getEntriesByType('resource').filter((r) => r.name.includes('three')).length
  )
  ok('Three.js loads after idle (deferred, not blocked)', lateThree > 0, `three-resources@+4s=${lateThree}`)
  await ctx.close()
}

/* ---------- 4) Light Reveal + sensory layer + route sweep -------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).find((h) => h.textContent?.includes('ثقة'))
    h2?.scrollIntoView({ block: 'center' })
  })
  await page.waitForTimeout(1500)
  const revealed = await page.evaluate(() => {
    const figures = document.querySelectorAll('figure')
    const visible = Array.from(figures).filter((f) => getComputedStyle(f).opacity !== '0')
    return { total: figures.length, visible: visible.length }
  })
  ok('light Reveal shows below-fold content on scroll', revealed.total > 0 && revealed.visible === revealed.total,
    `figures visible=${revealed.visible}/${revealed.total}`)

  const kinetic = await page.evaluate(() => document.querySelectorAll('.kinetic-word').length)
  ok('CSS KineticWords applied on section headings', kinetic > 0, `kinetic words=${kinetic}`)

  const sensory = await page.evaluate(() => ({
    grain: !!document.querySelector('.elyra-grain'),
    dot: !!document.querySelector('.elyra-cursor-dot'),
    // Phase 4 moved the sound toggle from `fixed bottom-4 start-4` into
    // the navbar — look for the navbar button via its aria-label text
    // (sound.enable / sound.disable keys: 'تشغيل المؤثرات الصوتية' /
    // 'Enable sound effects' / 'Mute sound effects').
    sound: !!document.querySelector('header button[aria-label*="المؤثرات"], header button[aria-label*="sound"]'),
  }))
  ok('Phase 2 sensory layer intact after rework', sensory.grain && sensory.dot && sensory.sound)
  await ctx.close()

  const routes = ['/en', '/work', '/about', '/contact', '/services/websites', '/services/automation']
  const errCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const errPage = await errCtx.newPage()
  const routeErrors = []
  errPage.on('pageerror', (e) => routeErrors.push(String(e)))
  errPage.on('console', (m) => { if (m.type() === 'error') routeErrors.push(m.text()) })
  let allOk = true
  const statuses = []
  for (const r of routes) {
    await errPage.goto(`${BASE}${r}`, { waitUntil: 'networkidle' })
    await errPage.waitForTimeout(700)
    const hasHero = await errPage.evaluate(() => !!document.querySelector('h1'))
    statuses.push(`${r}:${hasHero ? 'ok' : 'NO-H1'}`)
    if (!hasHero) allOk = false
  }
  ok('all routes render (h1 present)', allOk, statuses.join(' '))
  ok('zero console/page errors across routes', routeErrors.length === 0, routeErrors.slice(0, 2).join('|'))
  await errCtx.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} perf checks passed ===`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '))
  process.exit(1)
}
await browser.close()
