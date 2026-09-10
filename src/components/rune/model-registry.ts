/**
 * Model Registry (MODEL-4) — the SEMANTIC-MATCH slot table.
 *
 * OWNER'S FOURTH VERDICT (verbatim intent): «الموضوع صحيح، لكن لا يوجد
 * أي شيء يدل على أن هذا المجسم ينتمي أو يتحدث عن الفكرة الموضوعة
 * له» — the technical theme was right, but a body must BE the thing its
 * own section's words describe (the home hero crafts DIGITAL EXPERIENCES,
 * so its body is the digital experience assembling — not a server rack).
 * AND the bodies must «تعيش وتتفاعل مع السكرول ومع المستخدم في كل
 * تحرك» — live and react to scroll and to the user on every move.
 *
 * THE MAPPING IS THE DESIGN (every body = its section's literal subject,
 * quoted from the section's own copy — full rationale per kit in
 * tech-kits.ts):
 *   · HOME HERO      experienceStack — «نصنعُ تجاربَ رقميةً» (explodes
 *     into website / 3D / automation layers, assembling with travel)
 *   · HOME METHOD    pipelineJourney — «رحلة واضحة، من الفكرة إلى
 *     الإطلاق» (four gates, the workpiece riding the rail)
 *   · WEBSITES HERO  siteCanvas — «مواقع تُبنى لتبهر» (the wireframe
 *     blocks rising into place; cursor FOLLOWS the pointer)
 *   · AUTOMATION     flowGraph — «أنظمة تعمل، وأنت نائم» (the n8n
 *     workflow, packets hopping node-to-node)
 *   · WORK HERO      resultsDeck — «نتائج تتحدث بالأرقام» (the results
 *     carousel, the bar chart growing)
 *   · ABOUT HERO     explodedDetail — «صغيرة الحجم، كبيرة الهوس
 *     بالتفاصيل» (the module opening into its exploded stack)
 *   · ABOUT STORY    braidMerge — «قررنا ألا نختار» (الجمال + الدقة
 *     woven into one braid, rising with the story)
 *   · CONTACT HERO   messageComposer — «لنبدأ الحديث» (the message
 *     typing itself in and firing)
 *   · 404            brokenLink — «رابط قديم أو غير صحيح… الطريق
 *     للرئيسية قريب» (the severed link healing as you scroll)
 *
 * MOTION CONTRACT (MODEL-4 amendment — every motion is a PURE function
 * of USER INPUT: (section rect, D, S, pointer). Zero wall-clock, zero
 * randomness. Stop scrolling AND stop moving the pointer ⇒ the demand
 * frame loop parks at zero frames — the standing freeze contract):
 * · SCROLL: whole-body SCRUB + per-part drives over the section's
 *   travel p — now with per-drive p-WINDOWS (win) so parts move in a
 *   designed SEQUENCE (blocks rise one after another, packets hop one
 *   at a time, gates ignite as the workpiece passes). All reversible,
 *   frame-identical up and down.
 * · POINTER (the interactivity layer): every pointer move pokes the
 *   invalidate bus; per-slot springs tilt each body toward the pointer
 *   (lean) and lift it when the pointer is near (hover/proximity);
 *   drives flagged `peek` open exploded bodies further; drives flagged
 *   `boost` glow brighter near the pointer; the siteCanvas cursor
 *   drive flagged `follow` mirrors the visitor's real pointer inside
 *   the screen. Bodies answer EVERY move — and converge to stillness
 *   when the input stops.
 * · Placement — STABLE SLOTS (unchanged): one composed position and
 *   size held for the whole stay; materialise (fade + rise + settle)
 *   on arrival, dissolve on exit, contact shadow grounding.
 *
 * This file is PURE TS (no three.js import — it must stay inside the
 * FIRST bundle chunk, the rune-landmarks contract). brand-colors is
 * likewise pure TS — importing it here cannot break that contract.
 */

import { BRAND_COLORS } from '@/lib/brand-colors'

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

/* ------------------------------------------------------------------ *
 * Part drives — named nodes of the kits, driven by SCROLL (p, D),
 * modulated by POINTER proximity, and kept ALIVE by the life clock
 * (MODEL-5). Node names are matched against the kit's own node
 * names (tech-kits.ts).
 * ------------------------------------------------------------------ */

