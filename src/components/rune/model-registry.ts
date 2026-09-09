/**
 * Model Registry (MODEL-3) — the TECHNICAL-ESSENCE slot table.
 *
 * OWNER'S THIRD VERDICT (verbatim intent): the craft/workshop set was
 * «أثاث منزل وقطع تاريخية» — furniture and historical pieces. What the
 * site's bodies must say now is the site's ماهية ووظيفته — its essence
 * and its function, NOT its identity: the things a digital studio
 * actually BUILDS. Software. Infrastructure. Automation. Devices.
 * Signals.
 *
 * Answer: the Elyra MACHINE ROOM — eight authored technical kits
 * (src/components/rune/tech-kits.ts) + one real photoscanned PCB (Poly
 * Haven circuit_board — the single fitting technical scan in their
 * 521-model catalog; full research record in
 * scripts/fetch-models-m3.mjs + the worklog MODEL-3 entry) + the one
 * survivor of the previous set, the 404 debugging duck. Every object
 * MEANS its section — the mapping is the design:
 *
 *   · HOME HERO — the SERVER RACK: «نبني ما يعمل» — the machine room.
 *     Every site Elyra ships lives in one of these; its three fans are
 *     LIVE ODOMETERS of D — the rack runs exactly as far as you scroll
 *     and freezes when you stop.
 *   · HOME METHOD — the CPU CHIP: «بدقة العلماء» — engineering
 *     precision at micrometer scale: die, capacitors, gold pin grid.
 *     The method object says everything by being exact.
 *   · WEBSITES HERO — the STUDIO LAPTOP: «اللوحة التي تولد عليها
 *     المواقع» — the canvas every website is born on, its screen a
 *     live wireframe of a homepage (emerald blocks, gold underline,
 *     the cursor placing the next element). The lid breathes with the
 *     scroll.
 *   · AUTOMATION HERO — the ROBOT ARM: «الآلة التي تعمل بتمريرك» — THE
 *     machine, successor of the drill press. Shoulder, elbow, wrist
 *     and gripper sweeps ride the section's travel p: the arm cycles
 *     through its work pose — reaching, then presenting its glowing
 *     workpiece — and replays it exactly in reverse when you scroll
 *     back up. Automation, made literal.
 *   · WORK HERO — the SMARTPHONE: «العمل يعمل في يد العميل» — the
 *     shipped product in the hand: app-grid wireframe screen, camera
 *     island, gold side keys.
 *   · ABOUT HERO — the CIRCUIT BOARD (the real photoscan): «صنعة
 *     اليد الجديدة — دوائر مطبوعة» — the craft is now etched traces
 *     and soldered components; a REAL scanned PCB with full PBR.
 *   · ABOUT STORY — the DATA STACK: «الأرشيف» — four storage sleds in
 *     a gold-railed frame; sled_c SLIDES OUT of the array across the
 *     story's travel — a volume pulled from the shelf, successor of
 *     the pulled encyclopedia volumes.
 *   · CONTACT HERO — the DISH ANTENNA: «أرسل الإشارة» — the parabolic
 *     dish that ACQUIRES you: azimuth and elevation sweeps track the
 *     section's travel, the feed tip glowing emerald — the signal,
 *     waiting for one message.
 *   · 404 — the RUBBER DUCK (survivor, and the most technical object
 *     of them all): rubber-duck debugging — a wink every developer
 *     reads instantly. Not furniture, not history: programmer culture.
 *
 * This file is PURE TS (no three.js import — it must stay inside the
 * FIRST bundle chunk, the rune-landmarks contract): everything the
 * driver (rune-scene.tsx) needs to place, size and pace each body
 * lives here — the model's source (a downloaded GLTF path OR an
 * authored kit name), its normalization fit, its rest pose, its part
 * drives, and per-route SLOTS (section anchor id, logical side,
 * vertical anchor fraction, viewport-size fraction, depth plane,
 * scrub rotation, light/dark wash palette).
 *
 * Motion contract (unchanged, now on technical bodies):
 * · «التمرير هو الزمن» — every transform is a pure function of
 *   (section rect, D, S). Whole-body rotation SCRUBS with the section's
 *   travel p (reversible, frame-identical up and down); parts are
 *   odometers of D (the rack's fans), sweeps of p (the arm's joints,
 *   the dish's acquisition, the pulled sled), or swings (the laptop's
 *   lid). Zero wall-clock, zero randomness.
 * · «التوقف = تجمّد مطلق» — stop scrolling and the GPU renders zero
 *   frames (frameloop="demand" + the invalidate bus + freeze-proof
 *   `frames` counter).
 * · Placement — STABLE SLOTS: a model keeps its size and its composed
 *   position for the whole time its section is on stage (no roaming, no
 *   ballooning); it MATERIALIZES (fade + rise + settle) as the section
 *   arrives and dissolves as it leaves, always grounded by a contact
 *   shadow. Scrolling up replays the same design in reverse.
 */

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

