/**
 * Elyra structured logger (F-S6-04 / F-S2-05 partial — gold-standard audit).
 *
 * Zero-dependency JSON-lines logger that replaces the raw console.* call
 * sites across src/ (14 at audit time). Design goals:
 *
 *   - SERVER: one JSON object per line (`level`, `scope`, `msg`, `ts`, plus
 *     arbitrary structured fields) — the shape log drains (Loki, Datadog,
 *     the planned pino/Sentry integration from the audit's 60-day roadmap)
 *     ingest without a parser change. PII never rides these lines by
 *     contract — callers pass statuses, codes and timings only.
 *   - CLIENT: the SAME module keeps working, but info/debug collapse to
 *     no-ops in production (support screenshots keep warn/error — e.g. the
 *     WebGL context-loss counters), and the payload stays the plain
 *     `[scope] message` console format (JSON lines in a browser console
 *     would only hurt readability, not parseability).
 *   - No transport abstraction, no async buffering: the call sites are
 *     rare, low-volume diagnostic paths — a synchronous write is the whole
 *     contract.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const isServer = typeof window === 'undefined'
const isProd = process.env.NODE_ENV === 'production'

/** ISO timestamp — monotonic ordering comes from the log drain, not here. */
function timestamp(): string {
  return new Date().toISOString()
}

function emit(level: Level, scope: string, msg: string, fields?: Record<string, unknown>): void {
  // Client production: only warn/error survive (GL-loss diagnostics etc.).
  if (!isServer && isProd && (level === 'debug' || level === 'info')) return

  const line = `[elyra:${scope}] ${msg}`
  const fn = level === 'debug' ? console.debug : level === 'info' ? console.info : level === 'warn' ? console.warn : console.error

  if (isServer) {
    // JSON line — one object, flat fields, level first (drain-friendly).
    fn(JSON.stringify({ level, scope, msg, ts: timestamp(), ...fields }))
  } else if (fields && Object.keys(fields).length > 0) {
    fn(line, fields)
  } else {
    fn(line)
  }
}

export const logger = {
  debug: (scope: string, msg: string, fields?: Record<string, unknown>) => emit('debug', scope, msg, fields),
  info: (scope: string, msg: string, fields?: Record<string, unknown>) => emit('info', scope, msg, fields),
  warn: (scope: string, msg: string, fields?: Record<string, unknown>) => emit('warn', scope, msg, fields),
  error: (scope: string, msg: string, fields?: Record<string, unknown>) => emit('error', scope, msg, fields),
}