/** MODEL-5 idle spec — the drive's own LIFE-CLOCK choreography while
 * its body is visible (all presence-scaled in the scene; frozen by
 * construction when the loop parks — the life clock only advances
 * while frames render).
 *  · harmonic (slides/rotations): amp·sin(life·2π·hz + phase)
 *  · unipolar (scales/glows):    amp·(0.5 + 0.5·sin(…)) — never below
 *    the authored base
 *  · spin (rotations):           amp·life — linear rad/s, the
 *    odometers keep turning for the reading visitor. */
export interface IdleSpec {
  /** Amplitude — world units (slides), radians (rotations/spins) or
   *  delta units (scales/glows) per the drive's mode. */
  amp: number
  /** Frequency in HERTZ (ignored for spin — amp there is rad/s). */
  hz: number
  /** Phase offset (radians) — staggers siblings so a kit's parts
   *  never move in lockstep. */
  phase?: number
  /** Linear spin mode: rot += amp·life (amp = rad/s). */
  spin?: boolean
}

/** One controllable part of a body. */
export interface PartDrive {
  /** Node-name substring to find (e.g. 'gate_led_0'). */
  node: string
  /** Local rotation axis (also the slide axis for slide drives). */
  axis: 'x' | 'y' | 'z'
  /** ODOMETER: rotation = base + D · rate (radians per pixel of
   *  signed scroll) — the gyroscope rings run exactly as far as you
   *  scroll. With `swing`, rate instead becomes the swing FREQUENCY. */
  rate?: number
  /** SWEEP (absolute radians [from, to] over the drive's progress,
   *  eased) — link halves aligning, arms cycling. */
  sweep?: [number, number]
  /** SWING: rotation = base + sin(D · rate) · swing. */
  swing?: number
  /** SNAP STEPS: rotation = base + floor(progress · steps) · 2π/steps. */
  steps?: number
  /** SLIDE (position offset [from, to] over the drive's progress,
   *  eased, model-local units along `axis`) — assemblies rising into
   *  place, packets hopping, workpieces riding rails. With `follow`,
   *  slide instead holds [xRange, yRange] POINTER-follow ranges. */
  slide?: [number, number]
  /** SCALE (absolute uniform [from, to] over the drive's progress) —
   *  lines TYPING in (growing from their anchor), the braid rising. */
  scale?: [number, number]
  /** GLOW (emissive-intensity DELTA [from, to] over the drive's
   *  progress, added to each material's authored base) — gates
   *  igniting, nodes lighting on packet arrival, buttons waking. */
  glow?: [number, number]
  /** PROGRESS WINDOW [start, end] inside the section's travel p —
   *  the designed SEQUENCE: this drive only acts while p is inside
   *  its window (smoothstepped at both edges). Absent = the whole
   *  travel. */
  win?: [number, number]
  /** FOLLOW: position.x/y = base + pointer NDC · slide ranges — the
   *  siteCanvas cursor mirroring the visitor's real hand. Requires
   *  slide = [xRange, yRange]. */
  follow?: boolean
  /** PEEK: extra slide/scale amplitude added in proportion to the
   *  POINTER PROXIMITY over this body (0..1) — exploded bodies open
   *  further when you near them. */
  peek?: number
  /** BOOST: extra glow delta added in proportion to pointer
   *  proximity — graph nodes feeling your presence. */
  boost?: number
  /** BLINK: glow delta is multiplied by a LIFE-clocked pulse
   *  (0.55 + 0.45·sin(life·6.2)) — the caret types and the lamps
   *  breathe for the READING visitor (MODEL-5: alive while visible;
   *  pure f(life), frozen when the loop parks). */
  blink?: boolean
  /** MIRROR: slide-x offsets flip sign when the writing direction is
   *  LTR (kits are authored RTL-first) — packets fly toward the
   *  reading column in both locales. */
  mirror?: boolean
  /** MODEL-5 IDLE: this part's life-clock choreography (see IdleSpec)
   *  — the workpiece hovers on its rail, plates breathe, lamps pulse,
   *  gyro rings keep spinning while the body is visible. */
  idle?: IdleSpec
}

/* ------------------------------------------------------------------ *
 * The body library — one entry per kit.
 * ------------------------------------------------------------------ */