/* ------------------------------------------------------------------ *
 * Part drives — named nodes of the real models, animated BY SCROLL.
 * Node names are suffix-matched against the asset's own node names
 * (see public/models/manifest.json + tech-kits.ts node names).
 * ------------------------------------------------------------------ */

/** One controllable part of a real model. */
export interface PartDrive {
  /** Node-name substring to find (e.g. 'fan_a'). */
  node: string
  /** Local rotation axis the part turns around (also the slide axis
   *  for slide drives). */
  axis: 'x' | 'y' | 'z'
  /** ODOMETER: rotation = base + D · rate (radians per pixel of
   *  signed scroll) — the rack's fans are literal odometers: the
   *  machine runs exactly as far as you scroll. With `swing`, rate
   *  instead becomes the swing FREQUENCY (no accumulation). */
  rate?: number
  /** SWEEP (absolute radians [from, to] over the section's travel p,
   *  eased) — the arm's joints cycling through a work pose, the dish
   *  acquiring, the gripper closing on the workpiece. */
  sweep?: [number, number]
  /** SWING: rotation = base + sin(D · rate) · swing — e.g. the laptop
   *  lid breathing gently with the scroll. */
  swing?: number
  /** SNAP STEPS: rotation = base + floor(p · steps) · (2π / steps). */
  steps?: number
  /** SLIDE (position offset [from, to] over the section's travel p,
   *  eased, model-local units along `axis`) — the pulled storage sled
   *  sliding out of the data stack. */
  slide?: [number, number]
}

/* ------------------------------------------------------------------ *
 * The machine-room library — one entry per body (kit or download).
 * ------------------------------------------------------------------ */

export interface ModelDef {
  /** Registry key (kits) or Poly Haven slug (downloads) — also the
   *  debug/verification identity of the body. */
  slug: string
  /** Authored kit name (tech-kits.ts) — mutually exclusive with src. */
  kit?: string
  /** Load path under /public for downloaded GLTF assets. */
  src?: string
  /** Which bounding-box dimension the viewport fraction fits. */
  fit: 'height' | 'max' | 'width'
  /** Resting yaw — each model's best face leads. */
  yaw: number
  /** Resting pitch tilt (radians, X axis). */
  tilt?: number
  /** PBR environment intensity multiplier (brass vs matte balance). */
  envIntensity?: number
  /** Uniform warm EMISSIVE intensity (kept for downloaded GLTFs). */
  glow?: number
  /** Scroll-driven named parts. */
  drives?: readonly PartDrive[]
}

