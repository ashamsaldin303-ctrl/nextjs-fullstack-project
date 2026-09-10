/**
 * Negative-path sensory QA — sibling of verify-sensory.mjs, truth-synced
 * to the R7-b engine the same way B8 synced the positive-path script
 * (this Phase-2 edition still asserted Phase-2 reality):
 * - reduced-motion → the cursor is not "rendered but inert": CustomCursor
 *   UNMOUNTS (renders null) when usePrefersReducedMotion() is true, so
 *   no .elyra-cursor-layer exists, elyra-cursor-active never arms, and
 *   the native cursor stays.
 * - touch (coarse pointer) → same unmount path via the (pointer: fine)
 *   gate — and the sound toggle stays available (WS-2 navbar slot).
 * - Web Audio actually engages when enabled: an init-script subclass
 *   probe records every AudioContext the sound module instantiates, so
 *   the check verifies the MODULE'S context (state running), not merely
 *   that the browser exposes the API. A magnet-link click then navigates
 *   with sound active (delegated click tone + SPA navigation).
 * - EN locale sound labels + all routes render the full sensory layer.
 * Runs against the dev server with the full Chromium binary (new
 * headless, which reports `pointer: fine` correctly).
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: true })

/* ---------- 1) Reduced motion disables the custom cursor ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // Prime a REAL pointermove first — R7-b arms elyra-cursor-active only
  // on the first proven mouse move (custom-cursor.tsx hasMoved branch),
  // so this exercises the negative: even after real pointer input the
  // engine must stay unmounted under reduced motion.
  await page.mouse.move(500, 400)
  await page.waitForTimeout(400)
  // R7-b truth: with motion reduced the engine never mounts (CustomCursor
  // returns null when reduced) — there is no .elyra-cursor-dot to read
  // styles from, so inertness is asserted as layer ABSENCE + the native
  // cursor never being hidden (the Phase-2 dot-opacity probe is gone).
  const state = await page.evaluate(() => ({
    active: document.documentElement.className.includes('elyra-cursor-active'),
    layer: !!document.querySelector('.elyra-cursor-layer'),
    bodyCursor: getComputedStyle(document.body).cursor,
  }))
  ok('reduced-motion: cursor engine unmounted + native cursor intact',
    !state.active && !state.layer && state.bodyCursor !== 'none',
    JSON.stringify(state))
  await ctx.close()
}

/* ---------- 2) Touch (coarse pointer) disables the custom cursor ---------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // A real touch gesture — doubly negative on the R7-b engine: the
  // coarse-pointer gate already unmounted it, and a non-mouse pointerdown
  // would kill the engine for the session anyway (custom-cursor kill()).
  await page.touchscreen.tap(200, 400)
  await page.waitForTimeout(400)
  const state = await page.evaluate(() => ({
    pointerFine: matchMedia('(pointer: fine)').matches,
    active: document.documentElement.className.includes('elyra-cursor-active'),
    layer: !!document.querySelector('.elyra-cursor-layer'),
    bodyCursor: getComputedStyle(document.body).cursor,
  }))
  ok('touch: cursor engine unmounted + native cursor intact',
    !state.pointerFine && !state.active && !state.layer && state.bodyCursor !== 'none',
    `pointerFine=${state.pointerFine}`)
  // Sound toggle still available on mobile (WS-2: navbar slot, visible
  // on all screens — the audio layer is NOT pointer-gated).
  const toggleVisible = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
    return b ? getComputedStyle(b).display !== 'none' : false
  })
  ok('touch: sound toggle still visible on mobile', toggleVisible)
  await ctx.close()
}

/* ---------- 3) Audio actually plays when enabled ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // Track every AudioContext the sound module instantiates: patch the
  // constructor BEFORE any app code runs (sound.ts resolves
  // window.AudioContext lazily at the enable gesture — ensureContext()).
  // The old probe could only confirm window.AudioContext EXISTS, which
  // is true on every Chromium and proves nothing about the module; this
  // records the module's own instances and their live state.
  await ctx.addInitScript(() => {
    const AC = window.AudioContext
    if (!AC) return
    window.__elyraAudioContexts = []
    class TrackedAudioContext extends AC {
      constructor(...args) {
        super(...args)
        window.__elyraAudioContexts.push(this)
      }
    }
    window.AudioContext = TrackedAudioContext
  })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  // Enable sound — the toggle handler persists the preference AND creates
  // the module's AudioContext right away (setSoundEnabled → ensureContext)
  // and plays the success tone through it.
  await page.click('button[aria-label*="المؤثرات"]').catch(() => page.click('button[aria-label*="sound"]'))
  await page.waitForTimeout(300)
  const audio = await page.evaluate(() => ({
    // The module's own contexts (subclass instances) + live state.
    contexts: (window.__elyraAudioContexts ?? []).map((c) => c.state),
    storage: localStorage.getItem('elyra:sound'),
    pressed: document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')?.getAttribute('aria-pressed'),
  }))
  ok('audio: enabling creates the module AudioContext (running) + preference persists',
    audio.contexts.length >= 1 && audio.contexts.every((s) => s === 'running') &&
    audio.storage === 'on' && audio.pressed === 'true',
    JSON.stringify(audio))
  // Click a magnet link — the delegated pointerdown produces the click
  // tone and the SPA navigation keeps sound active on the target route.
  // DOM-first locator (B8 pattern), scoped to <main> and .first()-resolved
  // because the homepage has TWO main magnets on /work (the hero's
  // secondary CTA — the old `aref="/work"…` typo crashed the script here
  // with "Unknown engine aref" — and featured-work's viewAll link).
  await page.locator('main a[href="/work"][data-cursor="magnet"]').first().click()
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => ({
    storage: localStorage.getItem('elyra:sound'),
    pressed: document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')?.getAttribute('aria-pressed'),
    contexts: (window.__elyraAudioContexts ?? []).length,
  }))
  ok('audio: navigated with sound active (no page errors)',
    after.storage === 'on' && after.pressed === 'true' && after.contexts >= 1 && errors.length === 0,
    `${JSON.stringify(after)} errors=${errors.length}`)
  await ctx.close()
}

/* ---------- 4) EN locale sound toggle + routes sweep ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const en = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]')
    return { label: b?.getAttribute('aria-label'), pressed: b?.getAttribute('aria-pressed') }
  })
  ok('EN: sound toggle labels localized', en.label === 'Enable sound effects' && en.pressed === 'false',
    `label="${en.label}"`)

  const routes = ['/en/work', '/en/about', '/en/contact', '/en/services/websites', '/en/services/automation']
  let allOk = true
  const routeStatus = []
  for (const r of routes) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    // Desktop context (pointer fine, motion allowed) → the full sensory
    // layer must be present on every route (all three are layout-level).
    const hasToggle = await page.evaluate(() => !!document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]'))
    const hasGrain = await page.evaluate(() => !!document.querySelector('.grain-overlay'))
    const hasCursor = await page.evaluate(() => !!document.querySelector('.elyra-cursor-dot'))
    routeStatus.push(`${r}:${hasToggle && hasGrain && hasCursor ? 'ok' : 'MISSING'}`)
    if (!hasToggle || !hasGrain || !hasCursor) allOk = false
  }
  ok('EN: sensory layer present on all EN routes', allOk, routeStatus.join(' '))

  // AR routes
  const arRoutes = ['/work', '/about', '/contact', '/services/websites', '/services/automation']
  let arAllOk = true
  const arStatus = []
  for (const r of arRoutes) {
    await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const hasAll = await page.evaluate(() =>
      !!document.querySelector('button[aria-label*="المؤثرات"], button[aria-label*="sound"]') &&
      !!document.querySelector('.grain-overlay') &&
      !!document.querySelector('.elyra-cursor-dot'))
    arStatus.push(`${r}:${hasAll ? 'ok' : 'MISSING'}`)
    if (!hasAll) arAllOk = false
  }
  ok('AR: sensory layer present on all AR routes', arAllOk, arStatus.join(' '))
  ok('routes: zero page errors during sweep', errors.length === 0, errors.slice(0, 2).join('|'))

  await ctx.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) process.exit(1)
await browser.close()
