/**
 * Elyra Stitch CLI — dev-time design-generation tooling (G1-C blueprint).
 *
 * Run from the repo root with bun (auto-loads .env — STITCH_API_KEY is
 * env-only, never a CLI argument, never printed; see scripts/_stitch.ts):
 *
 *   bun scripts/stitch.ts list                        # read-only: all projects + screens (free)
 *   bun scripts/stitch.ts bootstrap [--force]         # create the two Elyra lab projects + the
 *                                                     #   Elyra design system on design-lab
 *   bun scripts/stitch.ts generate --project <key|id> --prompt-file <path> \
 *       [--name <slug>] [--model FLASH|PRO1] [--device DESKTOP|MOBILE|TABLET|AGNOSTIC]
 *   bun scripts/stitch.ts fetch --project <key|id> --screen <screenId> --name <slug>
 *   bun scripts/stitch.ts audit                       # offline: quota ledger + metadata summary
 *
 * Project keys (metadata.json): design-lab (on-brand, Elyra design system
 * applied), scene-lab (client-brand worlds for /work scenes — deliberately NO
 * Elyra design system, G2-2), research-sandbox (G1-A probe project, reference).
 *
 * Model map: FLASH → GEMINI_3_FLASH (default), PRO1 → GEMINI_3_1_PRO.
 * GEMINI_3_PRO is deprecated server-side and is never sent (G1-A/G2-6).
 *
 * Exit codes: 0 success · 2 RATE_LIMITED (recoverable — wait, do not
 * hammer-retry; the attempt is already in the ledger) · 1 everything else.
 *
 * This CLI is a pure API client: no ports, no dev-server interference, no
 * src/ imports. Artifacts land under .stitch/ (gitignored).
 */
import { existsSync, readFileSync } from 'node:fs'
import { stitch } from './_stitch'
import {
  MODEL_ALIASES,
  DEVICE_TYPES,
  DESIGN_MD_FILE,
  LEDGER_FILE,
  METADATA_FILE,
  asRecord,
  asString,
  assertSlug,
  describeFailure,
  elyraDesignSystemPayload,
  ledger,
  orDash,
  persistArtifacts,
  readMetadata,
  requireApiKey,
  resolveProjectArg,
  screenTitle,
  updateMetadata,
  writeMetadata,
} from './_stitch'
import type { DeviceType, ModelAlias, StitchMetadata } from './_stitch'

/* ------------------------------------------------------------------ */
/* Usage + arg parsing (hand-rolled — no new deps, house rule)         */
/* ------------------------------------------------------------------ */

const USAGE = `Usage: bun scripts/stitch.ts <command> [flags]

  list                                     read-only: projects + screens (free)
  bootstrap [--force]                      create design-lab + scene-lab projects,
                                           Elyra design system on design-lab, metadata
  generate --project <key|id> --prompt-file <path>
           [--name <slug>] [--model FLASH|PRO1]
           [--device DESKTOP|MOBILE|TABLET|AGNOSTIC]
  fetch --project <key|id> --screen <screenId> --name <slug>
  audit                                    offline: ledger summary + metadata

Notes:
  --model  FLASH (default, GEMINI_3_FLASH) or PRO1 (GEMINI_3_1_PRO).
           GEMINI_3_PRO is deprecated server-side — this CLI never sends it.
  --name   becomes .stitch/designs/<name>.html + .png — lowercase slug only.
  fetch    re-fetches a REGULAR screen's artifacts; variant screens are not
           re-fetchable server-side (get_screen → NOT_FOUND, G1-A) — which is
           why generate persists artifacts immediately.
  exit     0 ok · 2 RATE_LIMITED (wait, then retry) · 1 other errors.`

class UsageError extends Error {}

interface ParsedArgs {
  values: Record<string, string>
  flags: Set<string>
}

function parseArgs(args: string[], allowed: readonly string[]): ParsedArgs {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''
    if (!arg.startsWith('--')) {
      throw new UsageError(`unexpected argument "${arg}"`)
    }
    const eq = arg.indexOf('=')
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    if (!allowed.includes(name)) {
      throw new UsageError(`unknown flag ${arg} (allowed: ${allowed.map((a) => `--${a}`).join(', ')})`)
    }
    if (eq !== -1) {
      if (arg.slice(eq + 1) === '') throw new UsageError(`--${name}= is empty`)
      values[name] = arg.slice(eq + 1)
      continue
    }
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      values[name] = next
      i++
    } else {
      flags.add(name)
    }
  }
  return { values, flags }
}