export const MODEL_LIBRARY: Record<string, ModelDef> = {
  serverRack: {
    slug: 'serverRack',
    kit: 'serverRack',
    fit: 'height',
    yaw: 0.22,
    envIntensity: 0.95, // VLM r2 r3: the gunmetal wants its edge reads
    // THE MACHINE ROOM RUNS ON SCROLL: three fans spin on the
    // total-scroll odometer — pure functions of your scrolling
    // distance, frozen when you stop.
    drives: [
      { node: 'fan_a', axis: 'z', rate: 0.02 },
      { node: 'fan_b', axis: 'z', rate: 0.026 },
      { node: 'fan_c', axis: 'z', rate: 0.02 },
    ],
  },
  cpuChip: {
    slug: 'cpuChip',
    kit: 'cpuChip',
    fit: 'max',
    yaw: 0.55,
    tilt: 0.55, // die, capacitors and pin grid all read at once
    envIntensity: 1.3, // silicon and gold want their reflections
    // A single precise body — the chip says everything by being exact.
  },
  laptopStudio: {
    slug: 'laptopStudio',
    kit: 'laptopStudio',
    fit: 'max',
    yaw: -0.45,
    tilt: 0.3, // VLM r1: gentler pitch — the born-on screen faces the
    // visitor head-on while the deck still reads in 3/4
    envIntensity: 1.1,
    // The lid breathes gently around its open pose — a ±0.03 rad
    // sway with the scroll (rate = swing frequency, never accumulates).
    drives: [{ node: 'lid', axis: 'x', swing: 0.03, rate: 0.004 }],
  },
  robotArm: {
    slug: 'robotArm',
    kit: 'robotArm',
    fit: 'height',
    yaw: 0.3,
    envIntensity: 0.95,
    // THE ARM CYCLES WITH YOUR SCROLL: every joint is a sweep of the
    // section's travel p — the arm reaches, then presents its glowing
    // workpiece, and replays the cycle exactly in reverse when you
    // scroll back up. The gripper closes on the workpiece as the
    // section settles.
    drives: [
      { node: 'shoulder', axis: 'z', sweep: [0.55, 0.12] },
      { node: 'elbow', axis: 'z', sweep: [-1.18, -0.72] },
      { node: 'wrist', axis: 'z', sweep: [0.9, 0.4] },
      { node: 'grip_l', axis: 'z', sweep: [0.34, 0.12] },
      { node: 'grip_r', axis: 'z', sweep: [-0.34, -0.12] },
    ],
  },
  smartphone: {
    slug: 'smartphone',
    kit: 'smartphone',
    fit: 'max',
    yaw: -0.2, // VLM r1: the SCREEN is the message — with the slot's
    // scrub the rest pose (yaw + scrub·ease(p≈0.57)) lands ≈0 rad: the
    // app face looks straight at the visitor, turning only as the
    // section leaves.
    tilt: -0.08,
    envIntensity: 1.2,
    // The product shot — the shipped work in the client's hand.
  },
  circuitBoard: {
    slug: 'circuit_board',
    src: '/models/circuit_board/circuit_board_1k.gltf',
    fit: 'max',
    yaw: 0.35,
    tilt: 0.6, // VLM r2: traces' face more toward the reader
    envIntensity: 1.25, // VLM r2: contrast + saturation of the scan
  },
  dataStack: {
    slug: 'dataStack',
    kit: 'dataStack',
    fit: 'max',
    yaw: 0.35,
    tilt: 0.1,
    envIntensity: 0.9,
    // The archive's volume is PULLED from the stack across the story's
    // travel — a storage sled sliding out of the array.
    drives: [{ node: 'sled_c', axis: 'x', slide: [0, 0.33] }],
  },
  dishAntenna: {
    slug: 'dishAntenna',
    kit: 'dishAntenna',
    fit: 'height',
    yaw: 0.1,
    tilt: 0.2, // VLM r4: mast leans toward the viewer — the camera sits
    // BELOW the head, so the concave face + feed open up to it
    envIntensity: 1.0,
    // (slot scrub 0.25 — VLM r1: less holder yaw so the concave face
    // + feed read at rest instead of the dish's back.)
    // THE DISH ACQUIRES YOU: azimuth sweeps the head while elevation
    // rises from horizon-idle to the classic ~30° transmitting pose at
    // rest and on toward the sky as the section travels; the feed tip
    // glows emerald — the signal, waiting.
    drives: [
      { node: 'azimuth', axis: 'y', sweep: [-0.35, 0.7] },
      { node: 'elevation', axis: 'x', sweep: [0.15, -0.9] },
    ],
  },
  duck: {
    slug: 'rubber_duck_toy',
    src: '/models/rubber_duck_toy/rubber_duck_toy_1k.gltf',
    fit: 'max',
    yaw: -0.4,
    tilt: 0.05,
    envIntensity: 1.0,
    // The 404 SURVIVOR — rubber-duck debugging: programmer culture,
    // the one body from the previous set that was already technical.
    // A gentle waddle AROUND the rest pose — the duck rocks in place
    // (rate = swing frequency, never accumulates).
    drives: [{ node: 'rubber_duck_toy', axis: 'z', swing: 0.06, rate: 0.004 }],
  },
}

