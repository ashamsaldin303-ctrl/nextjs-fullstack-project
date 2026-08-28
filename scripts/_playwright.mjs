/**
 * Shared Playwright loader (L6-F2 FIX K).
 *
 * The verify-*.mjs scripts used to hardcode a machine-specific import —
 * '/home/z/.npm-global/lib/node_modules/playwright/index.mjs' — which made
 * them unrunnable on any other machine (and playwright is not a
 * devDependency of this repo). Resolution order:
 *
 *   1. bare `playwright` specifier — works wherever playwright IS installed
 *      (as a dependency or otherwise resolvable from the repo root),
 *   2. PLAYWRIGHT_MODULE env override — the operator's "set the path"
 *      escape hatch (absolute path to playwright's index.mjs),
 *   3. the known global npm prefix path from the original sandbox machine.
 *
 * If nothing resolves, throws a helpful error instead of a bare
 * ERR_MODULE_NOT_FOUND.
 */
export async function getChromium() {
  // 1. Normal package resolution.
  try {
    return (await import('playwright')).chromium
  } catch {
    /* not installed — keep trying */
  }

  // 2. Explicit operator override (absolute path to playwright's entry).
  const override = process.env.PLAYWRIGHT_MODULE
  if (override) {
    const mod = await import(override).catch((err) => {
      throw new Error(
        `[scripts/_playwright.mjs] PLAYWRIGHT_MODULE is set (${override}) but could not be imported: ${err.message}`,
      )
    })
    return mod.chromium
  }

  // 3. Known global prefix from the original sandbox.
  try {
    return (await import('/home/z/.npm-global/lib/node_modules/playwright/index.mjs')).chromium
  } catch {
    /* absent on this machine — fall through to the error */
  }

  throw new Error(
    '[scripts/_playwright.mjs] Playwright could not be loaded. Install it ' +
      '(e.g. `bun add -d playwright` then `bunx playwright install chromium`) ' +
      'or set PLAYWRIGHT_MODULE to the absolute path of playwright\'s index.mjs.',
  )
}