function requiredFlag(args: ParsedArgs, name: string): string {
  const value = args.values[name]
  if (value === undefined || value === '') {
    throw new UsageError(`missing required flag --${name}`)
  }
  return value
}

/* ------------------------------------------------------------------ */
/* list — read-only                                                    */
/* ------------------------------------------------------------------ */

function findMetadataKey(meta: StitchMetadata, projectId: string): string | undefined {
  for (const [key, entry] of Object.entries(meta.projects)) {
    if (entry.projectId === projectId) return key
  }
  return undefined
}

async function cmdList(): Promise<number> {
  requireApiKey()
  const meta = readMetadata()
  const projects = await stitch.projects()
  console.log(`Stitch projects visible to this key (${projects.length}):`)
  for (const project of projects) {
    const data = asRecord(project.data)
    const title = asString(data['title']) ?? asString(data['name']) ?? '(untitled)'
    const key = findMetadataKey(meta, project.projectId)
    console.log(`- ${project.projectId}  "${title}"${key !== undefined ? `  [local key: ${key}]` : ''}`)
    let screens: Awaited<ReturnType<typeof project.screens>> = []
    try {
      screens = await project.screens()
    } catch (err) {
      console.log(`    screens: list_screens failed (${describeFailure(err).message})`)
    }
    if (screens.length === 0) {
      console.log('    0 screens (variant screens are not enumerable server-side — G1-A)')
    } else {
      for (const screen of screens) {
        console.log(`    screen ${orDash(screen.id)}  ${screenTitle(screen) ?? ''}`)
      }
    }
  }
  return 0
}

/* ------------------------------------------------------------------ */
/* bootstrap — projects + design system                                */
/* ------------------------------------------------------------------ */

const BOOTSTRAP_PROJECTS = [
  {
    key: 'design-lab',
    title: 'Elyra-Design-Lab',
    purpose: 'On-brand Elyra generations (homepage bento / trust-band / service pages). The Elyra design system is applied at project level.',
  },
  {
    key: 'scene-lab',
    title: 'Elyra-Scene-Lab',
    purpose: 'Client-brand-world scene mockups for /work before-after sections. NO Elyra design system here — each scene needs its own brand world (G2-2).',
  },
] as const

const RESEARCH_SANDBOX = {
  key: 'research-sandbox',
  projectId: '14884067107302147330',
  title: 'Elyra Research Sandbox',
  purpose: 'G1-A live-probe project (created 2026-08, 1 generate + 1 variants batch). Left as-is; recorded for read-only reference.',
} as const