/* ------------------------------------------------------------------ *
 * Slots — a route's technical bodies, glued to real sections.
 * ------------------------------------------------------------------ */

export type SlotSide = 'start' | 'end' | 'center'

export interface ModelSlot {
  /** MODEL_LIBRARY key. */
  model: string
  /** Section heading id (aria-labelledby target → closest('section')). */
  id: string
  /** Free-margin side (logical — mirrored by writing direction). */
  side: SlotSide
  /** Vertical anchor inside the section, 0..1. */
  yFrac: number
  /** Model's fitted dimension as a fraction of viewport height — a
   * STABLE size held for the section's whole stay (no ballooning). */
  viewFrac: number
  /** Depth plane (world z; the perspective camera adds real parallax
   * between planes when the pointer moves). */
  z: number
  /** Whole-body scrub rotation (radians) across the section's travel —
   * always reversed by scrolling back up. */
  scrub: number
  /** Wash palette matching the section's background band. */
  palette: 'light' | 'dark'
  /** Lateral nudge on the anchor fraction (negative = toward edge). */
  xPad?: number
  /** Extra world-Y offset (fraction of the model's height). */
  yOff?: number
}

export interface ModelRoute {
  slots: readonly ModelSlot[]
  /** Ambient dust density multiplier. */
  dust: number
}

/** «تموضع صحيح»: every body holds a stable, composed slot in the free
 * margin of its section — hero models sit at the page-hero's empty
 * side (~half the viewport tall), mid-page witnesses are smaller and
 * deeper. One or two per route: authority, not decoration soup. */
