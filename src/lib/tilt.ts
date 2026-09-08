/**
 * N3 (REF-3 T1) — hash-seeded angular dispersion.
 *
 * Every named element (a chip, a tag) gets ONE stable tilt in
 * [−3.5°, +2.5°] derived from a 31-multiplier string hash — the
 * "hand-placed, not machine-perfect" micro-organic look from the
 * REF-3 report (Olssons §2.2: θ = (hash mod 7) − 3.5). Pure function,
 * zero dependencies, SSR-safe: the same name always maps to the same
 * angle in every render and every locale.
 *
 * Use as a STATIC decorative transform (inline style) on elements that
 * don't otherwise animate `transform` — chips, tags, small badges.
 * Keep interactive elements' hit-targets unrotated if the rotation
 * makes adjacent chips overlap on narrow widths (±3.5° is safe).
 */
export function tiltFromName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0
  }
  // Math.abs keeps the modulo non-negative for the 32-bit signed hash.
  return (Math.abs(h) % 7) - 3.5
}
