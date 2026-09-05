/**
 * SO-1 (G3-5, code-level — no Stitch, quota untouched): per-service hero
 * signature zones for the two service pages, rendered through PageHero's
 * `decorative` slot. Guided by G2-3's SO-1 prompt structure (websites =
 * blueprint/wireframe motif, automation = node-flow motif) but built from
 * pure CSS/SVG with the existing component idioms.
 *
 * Both motifs are:
 *  - purely decorative: aria-hidden + pointer-events-none, zero text —
 *    no catalog keys, nothing for assistive tech to read;
 *  - LCP-safe: static markup, no entrance animation (Phase 3 §4.1 — the
 *    hero's LCP candidates paint with the first server-rendered frame,
 *    and a motif must never delay or shift them);
 *  - reduced-motion safe: WebsitesHeroMotif is fully static;
 *    AutomationHeroMotif's single pulse is `animate-ping`, which the
 *    global prefers-reduced-motion kill-switch (globals.css) collapses
 *    to its resting frame — the same treatment as the n8n band badge;
 *  - RTL-safe: the blueprint strip mirrors via
 *    rtl:[transform:scaleX(-1)] so the accent corner bracket lands on the
 *    reading-start side; the flow motif is direction-symmetric (flex
 *    order follows the reading direction, the pulsing hub stays
 *    centered).
 *
 * Server-renderable (no hooks) — passed as an element prop from the
 * server pages into the client PageHero (standard RSC pattern).
 */

export function WebsitesHeroMotif() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex justify-center px-6"
      aria-hidden="true"
    >
      {/* A calm "page under construction" blueprint strip: three hairline
          wireframe blocks on a ruled baseline, one accent corner bracket
          on the primary block. Sits in the hero's bottom padding band. */}
      <svg
        // rtl:[transform:scaleX(-1)] mirrors the whole strip in Arabic so
        // the accent bracket lands on the reading-start side. (An arbitrary
        // property is used because Tailwind v4 does not generate a
        // `-scale-x-100` utility — verified against the compiled sheet.)
        className="h-24 w-full max-w-3xl rtl:[transform:scaleX(-1)]"
        viewBox="0 0 960 120"
        fill="none"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* baseline + measurement ticks — the blueprint ruler */}
        <line x1="80" y1="104" x2="880" y2="104" stroke="rgba(241,245,249,0.10)" />
        {[140, 340, 380, 510, 560, 640].map((x) => (
          <line key={x} x1={x} y1="100" x2={x} y2="108" stroke="rgba(241,245,249,0.18)" />
        ))}
        {/* wireframe blocks — the primary block is the strongest hairline */}
        <rect x="140" y="48" width="200" height="56" rx="6" stroke="rgba(241,245,249,0.16)" />
        <rect x="380" y="48" width="130" height="56" rx="6" stroke="rgba(241,245,249,0.11)" />
        <rect x="560" y="48" width="80" height="56" rx="6" stroke="rgba(241,245,249,0.08)" />
        {/* one "title line" suggestion inside the primary block */}
        <line x1="162" y1="66" x2="318" y2="66" stroke="rgba(241,245,249,0.10)" />
        {/* the single accent: a corner bracket wrapping the primary block's
            top-start corner (mirrors to top-right under the RTL flip) */}
        <path
          d="M124 62 V32 H152"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-primary"
        />
      </svg>
    </div>
  )
}

export function AutomationHeroMotif() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-8 -z-10 flex justify-center"
      aria-hidden="true"
    >
      {/* Compact three-node flow — the service's core idea in miniature:
          two endpoints, one pulsing hub (the n8n webhook), hairline
          connectors. Centered in the hero's bottom padding band. */}
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="size-2 rounded-full bg-white/30" />
        <span className="h-px w-12 bg-gradient-to-r from-white/5 via-white/20 to-white/5 sm:w-20" />
        {/* the hub: one pulse on the center node (the animate-ping halo is
            collapsed by the global reduced-motion kill-switch; the static
            core dot remains) */}
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <span className="h-px w-12 bg-gradient-to-r from-white/5 via-white/20 to-white/5 sm:w-20" />
        <span className="size-2 rounded-full bg-white/30" />
      </div>
    </div>
  )
}