export interface ModelDef {
  /** Registry key (kits) — also the debug/verification identity. */
  slug: string
  /** Authored kit name (tech-kits.ts). */
  kit: string
  /** Which bounding-box dimension the viewport fraction fits. */
  fit: 'height' | 'max' | 'width'
  /** Resting yaw — each body's best face leads. */
  yaw: number
  /** Resting pitch tilt (radians, X axis). */
  tilt?: number
  /** PBR environment intensity multiplier. */
  envIntensity?: number
  /** POINTER REACTIVITY: how strongly this body leans toward the
   *  pointer (radians at full NDC deflection) and its hover-lift
   *  weight (0 = no lift; 1 = the full designed lift). */
  react?: { lean?: number; hover?: number }
  /** MODEL-5 IDLE ENERGY — this body's temperament multiplier for the
   *  whole-body breathing (bob/sway/breath): 1 = the default calm
   *  presence, <1 = a stiller body (the obsessively precise exploded
   *  detail), >1 = a busier one (the always-running flow graph). */
  idleEnergy?: number
  /** Scroll-driven named parts. */
  drives?: readonly PartDrive[]
}

export const MODEL_LIBRARY: Record<string, ModelDef> = {
  experienceStack: {
    slug: 'experienceStack',
    kit: 'experienceStack',
    fit: 'max',
    yaw: -0.3,
    tilt: 0.26, // read the top screen AND the layers' depth separation
    envIntensity: 1.05,
    react: { lean: 0.12, hover: 1 },
    idleEnergy: 1,
    // THE EXPERIENCE ASSEMBLES (VLM r2 retune): the three offering
    // layers hold a WIDE exploded separation through the entry and
    // only lock across the middle third — at the natural reading
    // position (p≈0.5) the strata are visibly DISTINCT (the r1 verdict
    // "finished static kiosk" was the layers settling too early); the
    // gyroscope rings run on the scroll odometer; each layer's EDGE
    // LIGHT wakes with its arrival; the automation packet blinks on
    // the scroll clock; hovering re-opens the layers (peek) — the
    // exploded view answers your hand.
    drives: [
      // MODEL-5 idle: the assembled experience keeps breathing — the
      // site and flow layers float in counter-phase (the stack gently
      // re-explodes/re-assembles), the gyroscope rings keep spinning,
      // the edge lights and core shimmer.
      { node: 'layer_site', axis: 'y', slide: [0.3, 0], win: [0.08, 0.62], peek: 0.22, idle: { amp: 0.018, hz: 0.16 } },
      { node: 'layer_flow', axis: 'y', slide: [-0.3, 0], win: [0.08, 0.62], peek: -0.22, idle: { amp: 0.018, hz: 0.16, phase: Math.PI } },
      { node: 'gyro_ring_a', axis: 'x', rate: 0.02, idle: { amp: 0.45, hz: 0, spin: true } },
      { node: 'gyro_ring_b', axis: 'y', rate: -0.016, idle: { amp: -0.32, hz: 0, spin: true } },
      { node: 'gyro_core', axis: 'z', glow: [0, 1.4], win: [0.2, 0.7], boost: 1.2, idle: { amp: 0.6, hz: 0.45 } },
      { node: 'site_edge', axis: 'z', glow: [0, 2.2], win: [0.18, 0.6], boost: 1.1, idle: { amp: 0.5, hz: 0.35 } },
      { node: 'flow_edge', axis: 'z', glow: [0, 0.9], win: [0.38, 0.78], boost: 0.8, idle: { amp: 0.35, hz: 0.28, phase: 1.5 } },
      { node: 'flow_packet', axis: 'z', glow: [0, 2.4], win: [0.45, 0.85], boost: 1.5, blink: true },
    ],
  },
  pipelineJourney: {
    slug: 'pipelineJourney',
    kit: 'pipelineJourney',
    fit: 'max',
    yaw: 0.28,
    tilt: 0.52, // the rail reads from above — the journey's direction
    envIntensity: 1.1,
    react: { lean: 0.1, hover: 0.8 },
    idleEnergy: 0.9,
    // THE JOURNEY RUNS (VLM r2 retune): the workpiece rides the rail
    // across the WHOLE presence band; each gate's LED ignites exactly
    // as the workpiece CROSSES it (windows computed from the ride:
    // x = −0.72 + lp·1.44, gates at −0.55/−0.18/0.19/0.56) and BLINKS
    // on the scroll clock — the gates stay alive while you scroll,
    // deterministically; the launch beacon lights at the far end —
    // «من الفكرة إلى الإطلاق», reversible step by step.
    drives: [
      // MODEL-5 idle: the workpiece HOVERS along the rail (the journey
      // never quite stops breathing) and the gate lamps keep watch with
      // staggered pulses (blink rides the life clock now).
      { node: 'workpiece', axis: 'x', slide: [0, 1.44], win: [0.08, 0.92], idle: { amp: 0.02, hz: 0.22 } },
      { node: 'gate_led_0', axis: 'z', glow: [0, 2], win: [0.08, 0.22], blink: true, idle: { amp: 0.5, hz: 0.5 } },
      { node: 'gate_led_1', axis: 'z', glow: [0, 2], win: [0.34, 0.48], blink: true, idle: { amp: 0.5, hz: 0.5, phase: 1.57 } },
      { node: 'gate_led_2', axis: 'z', glow: [0, 2], win: [0.6, 0.74], blink: true, idle: { amp: 0.5, hz: 0.5, phase: 3.14 } },
      { node: 'gate_led_3', axis: 'z', glow: [0, 2], win: [0.85, 0.98], blink: true, idle: { amp: 0.5, hz: 0.5, phase: 4.71 } },
      { node: 'beacon_tip', axis: 'z', glow: [0, 2.2], win: [0.9, 1], blink: true },
    ],
  },
  siteCanvas: {
    slug: 'siteCanvas',
    kit: 'siteCanvas',
    fit: 'max',
    yaw: -0.22,
    tilt: 0.1,
    envIntensity: 1.15,
    react: { lean: 0.07, hover: 0.9 },
    idleEnergy: 0.8,
    // THE WEBSITE BUILDS ITSELF (VLM r2 retune): chrome first, then
    // the URL loading, then the content blocks rising into place in
    // sequence (nav → hero → cards → CTA) across the WHOLE stay —
    // wider amplitudes so the assembly reads at any reading position;
    // the CTA warming as it lands — while the on-screen cursor mirrors
    // the visitor's real pointer (follow): the site assembles under
    // your hand.
    drives: [
      // MODEL-5 idle: the born page keeps settling into place — the
      // hero block breathes its height, the CTA warms rhythmically.
      // (The cursor stays pure-follow: it mirrors YOUR hand.)
      { node: 'blk_nav', axis: 'y', slide: [0.2, 0], win: [0.08, 0.26] },
      { node: 'url_load', axis: 'x', slide: [0, 0.24], win: [0.06, 0.3], idle: { amp: 0.012, hz: 0.3 } },
      { node: 'blk_hero', axis: 'y', slide: [0.28, 0], win: [0.18, 0.42], idle: { amp: 0.02, hz: 0.2 } },
      { node: 'blk_aside', axis: 'y', slide: [0.28, 0], win: [0.26, 0.5] },
      { node: 'blk_card_0', axis: 'y', slide: [0.26, 0], win: [0.36, 0.58] },
      { node: 'blk_card_1', axis: 'y', slide: [0.26, 0], win: [0.44, 0.66] },
      { node: 'blk_card_2', axis: 'y', slide: [0.26, 0], win: [0.52, 0.74] },
      { node: 'blk_cta', axis: 'y', slide: [0.2, 0], win: [0.62, 0.82], glow: [0, 1.4], boost: 1.3, idle: { amp: 0.45, hz: 0.4 } },
      { node: 'ui_cursor', axis: 'x', slide: [0.34, 0.2], follow: true },
    ],
  },
  flowGraph: {
    slug: 'flowGraph',
    kit: 'flowGraph',
    fit: 'max',
    yaw: 0.16,
    tilt: 0.36, // look INTO the graph — the wires' zigzag reads
    envIntensity: 1.1,
    react: { lean: 0.1, hover: 1 },
    idleEnergy: 1.25,
    // THE WORKFLOW RUNS (VLM r2 retune): three packets hop
    // node-to-node in sequence — now each packet's OWN glow BLINKS on
    // the scroll clock while it flies (the r1 verdict "where are the
    // packets hopping?" was stills catching dark, settled packets);
    // each node's LED ignites on arrival (node_2 lights as its packet
    // departs); every node also glows brighter when the pointer nears
    // (boost) — the system feels you touching it.
    drives: [
      // MODEL-5 idle: the system RUNS while you watch — packets jitter
      // along their wires (data still flowing), the node lamps wave in
      // sequence (an idle heartbeat through the workflow) — the most
      // energetic body in the set («أنظمة تعمل، وأنت نائم»).
      { node: 'packet_0', axis: 'x', slide: [0, 0.23], win: [0.06, 0.3], idle: { amp: 0.02, hz: 0.35 } },
      { node: 'packet_0', axis: 'y', slide: [0, 0.21], idle: { amp: 0.014, hz: 0.35, phase: 1.5 } },
      { node: 'packet_0', axis: 'z', glow: [0, 2.6], win: [0.06, 0.3], blink: true },
      { node: 'packet_1', axis: 'x', slide: [0, 0.22], win: [0.36, 0.6], idle: { amp: 0.02, hz: 0.35, phase: 2.1 } },
      { node: 'packet_1', axis: 'y', slide: [0, 0.22], idle: { amp: 0.014, hz: 0.35, phase: 3.6 } },
      { node: 'packet_1', axis: 'z', glow: [0, 2.6], win: [0.36, 0.6], blink: true },
      { node: 'packet_2', axis: 'x', slide: [0, 0.23], win: [0.66, 0.9], idle: { amp: 0.02, hz: 0.35, phase: 4.2 } },
      { node: 'packet_2', axis: 'y', slide: [0, -0.17], idle: { amp: 0.014, hz: 0.35, phase: 5.1 } },
      { node: 'packet_2', axis: 'z', glow: [0, 2.6], win: [0.66, 0.9], blink: true },
      { node: 'node_1', axis: 'z', glow: [0, 1.6], win: [0.24, 0.4], boost: 1.4, idle: { amp: 0.5, hz: 0.25 } },
      { node: 'node_2', axis: 'z', glow: [0, 1.4], win: [0.34, 0.5], boost: 1.4, idle: { amp: 0.5, hz: 0.25, phase: 1.256 } },
      { node: 'node_3', axis: 'z', glow: [0, 1.6], win: [0.54, 0.7], boost: 1.4, idle: { amp: 0.5, hz: 0.25, phase: 2.512 } },
      { node: 'node_4', axis: 'z', glow: [0, 1.9], win: [0.84, 1], boost: 1.6, idle: { amp: 0.55, hz: 0.25, phase: 3.768 } },
      { node: 'node_0', axis: 'z', glow: [0, 1.2], boost: 1.4, idle: { amp: 0.5, hz: 0.25, phase: 5.024 } },
    ],
  },
  resultsDeck: {
    slug: 'resultsDeck',
    kit: 'resultsDeck',
    fit: 'max',
    yaw: 0,
    tilt: 0.14,
    envIntensity: 1.05,
    react: { lean: 0.11, hover: 1 },
    idleEnergy: 0.85,
    // THE RESULTS GROW (VLM r2 retune, gallery-ring rebuild): the
    // carousel turns gently with the travel (60° — the front screen
    // stays readable; the r1 "screens angled awkwardly" was the full
    // 120° turn), while the front screen's bar chart RISES bar after
    // bar across the whole stay — «نتائج تتحدث بالأرقام», the numbers
    // themselves ascending. The hub LED wakes with the chart.
    drives: [
      // MODEL-5 idle: the numbers keep living — the chart bars swell in
      // a staggered heartbeat (results GROW even while you read), the
      // hub lamp breathes.
      { node: 'chart_bar_0', axis: 'y', scale: [0.02, 1], win: [0.15, 0.5], idle: { amp: 0.03, hz: 0.18 } },
      { node: 'chart_bar_1', axis: 'y', scale: [0.02, 1], win: [0.28, 0.62], idle: { amp: 0.03, hz: 0.18, phase: 0.8 } },
      { node: 'chart_bar_2', axis: 'y', scale: [0.02, 1], win: [0.42, 0.75], idle: { amp: 0.03, hz: 0.18, phase: 1.6 } },
      { node: 'chart_bar_3', axis: 'y', scale: [0.02, 1], win: [0.55, 0.88], idle: { amp: 0.03, hz: 0.18, phase: 2.4 } },
      { node: 'hub_led', axis: 'z', glow: [0, 2.2], win: [0.3, 0.72], boost: 1.2, idle: { amp: 0.6, hz: 0.4 } },
    ],
  },
  explodedDetail: {
    slug: 'explodedDetail',
    kit: 'explodedDetail',
    fit: 'height',
    yaw: 0.34,
    tilt: 0.48, // look INTO the opened stack — the details are the point
    envIntensity: 1.2,
    react: { lean: 0.12, hover: 1 },
    idleEnergy: 0.6,
    // SMALL THING, OPENED: the compact module's five plates fan out
    // through the entry and hold the open span into the middle of the
    // stay (the fan is the point — r2 keeps it readable longer); the
    // LED waking mid-stay; hovering pulls the plates further apart
    // (peek) — the obsession, on demand.
    drives: [
      // MODEL-5 idle: the exploded stack BREATHES — plates drift in
      // counter-phase (a slow, precise open/close, the obsessive detail
      // examining itself), the inspection lamp glows steadily. The
      // stillest body in the set.
      { node: 'plate_0', axis: 'y', slide: [-0.12, 0], win: [0.08, 0.55], peek: -0.08, idle: { amp: 0.014, hz: 0.14 } },
      { node: 'plate_1', axis: 'y', slide: [-0.06, 0], win: [0.12, 0.6], peek: -0.05, idle: { amp: 0.011, hz: 0.14, phase: 1.05 } },
      { node: 'plate_3', axis: 'y', slide: [0.06, 0], win: [0.12, 0.6], peek: 0.05, idle: { amp: 0.011, hz: 0.14, phase: 2.1 } },
      { node: 'plate_4', axis: 'y', slide: [0.12, 0], win: [0.08, 0.55], peek: 0.08, idle: { amp: 0.014, hz: 0.14, phase: 3.15 } },
      { node: 'detail_led', axis: 'z', glow: [0, 1.8], win: [0.35, 0.68], boost: 1.3, idle: { amp: 0.5, hz: 0.3 } },
    ],
  },
  braidMerge: {
    slug: 'braidMerge',
    kit: 'braidMerge',
    fit: 'height',
    yaw: 0.28,
    tilt: 0.06,
    envIntensity: 1.0,
    react: { lean: 0.1, hover: 0.9 },
    idleEnergy: 0.7,
    // THE DECISION WEAVES: the two strands (gold = الجمال, emerald =
    // الدقة) converge into the collar — «قررنا ألا نختار» — and the
    // two-tone braid RISES from the collar as the story travels,
    // its tip lighting once the weave is complete.
    drives: [
      // MODEL-5 idle: the braid SWELLS as it holds itself together — a
      // slow breath along the weave, the fusion tip glowing rhythmically
      // («الجمال + الدقة» breathing as one strand).
      { node: 'braid', axis: 'y', scale: [0.02, 1], win: [0.2, 0.72], idle: { amp: 0.02, hz: 0.15 } },
      { node: 'braid_tip', axis: 'z', glow: [0, 3.4], win: [0.72, 0.95], boost: 1.5, idle: { amp: 0.8, hz: 0.35 } },
    ],
  },
  messageComposer: {
    slug: 'messageComposer',
    kit: 'messageComposer',
    fit: 'max',
    yaw: -0.16,
    tilt: 0.06,
    envIntensity: 1.1,
    react: { lean: 0.08, hover: 1 },
    idleEnergy: 1.05,
    // THE CONVERSATION STARTS (VLM r2 retune): the three lines TYPE
    // themselves in across the whole stay, the caret blinking on the
    // scroll clock; the send button wakes and pops mid-stay, then
    // FIRES its packet toward the reading column (mirror) well inside
    // the presence band (the r1 verdict "static Figma export" was the
    // send ritual hiding at the exit, past the dissolve) — «لنبدأ
    // الحديث», the message sending itself.
    drives: [
      // MODEL-5 idle: the message KEEPS TYPING — the caret blinks on
      // the life clock (pure f(life) now: it types for the reading
      // visitor, not only while scrolling), the lines shimmer as if
      // reconsidering, the send button warms.
      { node: 'line_0', axis: 'x', scale: [0.02, 1], win: [0.1, 0.34], idle: { amp: 0.012, hz: 0.3 } },
      { node: 'line_1', axis: 'x', scale: [0.02, 1], win: [0.3, 0.54], idle: { amp: 0.012, hz: 0.3, phase: 1.05 } },
      { node: 'line_2', axis: 'x', scale: [0.02, 1], win: [0.5, 0.74], idle: { amp: 0.012, hz: 0.3, phase: 2.1 } },
      { node: 'caret', axis: 'z', glow: [0.4, 2.2], win: [0.15, 0.9], blink: true, boost: 1.2 },
      { node: 'send_btn', axis: 'y', slide: [0, 0.02], win: [0.58, 0.72] },
      { node: 'send_btn', axis: 'z', glow: [0.2, 1.5], win: [0.58, 0.72], boost: 1.2, idle: { amp: 0.4, hz: 0.5 } },
      { node: 'fly_packet', axis: 'x', slide: [0, 0.3], win: [0.72, 0.94], mirror: true },
      { node: 'fly_packet', axis: 'y', slide: [0, 0.17], win: [0.72, 0.94] },
    ],
  },
  brokenLink: {
    slug: 'brokenLink',
    kit: 'brokenLink',
    fit: 'max',
    yaw: -0.24,
    tilt: 0.08,
    envIntensity: 1.1,
    react: { lean: 0.07, hover: 0.9 },
    idleEnergy: 1,
    // THE LINK HEALS: the severed halves reach for each other and
    // align as you scroll toward the recovery links; the hot red
    // spark in the gap calms and the emerald one wakes — «الطريق
    // للرئيسية قريب», the connection restoring itself.
    drives: [
      // MODEL-5 idle: the broken halves SWAY against each other (still
      // reaching — the link never quite gives up), the red spark ticks
      // (blink on the life clock), the green way-out light glows
      // steadily brighter: «الطريق للرئيسية قريب».
      { node: 'link_left', axis: 'x', slide: [-0.05, 0], win: [0.25, 0.68] },
      { node: 'link_left', axis: 'z', sweep: [0.35, 0], win: [0.25, 0.68], idle: { amp: 0.05, hz: 0.25 } },
      { node: 'link_right', axis: 'x', slide: [-0.05, 0], win: [0.25, 0.68] },
      { node: 'link_right', axis: 'z', sweep: [-0.35, 0], win: [0.25, 0.68], idle: { amp: 0.05, hz: 0.25, phase: Math.PI } },
      { node: 'spark_red', axis: 'z', glow: [2.2, 0], win: [0.25, 0.6], blink: true },
      { node: 'spark_green', axis: 'z', glow: [0, 2.6], win: [0.62, 0.9], boost: 1.2, idle: { amp: 0.6, hz: 0.45 } },
    ],
  },
}

