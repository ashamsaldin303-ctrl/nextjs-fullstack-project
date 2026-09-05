/**
 * Private Stitch helper module (underscore prefix = house convention for
 * non-entry tooling, cf. scripts/_playwright.mjs).
 *
 * This is the ONLY code in the repo that talks to the Stitch API
 * (G1-C blueprint: dev-time CLI tooling, never imported from src/ — the
 * app graph stays free of the SDK and the key's blast radius).
 *
 * Security rules (G2-5 S-1/S-4, G1-C):
 *   - STITCH_API_KEY is env-only: bun auto-loads .env from the repo root.
 *     It is NEVER accepted as a CLI argument (ps/shell-history leak) and
 *     NEVER printed — logs record screenIds / resourceIds, not the key.
 *   - Signed download URLs are credentials-adjacent (unknown TTL): errors
 *     print the URL host only, never the full URL.
 *
 * Quota discipline (G1-C):
 *   - Read ops (list / get_screen / list_design_systems) are free — audit freely.
 *   - Every generation/edit/variants call MUST append to the ledger before
 *     process exit, even on failure (credits can be consumed by a call that
 *     visibly errored).
 *   - Artifacts are persisted at generation time ALWAYS: signed URLs have an
 *     unknown TTL and list_screens/get_screen do NOT return variant screens
 *     (G1-A live probe) — later re-fetch is best-effort only.
 *
 * Run from the repo root (bun resolves .env relative to CWD).
 */
import { stitch, StitchError } from '@google/stitch-sdk'
import type { Screen } from '@google/stitch-sdk'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Single seam to the SDK singleton — import `stitch` from this module, never from the package. */
export { stitch }

/* ------------------------------------------------------------------ */
/* Paths (machine-local, all gitignored via .stitch/)                  */
/* ------------------------------------------------------------------ */

export const STITCH_DIR = '.stitch'
export const DESIGNS_DIR = join(STITCH_DIR, 'designs')
export const PROMPTS_DIR = join(STITCH_DIR, 'prompts')
export const METADATA_FILE = join(STITCH_DIR, 'metadata.json')
export const LEDGER_FILE = join(STITCH_DIR, 'generations.log')
export const DESIGN_MD_FILE = join(STITCH_DIR, 'DESIGN.md')

const LEDGER_HEADER =
  '# Elyra Stitch quota ledger — every generation/edit/variants call appends: ISO-date | project | op | screenId | model'

/* ------------------------------------------------------------------ */
/* Model + device maps                                                 */
/* ------------------------------------------------------------------ */

/**
 * CLI aliases → real Stitch model IDs.
 *
 * GEMINI_3_PRO is DEPRECATED server-side ("Use GEMINI_3_1_PRO or
 * GEMINI_3_FLASH instead" — live manifest, G1-A; the README's model table
 * is stale, G2-6). It is deliberately absent from this map: passing it
 * anywhere is a bug.
 */
export const MODEL_ALIASES = {
  FLASH: 'GEMINI_3_FLASH',
  PRO1: 'GEMINI_3_1_PRO',
} as const
export type ModelAlias = keyof typeof MODEL_ALIASES

export const DEVICE_TYPES = ['DESKTOP', 'MOBILE', 'TABLET', 'AGNOSTIC'] as const
export type DeviceType = (typeof DEVICE_TYPES)[number]

/* ------------------------------------------------------------------ */
/* JSON narrowing guards (catalog-guards convention: never throw)      */
/* ------------------------------------------------------------------ */

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Fallback for SDK ids that are typed `string` but can be undefined at runtime. */
export function orDash(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : '-'
}

/** Title of a screen from its (loosely typed) SDK data record. */
export function screenTitle(screen: Screen): string | undefined {
  const data = asRecord(screen.data)
  return asString(data['title']) ?? asString(data['name'])
}

/* ------------------------------------------------------------------ */
/* Env guard                                                           */
/* ------------------------------------------------------------------ */

/** Throws a clear error when the key is absent. NEVER touches/prints the value. */
export function requireApiKey(): void {
  if (!process.env.STITCH_API_KEY) {
    throw new Error(
      'STITCH_API_KEY is not set. Add it to .env at the repo root (bun auto-loads .env when running scripts from the repo root) — never pass it as a CLI argument.',
    )
  }
}

/* ------------------------------------------------------------------ */
/* Quota ledger                                                        */
/* ------------------------------------------------------------------ */