export const MODEL_ROUTES: Record<RunePresetKey, ModelRoute> = {
  // '/' — the living system. The SERVER RACK stands in the HOME HERO's
  // margin — «نبني ما يعمل»: the machine room, gold rails at the door,
  // fans running on your scroll. The manifesto band is deliberately
  // model-free (its statement spans the full width — an opaque body
  // would fight the reading). The CPU CHIP witnesses the method
  // section — «بدقة العلماء», precision at micrometer scale.
  home: {
    slots: [
      {
        model: 'serverRack', id: 'hero-title', side: 'end',
        yFrac: 0.56, viewFrac: 0.48, z: -0.5, scrub: 0.5, palette: 'dark',
        xPad: -0.12, // vase lineage: tucked deep into the free margin,
        // clear of the h1's tail — the monolith stands below the fold's
        // headline line (MODEL-2 VLM r1/r2 placement geometry).
      },
      {
        model: 'cpuChip', id: 'method-title', side: 'end',
        yFrac: 0.26, viewFrac: 0.21, z: -0.3, scrub: 0.5, palette: 'light',
        xPad: -0.16, // VLM r1: +30% — the flat body needs the visual
        // weight of the headline; magnifier lineage for the rest.
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «اللوحة»: the STUDIO LAPTOP commands the
  // hero — the canvas every website is born on, screen alive with a
  // homepage wireframe, lid breathing with the scroll. The
  // ThreeDSection band keeps its own icosahedron canvas mid-page, so
  // one authority model is the design.
  websites: {
    slots: [
      {
        model: 'laptopStudio', id: 'page-hero-title', side: 'end',
        yFrac: 0.48, viewFrac: 0.34, z: -0.35, scrub: 0.6, palette: 'dark',
        xPad: -0.09, // screen lineage: the page-hero text is max-w-4xl
        // CENTERED — ~272px margins at 1440w; the open deck fits the
        // margin whole.
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «الآلة»: the ROBOT ARM leads the hero —
  // THE machine, and it WORKS on your scrolling: shoulder, elbow and
  // wrist sweeps ride the section's travel, the gripper closing on its
  // glowing workpiece (stop scrolling and the arm freezes —
  // automation, made literal, successor of the drill press). The n8n
  // dark band carries the live simulator (its own canvas).
  automation: {
    slots: [
      {
        model: 'robotArm', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.5, z: -0.3, scrub: 0.5, palette: 'dark',
        xPad: -0.07, // press lineage: a clean gap between the machine
        // and the centered max-w-4xl column (VLM r2 lesson).
      },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: the SMARTPHONE at the hero — «العمل يعمل في
  // يد العميل»: the shipped product in the hand, its screen a live
  // app wireframe, camera island and gold keys catching the light.
  work: {
    slots: [
      {
        model: 'smartphone', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.3, z: -0.5, scrub: 0.4, palette: 'dark',
        xPad: -0.07, // camera lineage: smaller + deep (atmospheric
        // blend), tucked clear of the centered max-w-4xl column.
      },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: the CIRCUIT BOARD (a REAL photoscanned PCB)
  // opens the journey — «صنعة اليد الجديدة»: etched traces, chips and
  // solder, full PBR. The DATA STACK anchors the story — four storage
  // sleds in a gold-railed frame, one of them sliding out of the
  // array as the story travels (a volume pulled from the shelf).
  about: {
    slots: [
      {
        model: 'circuitBoard', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.3, z: -0.35, scrub: 0.5, palette: 'dark',
        xPad: -0.06, // plane lineage: tucked clear of the centered hero
        // column; the traces' face reads while the relief stays visible.
      },
      {
        model: 'dataStack', id: 'story-title', side: 'end',
        yFrac: 0.66, viewFrac: 0.24, z: -0.25, scrub: 0.3, palette: 'light',
        xPad: -0.09, // VLM r3: smaller + deeper + tucked — fully clear of
        // the story's reading column (was grazing its opening line).
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «الإشارة»: the DISH ANTENNA stands in the hero —
  // «أرسل الإشارة»: azimuth and elevation acquire the visitor across
  // the section's travel, the feed tip glowing emerald — the signal,
  // waiting for one message. The channels band stays model-free: the
  // channel cards and the form ARE the content.
  contact: {
    slots: [
      {
        model: 'dishAntenna', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.4, z: -0.4, scrub: 0.25, palette: 'dark',
        xPad: -0.12, // bulb lineage: pinned deep into the margin —
        // part of the layout grid, not floating.
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — the RUBBER DUCK (survivor): rubber-duck
  // debugging, the programmer's companion, rocking gently beside the
  // recovery heading. A wink every developer reads instantly.
  default: {
    slots: [
      {
        model: 'duck', id: 'nf-recovery-heading', side: 'end',
        yFrac: 0.5, viewFrac: 0.3, z: -0.3, scrub: 0.6, palette: 'light',
        xPad: -0.04, // the 404 message stays the hero.
      },
    ],
    dust: 0.7,
  },
}

/* ------------------------------------------------------------------ *
 * Wash palettes (the atmosphere layer follows the active body).
 * ------------------------------------------------------------------ */

export const SLOT_PALETTES: Record<'light' | 'dark', { edge: string; edge2: string }> = {
  light: { edge: '#60A5FA', edge2: '#34A853' }, // gBlueLight + gGreen
  dark: { edge: '#4285F4', edge2: '#34A853' }, // gBlue + gGreen
}

/* ------------------------------------------------------------------ *
 * Route resolution (locale-stripped, trailing-slash-tolerant) —
 * the rune-landmarks contract, moved verbatim.
 * ------------------------------------------------------------------ */

const ROUTE_MAP: { match: (p: string) => boolean; key: RunePresetKey }[] = [
  { match: (p) => p === '/', key: 'home' },
  { match: (p) => p === '/services/websites', key: 'websites' },
  { match: (p) => p === '/services/automation', key: 'automation' },
  { match: (p) => p === '/work', key: 'work' },
  { match: (p) => p === '/about', key: 'about' },
  { match: (p) => p === '/contact', key: 'contact' },
]

const LOCALE_PREFIXES = ['/ar', '/en']

/** Strip a leading locale segment from a pathname. */
export function stripLocalePath(pathname: string): string {
  for (const p of LOCALE_PREFIXES) {
    if (pathname === p) return '/'
    if (pathname.startsWith(p + '/')) return pathname.slice(p.length) || '/'
  }
  return pathname
}

/** Preset key for a (possibly locale-prefixed) pathname. */
export function runePresetKeyForPath(pathname: string): RunePresetKey {
  const p = stripLocalePath(pathname)
  for (const r of ROUTE_MAP) {
    if (r.match(p)) return r.key
  }
  return 'default'
}

/** Writing direction for a (possibly locale-prefixed) pathname. */
export function runeDirForPath(pathname: string): 'rtl' | 'ltr' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'ltr' : 'rtl'
}