async function cmdBootstrap(force: boolean): Promise<number> {
  requireApiKey()
  const meta = readMetadata()

  // 1. The two lab projects.
  for (const spec of BOOTSTRAP_PROJECTS) {
    const existing = meta.projects[spec.key]
    if (existing !== undefined && !force) {
      console.log(`project ${spec.key}: already bootstrapped (${existing.projectId}) — skipping (use --force to re-create)`)
      continue
    }
    const project = await stitch.createProject(spec.title)
    const projectId = orDash(project.id)
    ledger('bootstrap:create-project', spec.key, projectId, '-')
    console.log(`created project ${spec.key}: ${projectId} "${spec.title}"`)
    meta.projects[spec.key] = {
      projectId,
      title: spec.title,
      purpose: spec.purpose,
      createdAt: new Date().toISOString(),
    }
    writeMetadata(meta) // persist immediately — a later step failing must not lose this id
  }

  // 2. Reference project from the G1-A live probe (created outside this tooling).
  if (meta.projects[RESEARCH_SANDBOX.key] === undefined) {
    meta.projects[RESEARCH_SANDBOX.key] = {
      projectId: RESEARCH_SANDBOX.projectId,
      title: RESEARCH_SANDBOX.title,
      purpose: RESEARCH_SANDBOX.purpose,
      createdAt: new Date().toISOString(),
      reference: true,
    }
    writeMetadata(meta)
    console.log(`recorded reference project ${RESEARCH_SANDBOX.key}: ${RESEARCH_SANDBOX.projectId} (left untouched)`)
  }

  // 3. The Elyra design system on design-lab (G2-6 F1 restructured payload).
  const designLab = meta.projects['design-lab']
  if (designLab === undefined) throw new Error('design-lab project is missing from metadata — cannot attach the design system')
  const existingDs = meta.designSystems['design-lab']
  if (existingDs !== undefined && !force) {
    console.log(`design system design-lab: already bootstrapped (${existingDs.assetId}) — skipping (use --force to re-create)`)
  } else {
    if (!existsSync(DESIGN_MD_FILE)) {
      throw new Error(`${DESIGN_MD_FILE} not found — designMd is the ONLY carrier for the 24 colors, components and Cairo rules (G2-6 F1). Author it first.`)
    }
    const designMd = readFileSync(DESIGN_MD_FILE, 'utf-8')
    const payload = elyraDesignSystemPayload(designMd)
    const project = stitch.project(designLab.projectId)
    console.log(`creating design system "Elyra — إيليرا" on ${designLab.projectId} (designMd ${designMd.length} chars · 15 typography levels · 10 spacing tokens)…`)

    const created = await project.createDesignSystem(payload)
    const assetId = orDash(created.id)
    ledger('bootstrap:create-design-system', 'design-lab', assetId, '-')
    console.log(`created design system (assetId ${assetId})`)

    // The tool's own embedded instruction: call update_design_system
    // immediately after create so the design system sticks at PROJECT level
    // (create alone leaves it as a loose asset).
    if (!created.id) {
      console.warn('create returned no asset id — skipping the project-level update step (the asset exists but may not be applied; re-run with --force)')
    } else {
      const updated = await created.update(payload)
      const updatedId = orDash(updated.id)
      ledger('bootstrap:update-design-system', 'design-lab', updatedId, '-')
      console.log(`applied design system at project level (assetId ${updatedId})`)
    }

    meta.designSystems['design-lab'] = {
      assetId: assetId === '-' ? existingDs?.assetId ?? '-' : assetId,
      projectId: designLab.projectId,
      displayName: 'Elyra — إيليرا',
      source: DESIGN_MD_FILE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeMetadata(meta)
  }

  // 4. Free-read verification.
  const systems = await stitch.project(meta.projects['design-lab']?.projectId ?? '').listDesignSystems()
  console.log(`verification: list_design_systems on ${meta.projects['design-lab']?.projectId ?? '-'} → ${systems.length} design system(s)`)
  for (const system of systems) {
    const rec = asRecord(system.data)
    console.log(`  - ${orDash(system.id)}  version ${asString(rec['version']) ?? '?'}  displayName ${asString(asRecord(rec['designSystem'])['displayName']) ?? '?'}`)
  }
  return 0
}

/* ------------------------------------------------------------------ */
/* generate (quota-consuming — always ledgered, even on failure)       */
/* ------------------------------------------------------------------ */

async function cmdGenerate(args: ParsedArgs): Promise<number> {
  requireApiKey()
  const projectArg = requiredFlag(args, 'project')
  const promptFile = requiredFlag(args, 'prompt-file')

  const modelAlias = args.values['model'] ?? 'FLASH'
  if (!(modelAlias in MODEL_ALIASES)) {
    throw new UsageError(`invalid --model "${modelAlias}" — use FLASH or PRO1 (GEMINI_3_PRO is deprecated server-side and never sent)`)
  }
  const modelId = MODEL_ALIASES[modelAlias as ModelAlias]

  const deviceArg = args.values['device'] ?? 'DESKTOP'
  if (!DEVICE_TYPES.includes(deviceArg as DeviceType)) {
    throw new UsageError(`invalid --device "${deviceArg}" — one of ${DEVICE_TYPES.join(' | ')}`)
  }
  const device: DeviceType = deviceArg as DeviceType

  const name = args.values['name'] ?? promptFile.replace(/^.*\//, '').replace(/\.[^./]*$/, '')
  assertSlug(name)

  if (!existsSync(promptFile)) throw new Error(`prompt file not found: ${promptFile}`)
  const prompt = readFileSync(promptFile, 'utf-8')
  if (prompt.trim() === '') throw new Error(`prompt file is empty: ${promptFile}`)

  const meta = readMetadata()
  const projectId = resolveProjectArg(projectArg, meta)
  const project = stitch.project(projectId)
  console.log(`generate → ${projectArg} (${projectId}) · model ${modelId} · device ${device} · artifact name "${name}"`)

  let screenId = '-'
  try {
    const screen = await project.generate(prompt, device, modelId)
    screenId = orDash(screen.id)
    const title = screenTitle(screen) ?? '(untitled)'
    console.log(`generated screen ${screenId} — "${title}"`)
    await persistArtifacts(screen, name)

    updateMetadata((m) => {
      const entry = m.projects[projectArg]
      if (entry === undefined) {
        console.log(`note: "${projectArg}" is not a metadata key — screen not registered in ${METADATA_FILE}`)
        return
      }
      entry.screens = entry.screens ?? {}
      entry.screens[name] = { screenId, name, title, device, model: modelId, generatedAt: new Date().toISOString() }
      entry.updatedAt = new Date().toISOString()
    })
    console.log('done — artifacts in .stitch/designs/, screen registered in metadata.json')
  } finally {
    // Quota ledger discipline (G1-C): record the ATTEMPT before process exit
    // even on failure — credits can be consumed by a call that visibly errored.
    ledger('generate', projectArg, screenId, modelId)
  }
  return 0
}

/* ------------------------------------------------------------------ */
/* fetch — re-persist a REGULAR screen's artifacts (free, read-only)   */
/* ------------------------------------------------------------------ */

async function cmdFetch(args: ParsedArgs): Promise<number> {
  requireApiKey()
  const projectArg = requiredFlag(args, 'project')
  const screenArg = requiredFlag(args, 'screen')
  const name = requiredFlag(args, 'name')
  assertSlug(name)

  const meta = readMetadata()
  const project = stitch.project(resolveProjectArg(projectArg, meta))
  console.log(`fetching screen ${screenArg} from ${projectArg}…`)
  const screen = await project.getScreen(screenArg)
  console.log(`screen ${screenArg} — "${screenTitle(screen) ?? '(untitled)'}"`)
  await persistArtifacts(screen, name)
  console.log('done (read-only op — no ledger entry, no quota consumed)')
  return 0
}

/* ------------------------------------------------------------------ */
/* audit — offline ledger + metadata summary                           */
/* ------------------------------------------------------------------ */

function cmdAudit(): number {
  const meta = readMetadata()
  const counts = new Map<string, number>()
  let total = 0
  if (existsSync(LEDGER_FILE)) {
    for (const line of readFileSync(LEDGER_FILE, 'utf-8').split('\n')) {
      if (line === '' || line.startsWith('#')) continue
      total++
      const op = line.split(' | ')[2] ?? '(unknown-op)'
      counts.set(op, (counts.get(op) ?? 0) + 1)
    }
  }
  console.log(`Quota ledger (${LEDGER_FILE}) — ${total} recorded operation(s):`)
  if (counts.size === 0) {
    console.log('  (no entries yet)')
  } else {
    for (const [op, count] of counts) {
      console.log(`  ${String(count).padStart(3)} × ${op}`)
    }
  }
  console.log(`\nMetadata (${METADATA_FILE}, createdAt ${meta.createdAt}):`)
  for (const [key, entry] of Object.entries(meta.projects)) {
    const screens = entry.screens ?? {}
    console.log(`  project ${key}: ${entry.projectId} "${entry.title}" — ${Object.keys(screens).length} registered screen(s)${entry.reference === true ? ' [reference]' : ''}`)
  }
  for (const [key, entry] of Object.entries(meta.designSystems)) {
    console.log(`  design system ${key}: ${entry.assetId} "${entry.displayName}" (source: ${entry.source})`)
  }
  return 0
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  const rest = argv.slice(1)

  switch (cmd) {
    case 'list':
      return cmdList()
    case 'bootstrap': {
      const args = parseArgs(rest, ['force'])
      return cmdBootstrap(args.flags.has('force'))
    }
    case 'generate': {
      const args = parseArgs(rest, ['project', 'prompt-file', 'name', 'model', 'device'])
      return cmdGenerate(args)
    }
    case 'fetch': {
      const args = parseArgs(rest, ['project', 'screen', 'name'])
      return cmdFetch(args)
    }
    case 'audit':
      return cmdAudit()
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE)
      return 0
    case undefined:
      console.error(USAGE)
      return 1
    default:
      throw new UsageError(`unknown command "${cmd}" — see "bun scripts/stitch.ts help"`)
  }
}

main()
  .catch((error) => {
    if (error instanceof UsageError) {
      console.error(`[stitch] ${error.message}`)
      console.error(USAGE)
      return 1
    }
    const failure = describeFailure(error)
    if (failure.code === 'RATE_LIMITED') {
      console.error(`[stitch] RATE_LIMITED: ${failure.message}`)
      console.error(
        'Recoverable — WAIT before retrying (tool docs mark generations do-not-retry; check state with the free ops `list` / `audit`). The failed attempt is already in the quota ledger.',
      )
      return 2
    }
    console.error(`[stitch] ${failure.code}: ${failure.message}`)
    return 1
  })
  // Close the MCP connection before exiting (an async finally delays the
  // chain until close settles). Never-connected or already-closed is fine.
  .finally(async () => {
    try {
      await stitch.close()
    } catch {
      /* client never connected / already closed */
    }
  })
  .then((code) => process.exit(code))