/**
 * Append one ledger line: `ISO-date | project | op | screenId | model`.
 * The 4th column carries the touched resource id (screenId for
 * generate/edit/variants, projectId/assetId for bootstrap rows, '-'
 * when the call failed before an id existed).
 */
export function ledger(op: string, project: string, resourceId: string, model: string): void {
  mkdirSync(STITCH_DIR, { recursive: true })
  if (!existsSync(LEDGER_FILE)) writeFileSync(LEDGER_FILE, `${LEDGER_HEADER}\n`)
  appendFileSync(LEDGER_FILE, `${new Date().toISOString()} | ${project} | ${op} | ${resourceId} | ${model}\n`)
}

/* ------------------------------------------------------------------ */
/* metadata.json                                                       */
/* ------------------------------------------------------------------ */

export interface ScreenMeta {
  screenId: string
  name: string
  title?: string
  device?: string
  model?: string
  generatedAt: string
}

export interface ProjectMeta {
  projectId: string
  title: string
  purpose: string
  createdAt: string
  updatedAt?: string
  /** true = recorded for reference only (created outside this tooling). */
  reference?: boolean
  screens?: Record<string, ScreenMeta>
}

export interface DesignSystemMeta {
  assetId: string
  projectId: string
  displayName: string
  source: string
  createdAt: string
  updatedAt?: string
}

export interface StitchMetadata {
  projects: Record<string, ProjectMeta>
  designSystems: Record<string, DesignSystemMeta>
  createdAt: string
}

function expectRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`[stitch] ${METADATA_FILE} is corrupt (${where} is not an object) — fix or delete the file and re-run bootstrap.`)
  }
  return value as Record<string, unknown>
}

function readProjects(value: unknown): Record<string, ProjectMeta> {
  const out: Record<string, ProjectMeta> = {}
  for (const [key, entry] of Object.entries(expectRecord(value, 'projects'))) {
    const rec = expectRecord(entry, `projects.${key}`)
    const projectId = asString(rec['projectId'])
    if (projectId === undefined) {
      throw new Error(`[stitch] ${METADATA_FILE} is corrupt (projects.${key}.projectId missing) — fix or delete the file and re-run bootstrap.`)
    }
    const screens: Record<string, ScreenMeta> = {}
    for (const [name, screen] of Object.entries(asRecord(rec['screens']))) {
      const sr = asRecord(screen)
      const screenId = asString(sr['screenId'])
      if (screenId === undefined) continue
      screens[name] = {
        screenId,
        name: asString(sr['name']) ?? name,
        title: asString(sr['title']),
        device: asString(sr['device']),
        model: asString(sr['model']),
        generatedAt: asString(sr['generatedAt']) ?? new Date(0).toISOString(),
      }
    }
    out[key] = {
      projectId,
      title: asString(rec['title']) ?? '(untitled)',
      purpose: asString(rec['purpose']) ?? '',
      createdAt: asString(rec['createdAt']) ?? new Date(0).toISOString(),
      updatedAt: asString(rec['updatedAt']),
      reference: rec['reference'] === true,
      screens,
    }
  }
  return out
}

function readDesignSystems(value: unknown): Record<string, DesignSystemMeta> {
  const out: Record<string, DesignSystemMeta> = {}
  for (const [key, entry] of Object.entries(expectRecord(value, 'designSystems'))) {
    const rec = expectRecord(entry, `designSystems.${key}`)
    const assetId = asString(rec['assetId'])
    const projectId = asString(rec['projectId'])
    if (assetId === undefined || projectId === undefined) {
      throw new Error(`[stitch] ${METADATA_FILE} is corrupt (designSystems.${key} missing ids) — fix or delete the file and re-run bootstrap.`)
    }
    out[key] = {
      assetId,
      projectId,
      displayName: asString(rec['displayName']) ?? '(unnamed)',
      source: asString(rec['source']) ?? DESIGN_MD_FILE,
      createdAt: asString(rec['createdAt']) ?? new Date(0).toISOString(),
      updatedAt: asString(rec['updatedAt']),
    }
  }
  return out
}

