/**
 * REF-4 verification — T1/T2/T3 tactile layer end-to-end checks.
 * Runs against the dev server with the full Chromium binary (new headless,
 * which reports `pointer: fine` correctly, unlike the headless shell —
 * the same reason verify-sensory.mjs uses channel: 'chromium').
 *
 * Environment notes learned the hard way:
 *   · the intro curtain waits on document.fonts.ready (≤4s) + 2.55s — skip
 *     it via a pre-load sessionStorage flag (a legitimate repeat-visit
 *     state) so pointer events reach the page immediately;
 *   · the lazy IO gates sit ~8500px+ down the home page — scroll DEEP
 *     (shallow scrolls never bring them within the 400px rootMargin);
 *   · computed transform-origin resolves to px, not the authored %.
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  // Repeat-visit state: the pre-paint gate reads this and hides the intro.
  try { sessionStorage.setItem('elyra-intro', '1') } catch {}
})
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

// --- 0. Environment sanity ----------------------------------------------
const env = await page.evaluate(() => {
  const intro = document.querySelector('.intro-overlay')
  return {
    pointerFine: matchMedia('(pointer: fine)').matches,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    // repeat-visit: the element can linger in the DOM until post-hydration
    // unmount — the gate is its COMPUTED display, not its existence.
    introHidden: !intro || getComputedStyle(intro).display === 'none',
  }
})
ok('env: pointer fine + intro skipped', env.pointerFine && env.introHidden, JSON.stringify(env))

// --- 1. Circular page-enter (T3-11) --------------------------------------
// Deterministic: REPLAY the animation on the loaded page (the classic
// restart idiom) and sample on the next frame — mid-reveal, no race.
// Then assert the clip reverts to none after it ends (fill: backwards —
// the regression that cut the page below ~2200px and killed the lazy IO
// gates was exactly a persisted clip).
const replayEnter = async () => page.evaluate(() => new Promise((res) => {
  const el = document.querySelector('.page-enter')
  el.style.animation = 'none'
  void el.offsetWidth // flush the reset
  el.style.animation = ''
  requestAnimationFrame(() => {
    const cs = getComputedStyle(el)
    res({ name: cs.animationName, clip: cs.clipPath, dur: cs.animationDuration, fill: cs.animationFillMode })
  })
}))
const rtlEnter = await replayEnter()
ok('page-enter: organic circular reveal (RTL origin = top physical right, fill=backwards)',
  rtlEnter.name === 'page-enter' && /circle/.test(rtlEnter.clip || '') &&
  rtlEnter.dur === '0.85s' && /93%/.test(rtlEnter.clip) && rtlEnter.fill === 'backwards',
  JSON.stringify(rtlEnter))
await page.waitForTimeout(1100) // reveal ends → clip reverts
const clipAfter = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.page-enter')).clipPath,
)
ok('page-enter: clip-path reverts to none after the reveal (no permanent clip)',
  clipAfter === 'none', `clipPath=${clipAfter}`)

// --- 2. Cursor radar over the hero (N6) -----------------------------------
await page.mouse.move(1000, 400)
await page.waitForTimeout(350)
const radar1 = await page.evaluate(() => {
  const readout = [...document.querySelectorAll('div')].find((d) =>
    /^X \d{4} · Y \d{4}/.test((d.textContent || '').trim()),
  )
  if (!readout) return null
  return { text: readout.textContent.trim(), opacity: getComputedStyle(readout).opacity }
})
// RTL logical X = rect.right − clientX = 1440 − 1000 = 440
ok('radar: hero readout live + visible, RTL-logical X (0440)',
  !!radar1 && radar1.opacity === '1' && /X 0440 · Y 0[34]\d\d/.test(radar1.text),
  JSON.stringify(radar1))

await page.mouse.move(300, 250)
await page.waitForTimeout(250)
const radar2 = await page.evaluate(() => {
  const readout = [...document.querySelectorAll('div')].find((d) =>
    /^X \d{4} · Y \d{4}/.test((d.textContent || '').trim()),
  )
  return readout ? readout.textContent.trim() : null
})
ok('radar: readout tracks the pointer (X 1140 after move to 300)',
  !!radar2 && /X 1140 · Y 02\d\d/.test(radar2), radar2)

// --- 3. Golden arabesque in the manifesto (N5) -----------------------------
// The wrapper's draw window: top at 95% → 55% of the viewport. Stroke 0's
// slice is [0, 1/12] — it flips empty→drawn right at the window's start,
// which is the sharpest observable for "the pen is moving".
const wrapOffset = await page.evaluate(() => {
  const svg = document.querySelector('svg[viewBox="0 0 1200 120"]')
  return Math.round((svg?.closest('div')?.getBoundingClientRect().top || 0) + window.scrollY)
})
const strokeState = async (scrollY) => {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY)
  await page.waitForTimeout(1400) // the soft spring (80/24, ζ≈1.34) needs ~1s to settle
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll('svg[viewBox="0 0 1200 120"] path')]
    const cs0 = getComputedStyle(paths[0])
    const csLast = getComputedStyle(paths[paths.length - 1])
    const fully = paths.filter((p) => getComputedStyle(p).strokeDasharray.startsWith('1px')).length
    return { s0: cs0.strokeDasharray, sLast: csLast.strokeDasharray, fullyDrawn: fully, total: paths.length }
  })
}
const b1 = await strokeState(wrapOffset - 880) // just before the window (top=880 > 95%*900=855)
const b2 = await strokeState(wrapOffset - 760) // inside the window (top=760)
const b3 = await strokeState(wrapOffset - 300) // past the window (top=300 < 495)
ok('arabesque: 15 gold strokes present (rail + 12 motifs + rosette ×2)',
  b2.total === 15, `total=${b2.total}`)
ok('arabesque: stroke 0 empty before the window, drawn inside (self-drawing scrub)',
  b1.s0.startsWith('0px') && b2.s0.startsWith('1px'),
  `before="${b1.s0}" inside="${b2.s0}"`)
ok('arabesque: all strokes fully drawn past the window (final state)',
  // The soft spring settles ASYMPTOTICALLY — the last stroke reads ~0.95+
  // (visually complete). Threshold 0.9 = drawn; 1.0 exactly would flake.
  b3.fullyDrawn >= 14 && parseFloat(b3.sLast) >= 0.9,
  `fully=${b3.fullyDrawn}/15 last="${b3.sLast}"`)

// --- 4. Methodology fan (N4) — progressive scroll through the lazy gates ----
// The IO gates sit ~8500px down; enter each gate's 400px rootMargin window
// (shallow scrolls miss it) and step to the bottom so every gate flips.
for (const y of [3000, 5000, 7000, 7800, 8300, 8600, 9000, 9600, 10200, 11000, 11656]) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y)
  await page.waitForTimeout(280)
}
await page.waitForTimeout(1600) // chunk load + hydration
await page.evaluate(() => {
  document.querySelector('section[aria-labelledby="method-title"]')?.scrollIntoView({ block: 'start' })
})
await page.waitForTimeout(900)
const fan = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('section[aria-labelledby="method-title"] article')]
  return cards.map((c) => ({
    transform: getComputedStyle(c).transform,
    origin: getComputedStyle(c).transformOrigin,
  }))
})
const fanOk = fan.length === 4 &&
  fan.every((f) => /50% 0%|px 0px/.test(f.origin)) &&
  fan.some((f) => f.transform !== 'none' && f.transform !== 'matrix(1, 0, 0, 1, 0, 0)')
ok('methodology: fan mounted (4 cards, center-top origin, transforms active)',
  fanOk, JSON.stringify(fan.map((f) => ({ o: f.origin, t: f.transform.slice(0, 36) }))))

// --- 5. Calculator: chips tilt (N3) + impact wiring sanity ------------------
await page.evaluate(() => {
  document.querySelector('#calculator')?.scrollIntoView({ block: 'start' })
})
await page.waitForTimeout(1600)
// Advance to step 1 — the tilted integration chips only render there
// (step 0 shows the service cards, which intentionally carry no tilt).
await page.evaluate(() => {
  const zone = document.getElementById('calculator')
  const next = [...(zone?.querySelectorAll('button') || [])].find((b) =>
    b.textContent.includes('التالي') || b.textContent.includes('Next'))
  next?.click()
})
await page.waitForTimeout(900)
const calc = await page.evaluate(() => {
  const zone = document.getElementById('calculator')
  const chips = [...(zone?.querySelectorAll('button[aria-pressed]') || [])].filter((b) =>
    b.className.includes('rounded-full'),
  )
  const tilts = chips.map((c) => getComputedStyle(c).rotate)
  const tilted = tilts.filter((t) => t && t !== 'none' && t !== '0deg')
  return { chipCount: chips.length, tiltedCount: tilted.length, sample: tilts.slice(0, 6) }
})
ok('calculator: hash tilt on chips (≥2 non-zero, stable)',
  calc.tiltedCount >= 2 && calc.chipCount >= 6,
  `chips=${calc.chipCount} tilted=${calc.tiltedCount} sample=${JSON.stringify(calc.sample.slice(0, 4))}`)

// --- 6. Contact success box (N7) ---------------------------------------------
await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.fill('#cf-name', 'REF4 Verification')
await page.fill('#cf-email', 'ref4-verify@elyra.test')
await page.fill('#cf-message', 'رسالة تحقق آلي من طبقة REF-4 اللمسية — تجربة صندوق النجاح والمفصل.')
await page.click('button[type="submit"]')
// Poll for the box: the API response + panel mount + lid hinge can take
// up to ~4s under dev-server compile — a fixed wait flakes.
const box = await page.waitForFunction(
  () => {
    const status = document.querySelector('[role="status"]')
    if (!status) return false
    const lid = status.querySelector('.origin-top')
    if (!lid) return false
    return getComputedStyle(lid).transform.startsWith('matrix3d')
  },
  { timeout: 9000, polling: 250 },
).then(() =>
  page.evaluate(() => {
    const status = document.querySelector('[role="status"]')
    if (!status) return null
    const lid = status.querySelector('.origin-top')
    const reference = [...status.querySelectorAll('span')].map((s) => s.textContent.trim()).join(' ')
    const lidStyle = lid ? getComputedStyle(lid) : null
    return {
      heading: status.querySelector('h3')?.textContent?.trim(),
      hasReference: /c[a-z0-9]{9}/i.test(reference),
      lidTransform: lidStyle?.transform?.slice(0, 44),
      lidOrigin: lidStyle?.transformOrigin,
      lidH: lid ? Math.round(lid.getBoundingClientRect().height) : 0,
      button: [...status.querySelectorAll('button')].map((b) => b.textContent.trim()).join(','),
    }
  }),
).catch(() => null)
ok('success box: role=status panel + reference token + restart button',
  !!box && box.hasReference && !!box.heading && /إرسال رسالة أخرى|Send another/.test(box.button || ''),
  JSON.stringify(box))
// The lid's own getBoundingClientRect is TRANSFORMED (foreshortened by
// rotateX 120°) — the untransformed reference is the perspective parent.
// VLM-round-2 geometry: hinge at the TOP edge → origin Y ≈ 0 (the lid's
// top edge), and at rest the lid rises visible ABOVE the recess.
const lidParentH = await page.evaluate(() => {
  const lid = document.querySelector('[role="status"] .origin-top')
  return lid?.parentElement ? Math.round(lid.parentElement.getBoundingClientRect().height) : 0
})
const originParts = box?.lidOrigin?.split(' ') || []
const lidOk = box && box.lidTransform?.startsWith('matrix3d') &&
  originParts.length === 2 && Math.abs(parseFloat(originParts[1])) < 3
ok('success box: lid hinged at top edge, rotateX in 3D (matrix3d), rests visible',
  !!lidOk, `transform=${box?.lidTransform} origin=${box?.lidOrigin} parentH=${lidParentH}`)

// --- 7. Fresnel gold edge (N9) -------------------------------------------------
await page.goto(`${BASE}/services/websites`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
const fresnelCount = await page.evaluate(() => document.querySelectorAll('.fresnel-edge').length)
await page.evaluate(() => {
  document.querySelector('.fresnel-edge')?.scrollIntoView({ block: 'center' })
})
await page.waitForTimeout(500)
const cardBox = await page.evaluate(() => {
  const el = document.querySelector('.fresnel-edge')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
if (cardBox) {
  await page.mouse.move(cardBox.x + cardBox.w * 0.35, cardBox.y + cardBox.h * 0.4)
  await page.waitForTimeout(350)
}
const fresnel = await page.evaluate(() => {
  const el = document.querySelector('.fresnel-edge')
  if (!el) return null
  return {
    fi: el.style.getPropertyValue('--fi'),
    fx: el.style.getPropertyValue('--fx'),
    fy: el.style.getPropertyValue('--fy'),
  }
})
ok('fresnel: 3 spec cards wrapped, pointer lights the gold ring (--fi=1, --fx/--fy set)',
  fresnelCount === 3 && fresnel?.fi === '1' && fresnel?.fx !== '' && fresnel?.fx !== undefined,
  `count=${fresnelCount} fi="${fresnel?.fi}" fx="${fresnel?.fx}" fy="${fresnel?.fy}"`)

// --- 8. LTR page-enter origin (en locale) ---------------------------------------
await page.goto(`${BASE}/en`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const ltrEnter = await replayEnter()
ok('page-enter: LTR origin mirrors to top-left', /7%/.test(ltrEnter.clip || ''), ltrEnter.clip)

// --- 9. Freeze contract -----------------------------------------------------------
// The honest proof: the rune's frame counter must EVENTUALLY park and STAY
// parked (model GLB loads in this sandbox finish late — their presence
// fade-ins legitimately render for seconds after "idle" begins; a fixed
// wait samples mid-fade). Poll for stability with a generous ceiling.
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(4000)
await page.evaluate(() => window.scrollTo(0, 2500)) // wake the rune
await page.waitForTimeout(700)
await page.evaluate(() => window.scrollTo(0, 0))
let parked = false
let lastDetail = ''
const deadline = Date.now() + 40000
let prev = -1
let stableSince = 0
while (Date.now() < deadline) {
  await page.waitForTimeout(2000)
  const cur = await page.evaluate(() => {
    const d = window.__elyraRuneDebug
    return d ? d.frames : -1
  })
  if (cur === prev) {
    if (!stableSince) stableSince = Date.now()
    if (Date.now() - stableSince >= 4000) { parked = true; lastDetail = `frames=${cur} (stable ≥4s)`; break }
  } else {
    stableSince = 0
    prev = cur
  }
}
if (!parked) lastDetail = `frames still ticking: ${prev}`
ok('freeze contract: rune frame counter parks and stays parked after idle', parked, lastDetail)

// --- 10. Console errors -------------------------------------------------------------
ok('console: zero errors across all pages', consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | ') || 'clean')

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' · '))
  process.exit(1)
}