/* ------------------------------------------------------------------ *
 * Slots — a route's bodies, glued to real sections.
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
   *  STABLE size held for the section's whole stay (no ballooning). */
  viewFrac: number
  /** Depth plane (world z; the perspective camera adds real parallax
   *  between planes when the pointer moves). */
  z: number
  /** Whole-body scrub rotation (radians) across the section's travel —
   *  always reversed by scrolling back up. */
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
 *  margin of its section — hero bodies sit at the page-hero's empty
 *  side (~half the viewport tall), mid-page witnesses are smaller and
 *  deeper. One or two per route: authority, not decoration soup. */
export const MODEL_ROUTES: Record<RunePresetKey, ModelRoute> = {
  // '/' — «نصنعُ تجاربَ رقميةً تُشبهُ المستقبل»: the EXPERIENCE STACK
  // assembles in the hero's margin (website + 3D + automation layers,
  // the offering made one body); the PIPELINE JOURNEY witnesses the
  // method section (the four gates riding the rail). The manifesto
  // band stays model-free (its statement spans the full width).
  home: {
    slots: [
      {
        model: 'experienceStack', id: 'hero-title', side: 'end',
        yFrac: 0.56, viewFrac: 0.5, z: -0.5, scrub: 0.15, palette: 'dark',
        xPad: -0.03, // VLM r1: xFrac 0.12 parked the stack in a dead
        // corner "divorced from the headline" — brought inward to
        // xFrac 0.21 so the assembled experience stands IN the margin,
        // and enlarged (0.46→0.5) to anchor the hero. Still clear of
        // the h1's tail (MODEL-2 r1/r2 geometry).
      },
      {
        model: 'pipelineJourney', id: 'method-title', side: 'end',
        yFrac: 0.26, viewFrac: 0.36, z: -0.3, scrub: 0.25, palette: 'light',
        xPad: -0.02, // VLM r2: still "clipped awkwardly on the left" —
        // pulled inward (xFrac 0.22) and sized 0.36 so the whole
        // portal journey sits composed inside the margin, nothing
        // grazing the edge.
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «مواقع تُبنى لتبهر»: the SITE CANVAS builds
  // itself in the hero — the wireframe blocks rising into place, the
  // cursor following the visitor's hand. The ThreeDSection band keeps
  // its own icosahedron canvas mid-page — one authority model.
  websites: {
    slots: [
      {
        model: 'siteCanvas', id: 'page-hero-title', side: 'end',
        yFrac: 0.48, viewFrac: 0.42, z: -0.35, scrub: 0.28, palette: 'dark',
        xPad: -0.06, // VLM r1: raised viewFrac (0.4→0.42) and eased the
        // tuck (−0.09→−0.06) — the assembling canvas should OWN its
        // margin, not whisper from it ("sticker pasted" verdict).
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «أنظمة تعمل، وأنت نائم»: the FLOW GRAPH
  // runs in the hero — the n8n workflow itself, packets hopping
  // node-to-node on the scroll, nodes glowing under the pointer. The
  // dark band carries the live simulator (its own canvas).
  automation: {
    slots: [
      {
        model: 'flowGraph', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.48, z: -0.3, scrub: 0.2, palette: 'dark',
        xPad: -0.07, // robotArm lineage: a clean gap between the graph
        // and the centered max-w-4xl column (MODEL-3 VLM r2 lesson).
      },
    ],
    dust: 1.15,
  },

  // '/work' — «نتائج تتحدث بالأرقام»: the RESULTS DECK turns in the
  // hero — three project screens orbiting the gold hub, the front
  // screen's bar chart rising as you scroll: the numbers, ascending.
  work: {
    slots: [
      {
        model: 'resultsDeck', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.46, z: -0.45, scrub: 1.05, palette: 'dark',
        xPad: -0.04, // VLM r2: the gallery-ring rebuild reads bigger
        // (0.42→0.46, tuck −0.07→−0.04) and the scrub is a 60° stroll
        // (was the full 120° turn that angled every screen away).
      },
    ],
    dust: 1,
  },

  // '/about' — «صغيرة الحجم، كبيرة الهوس بالتفاصيل»: the EXPLODED
  // DETAIL opens in the hero — the module's plates fanning out. The
  // BRAID MERGE anchors the story — الجمال + الدقة woven into one
  // cable rising from the collar as the story travels.
  about: {
    slots: [
      {
        model: 'explodedDetail', id: 'page-hero-title', side: 'end',
        yFrac: 0.52, viewFrac: 0.34, z: -0.35, scrub: 0.3, palette: 'dark',
        xPad: -0.06, // circuitBoard lineage: tucked clear of the centered
        // hero column; the opened stack reads while the relief stays.
      },
      {
        model: 'braidMerge', id: 'story-title', side: 'end',
        yFrac: 0.66, viewFrac: 0.26, z: -0.25, scrub: 0.2, palette: 'light',
        xPad: -0.09, // dataStack lineage: smaller + deeper + tucked —
        // fully clear of the story's reading column.
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «لنبدأ الحديث»: the MESSAGE COMPOSER in the hero —
  // the lines typing themselves in, the send button firing its packet
  // as the section settles. The channels band stays model-free: the
  // channel cards and the form ARE the content.
  contact: {
    slots: [
      {
        model: 'messageComposer', id: 'page-hero-title', side: 'end',
        yFrac: 0.5, viewFrac: 0.36, z: -0.4, scrub: 0.2, palette: 'dark',
        xPad: -0.1, // dishAntenna lineage: pinned deep into the margin —
        // part of the layout grid, not floating.
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — the BROKEN LINK beside the recovery heading:
  // the severed halves reaching for each other as the visitor scrolls
  // toward the way home — «الطريق للرئيسية قريب».
  default: {
    slots: [
      {
        model: 'brokenLink', id: 'nf-recovery-heading', side: 'end',
        yFrac: 0.5, viewFrac: 0.32, z: -0.3, scrub: 0.3, palette: 'light',
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
  light: { edge: BRAND_COLORS.gBlueLight, edge2: BRAND_COLORS.gGreen }, // gBlueLight + gGreen
  dark: { edge: BRAND_COLORS.gBlue, edge2: BRAND_COLORS.gGreen }, // gBlue + gGreen
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