export function readMetadata(): StitchMetadata {
  if (!existsSync(METADATA_FILE)) {
    return { projects: {}, designSystems: {}, createdAt: new Date().toISOString() }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(METADATA_FILE, 'utf-8'))
  } catch (err) {
    throw new Error(`[stitch] ${METADATA_FILE} is not valid JSON — fix or delete it before continuing (${(err as Error).message})`)
  }
  const root = expectRecord(parsed, 'root')
  return {
    projects: readProjects(root['projects']),
    designSystems: readDesignSystems(root['designSystems']),
    createdAt: asString(root['createdAt']) ?? new Date(0).toISOString(),
  }
}

export function writeMetadata(meta: StitchMetadata): void {
  mkdirSync(STITCH_DIR, { recursive: true })
  writeFileSync(METADATA_FILE, `${JSON.stringify(meta, null, 2)}\n`)
}

/** Read → mutate → write in one step so partial runs never lose created ids. */
export function updateMetadata(mutate: (meta: StitchMetadata) => void): StitchMetadata {
  const meta = readMetadata()
  mutate(meta)
  writeMetadata(meta)
  return meta
}

/** Resolve `--project <key|id>`: metadata key when known, else the raw id. */
export function resolveProjectArg(value: string, meta: StitchMetadata): string {
  return meta.projects[value]?.projectId ?? value
}

/* ------------------------------------------------------------------ */
/* Artifact persistence                                                */
/* ------------------------------------------------------------------ */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * `--name` slugs become filenames under .stitch/designs/ — enforce a
 * lowercase slug (no dots/slashes) so no crafted name can escape the dir.
 */
export function assertSlug(name: string): void {
  if (!SLUG_RE.test(name)) {
    throw new Error(
      `invalid name "${name}" — must be a lowercase slug ([a-z0-9-], e.g. home-hero). It is used to write ${DESIGNS_DIR}/<name>.html and <name>.png.`,
    )
  }
}

/** URL host only — signed download URLs embed short-lived access tokens, never log them in full. */
function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '(unparsed-url)'
  }
}

async function download(url: string, what: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`could not download ${what} from ${safeHost(url)} (HTTP ${res.status}) — if the screen was generated earlier, its signed URL may have expired (G1-A: unknown TTL; regenerate instead).`)
  }
  return res.arrayBuffer()
}

export interface PersistedArtifacts {
  name: string
  htmlPath: string | null
  pngPath: string | null
  htmlBytes: number
  pngBytes: number
}

/**
 * Persist a screen's HTML + screenshot to .stitch/designs/{name}.{html,png}.
 *
 * MUST be called at generation time: `getHtml()`/`getImage()` return signed
 * download URLs cached on the generation response — variant screens cannot
 * be re-fetched later (get_screen → NOT_FOUND, G1-A) and URL TTL is unknown.
 * IMAGE-type screens carry no HTML (empty url) — noted, not fatal.
 */
export async function persistArtifacts(screen: Screen, name: string): Promise<PersistedArtifacts> {
  assertSlug(name)
  mkdirSync(DESIGNS_DIR, { recursive: true })
  const screenId = orDash(screen.id)

  const htmlUrl = await screen.getHtml()
  let htmlPath: string | null = null
  let htmlBytes = 0
  if (htmlUrl) {
    const bytes = await download(htmlUrl, 'screen HTML')
    htmlPath = join(DESIGNS_DIR, `${name}.html`)
    writeFileSync(htmlPath, Buffer.from(bytes))
    htmlBytes = bytes.byteLength
    console.log(`  saved ${htmlPath} (${htmlBytes} bytes)`)
  } else {
    console.warn(`  screen ${screenId} has no HTML artifact (IMAGE-type screens generate a picture only — G1-A quirk); skipped .html`)
  }

  const pngUrl = await screen.getImage()
  let pngPath: string | null = null
  let pngBytes = 0
  if (pngUrl) {
    const bytes = await download(pngUrl, 'screen screenshot')
    pngPath = join(DESIGNS_DIR, `${name}.png`)
    writeFileSync(pngPath, Buffer.from(bytes))
    pngBytes = bytes.byteLength
    console.log(`  saved ${pngPath} (${pngBytes} bytes)`)
  } else {
    console.warn(`  screen ${screenId} has no screenshot URL; skipped .png`)
  }

  return { name, htmlPath, pngPath, htmlBytes, pngBytes }
}

/* ------------------------------------------------------------------ */
/* Error masking                                                       */
/* ------------------------------------------------------------------ */

export interface StitchFailure {
  code: string
  message: string
  recoverable: boolean
  isStitchError: boolean
}

/**
 * Reduce any thrown value to code + message — NEVER a stack trace (stacks
 * can carry env frames) and NEVER anything derived from STITCH_API_KEY.
 */
