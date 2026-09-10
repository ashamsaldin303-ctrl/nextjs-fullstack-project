/**
 * MODEL-4 screenshot harvester — full-presence rest shot + mid-travel
 * drives shot per slot, for the VLM critique rounds. Same environment
 * contract as verify-models-m4.mjs (headed under self-managed Xvfb;
 * real wheel events mount lazy sections).
 */
import { getChromium } from './_playwright.mjs'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:3000'
const SHOTS = '/tmp/m4'
mkdirSync(SHOTS, { recursive: true })

let xvfbProc = null
if (!process.env.DISPLAY) {
  const { spawn } = await import('node:child_process')
  xvfbProc = spawn('Xvfb', [':65', '-screen', '0', '1440x900x24'], {
    stdio: 'ignore',
  })
  process.env.DISPLAY = ':65'
  await new Promise((r) => setTimeout(r, 1200))
}

const ROUTES = [
  { path: '/', key: 'home', slots: [
    { id: 'hero-title', lazy: false },
    { id: 'method-title', lazy: true },
  ] },
  { path: '/services/websites', key: 'websites', slots: [{ id: 'page-hero-title' }] },
  { path: '/services/automation', key: 'automation', slots: [{ id: 'page-hero-title' }] },
  { path: '/work', key: 'work', slots: [{ id: 'page-hero-title' }] },
  { path: '/about', key: 'about', slots: [
    { id: 'page-hero-title' },
    { id: 'story-title', lazy: true },
  ] },
  { path: '/contact', key: 'contact', slots: [{ id: 'page-hero-title' }] },
  { path: '/ar/elyra-model4-notfound', key: 'default', slots: [{ id: 'nf-recovery-heading' }] },
]

const chromium = await getChromium()
const browser = await chromium.launch({ channel: 'chromium', headless: false })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const scrollYNow = () => page.evaluate(() => window.scrollY)
const readDebug = () => page.evaluate(() => window.__elyraRuneDebug ?? null)

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
  await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500)
    if (await page.evaluate(() => !!window.__elyraRuneDebug)) break
  }
  await page.waitForTimeout(700)
  for (const slot of route.slots) {
    await revealSection(slot.id)
    await page.waitForTimeout(900)
    // REST — full presence, before drive scroll
    await page.screenshot({ path: `${SHOTS}/${route.key}-${slot.id}.png` })
    // TRAVEL — drives engaged (+320px into the section)
    const here = await scrollYNow()
    await wheelTo(here + 320)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${SHOTS}/${route.key}-${slot.id}-drives.png` })
    const dbg = await readDebug()
    const m = dbg?.models?.find((mm) => mm.id === slot.id)
    console.log(`📸 ${route.key}/${slot.id} — presence=${m?.presence?.toFixed(2)} slug=${m?.slug}`)
    await wheelTo(here)
  }
}

await browser.close()
if (xvfbProc) xvfbProc.kill()
console.log(`done — shots in ${SHOTS}`)
