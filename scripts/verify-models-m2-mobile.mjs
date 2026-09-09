/**
 * MODEL-2 mobile sanity — 375px: the rune layer must NOT mount on the
 * mobile tier (useMobileTier gate) and the page must not overflow
 * horizontally. Quick single-route probe (home) + the 404 route.
 */
import { getChromium } from './_playwright.mjs'

const BASE = 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: true })
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
await ctx.addInitScript(() => {
  try { sessionStorage.setItem('elyra-intro', '1') } catch {}
})
const page = await ctx.newPage()
let pass = true

for (const path of ['/', '/definitely-missing-page-404']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await sleep(2500)
  const res = await page.evaluate(() => {
    const field = document.querySelector('[data-elyra-rune-field]')
    return {
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      runeMounted: !!field && getComputedStyle(field).display !== 'none',
    }
  })
  const ok = !res.overflowX && !res.runeMounted
  pass = pass && ok
  console.log(`${ok ? '✓' : '✗'} ${path} @375px — overflow=${res.overflowX}, runeMounted=${res.runeMounted}`)
}

await browser.close()
process.exit(pass ? 0 : 1)