export function describeFailure(error: unknown): StitchFailure {
  if (error instanceof StitchError) {
    return { code: error.code, message: error.message, recoverable: error.recoverable, isStitchError: true }
  }
  const message = error instanceof Error ? error.message : String(error)
  return { code: 'LOCAL_ERROR', message, recoverable: false, isStitchError: false }
}

/* ------------------------------------------------------------------ */
/* Elyra design-system payload (G2-6 F1 restructure)                   */
/* ------------------------------------------------------------------ */

/**
 * The create_design_system tool requires the {displayName, theme} envelope —
 * G1-D Part-1's top-level tokens/colors/components shape is NOT
 * transmittable. theme.designMd is the ONLY carrier for the 24 colors,
 * 11 component recipes, radius family and Cairo rules (the font enums lack
 * Cairo/JetBrains Mono — G2-6), so the FULL .stitch/DESIGN.md file content
 * is passed verbatim.
 *
 * Structured extras that the schema DOES accept:
 *   - typography: all 15 levels, every value a STRING (schema requires
 *     "700"/"1.1"/"64px" style values), fontFamily free-form;
 *   - spacing: Record<string,string> (base 4px → container-max-xl 1568px).
 * roundness ROUND_TWELVE is the closest enum step to the 14px anchor
 * (pill CTAs are a component-level rule in designMd, not the project
 * roundness). overrideNeutralColor pins the secondary-text neutral to the
 * AA-verified #56565C instead of a generated neutral.
 */
export function elyraDesignSystemPayload(designMd: string) {
  return {
    displayName: 'Elyra — إيليرا',
    theme: {
      colorMode: 'LIGHT',
      headlineFont: 'INTER',
      bodyFont: 'INTER',
      roundness: 'ROUND_TWELVE',
      customColor: '#0071E3',
      overrideNeutralColor: '#56565C',
      designMd,
      typography: {
        'display-xl': { fontFamily: 'Inter', fontSize: '64px', fontWeight: '700', lineHeight: '1.1', letterSpacing: '-0.02em' },
        'headline-lg': { fontFamily: 'Inter', fontSize: '40px', fontWeight: '600', lineHeight: '1.15', letterSpacing: '-0.015em' },
        'headline-md': { fontFamily: 'Inter', fontSize: '30px', fontWeight: '600', lineHeight: '1.2', letterSpacing: '-0.01em' },
        kicker: { fontFamily: 'Inter', fontSize: '14px', fontWeight: '500', lineHeight: '1.4', letterSpacing: '0.025em' },
        'body-lg': { fontFamily: 'Inter', fontSize: '18px', fontWeight: '400', lineHeight: '1.625' },
        'body-md': { fontFamily: 'Inter', fontSize: '16px', fontWeight: '400', lineHeight: '1.6' },
        'caption-md': { fontFamily: 'Inter', fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
        'label-mono': { fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: '400', lineHeight: '1.4', letterSpacing: '0.14em' },
        'ar-display-xl': { fontFamily: 'Cairo', fontSize: '64px', fontWeight: '800', lineHeight: '1.3', letterSpacing: '0em' },
        'ar-headline-lg': { fontFamily: 'Cairo', fontSize: '40px', fontWeight: '700', lineHeight: '1.3', letterSpacing: '0em' },
        'ar-headline-md': { fontFamily: 'Cairo', fontSize: '30px', fontWeight: '700', lineHeight: '1.3', letterSpacing: '0em' },
        'ar-kicker': { fontFamily: 'Cairo', fontSize: '14px', fontWeight: '600', lineHeight: '1.4', letterSpacing: '0em' },
        'ar-body-lg': { fontFamily: 'Cairo', fontSize: '18px', fontWeight: '400', lineHeight: '1.8' },
        'ar-body-md': { fontFamily: 'Cairo', fontSize: '16px', fontWeight: '400', lineHeight: '1.8' },
        'ar-caption-md': { fontFamily: 'Cairo', fontSize: '14px', fontWeight: '400', lineHeight: '1.7' },
      },
      spacing: {
        base: '4px',
        xs: '8px',
        sm: '16px',
        md: '24px',
        lg: '32px',
        xl: '64px',
        'section-y': '80px',
        'container-padding': '24px',
        'container-max': '1152px',
        'container-max-xl': '1568px',
      },
    },
  } as const
}
