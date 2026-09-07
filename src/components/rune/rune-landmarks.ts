/**
 * Rune Landmarks (RUNE-3) — the SEMANTIC section registry.
 *
 * The owner's 2025 verdict on the abstract roaming volumes: «المجسمات
 * ثلاثية الأبعاد التي تتحرك… ليست لها أي معنى ولا تدل على أي شيء.
 * أريد مجسمات تدل على كل شيء على كل صفحة» — every page's 3D bodies
 * must MEAN the content they live beside, the whole site must be
 * restructured around the scroll, and the motion must be DESIGNED in
 * every place, every second, every frame (never random).
 *
 * This file answers the «تدل على كل شيء» half as a pure-TS table (no
 * three.js import — it must stay inside the FIRST bundle chunk, same
 * contract rune-presets.ts held): every route declares an ordered list
 * of LANDMARKS — one per real content section — each anchored to that
 * section's actual DOM node (resolved by the heading id the pages
 * already carry in aria-labelledby) and carrying the semantic OBJECT
 * kind that represents that section's meaning:
 *
 *   home    «المنظومة»   stats→constellation (الحصيلة الصاعدة)
 *                        manifesto→sheetFlow  (ورق البيان)
 *                        bento→panelGrid     (شبكة الخدمات)
 *                        sim→nodeMesh        (شبكة الأتمتة — قسم داكن)
 *                        work→galleryFrames  (إطارات الأعمال)
 *                        method→staircase    (درج المنهج)
 *                        calc→dials          (عدادات الحساب)
 *                        (hero بلا معلم — قماش الحرير هو دلالته)
 *   websites «البنية»    hero→stackedLayers  (طبقات الموقع تنفصل بالتمرير)
 *                        types→panelGrid     (أنماط المواقع)
 *                        journey→staircase   (خطوات البناء الست)
 *                        calc→dials          (ثلاثية الطبقات تُبقَى لقسم
 *                        ThreeDSection — عنده قماشه الخاص)
 *   automation «الآلة»   hero→gears          (تروس يقودها التمرير حرفياً)
 *                        int→orbitSystem     (مركز التكاملات والأقمار)
 *                        n8n→nodeMesh        (شبكة العُقد — قسم داكن)
 *                        calc→dials
 *   work    «المعرض»     hero→galleryFrames  (مروحة الإطارات)
 *                        grid→galleryFrames  (نسخة هامشية)
 *   about   «الرحلة»     hero→sheetFlow      (مقدمة الاستوديو)
 *                        story→journeyPath   (المسار يرسم نفسه + المحطات)
 *                        values→blockStack   (رصّ القيم — داكن)
 *                        team→constellation  (عناقيد الفريق)
 *                        numbers→barsRising  (أعمدة الأرقام)
 *   contact «الإشارة»    hero→beacon         (المنارة وحلقاتها)
 *                        channels→orbitSystem
 *                        form→envelope       (الرسالة تُختم بالتمرير)
 *
 * Everything the DRIVER (rune-scene.tsx) needs to place and pace each
 * landmark is here: the DOM anchor id, the logical side of the section's
 * free visual margin ('start' mirrors with the writing direction — the
 * scene resolves it from the active locale), the vertical anchor
 * fraction inside the section, the presence scale, the scroll-coupled
 * spin rate (radians per pixel of signed scroll D — scrolling up
 * retraces it exactly), the S-clocked breathing depth, and the light /
 * dark palette that matches the section's actual background band.
 *
 * «مدروسة… بكل إطار»: nothing here or downstream is random — no
 * Math.random, no wall-clock term; every transform is a pure function
 * of (section rect, D, S) so a given scroll position always yields the
 * identical frame, and reversing the scroll replays the design in
 * reverse. Sections with no landmark (CTA strips, cross-nav, the home
 * hero with its own canvas, the websites ThreeDSection with its own
 * icosahedron) are deliberate negative space.
 */

export type RunePresetKey =
  | 'home'
  | 'websites'
  | 'automation'
  | 'work'
  | 'about'
  | 'contact'
  | 'default'

/** The semantic object vocabulary (built by rune-assemblies.ts). */
export type LandmarkKind =
  | 'orbitSystem' // نواة/مركز — hub sphere, tilted rings, orbiting satellites
  | 'constellation' // حصيلة/فريق — ascending cluster of octahedra
  | 'sheetFlow' // بيان — a curved sheet of the written statement
  | 'panelGrid' // خدمات/أنماط — floating slab grid (bento in miniature)
  | 'nodeMesh' // أتمتة — nodes, edges and travelling packets
  | 'galleryFrames' // أعمال — fanned project frames
  | 'staircase' // منهج/مسار — ascending process steps
  | 'dials' // عدادات — gauges that sweep with scroll
  | 'stackedLayers' // طبقات — site layers that separate as you scroll
  | 'gears' // تروس — interlocking gears driven by the scroll itself
  | 'journeyPath' // رحلة — a path that draws itself + milestone stations
  | 'beacon' // منارة — tower with emanating signal rings
  | 'barsRising' // أرقام — ascending measurement bars
  | 'blockStack' // قيم — a balanced tower of solids
  | 'envelope' // رسالة — an envelope that seals with scroll

/** Which side of the section's content the landmark occupies (logical —
 * 'start' resolves to the inline-start edge: right in AR, left in EN). */
export type LandmarkSide = 'start' | 'end' | 'center'

/** One section landmark's full designed placement. */
export interface LandmarkSpec {
  /** Heading id of the section (the pages' aria-labelledby targets). */
  id: string
  /** The semantic object representing this section's content. */
  kind: LandmarkKind
  /** Free-margin side, resolved against the active writing direction. */
  side: LandmarkSide
  /** Vertical anchor inside the section, 0..1 (0.5 = section centre). */
  yFrac: number
  /** Presence scale in world units (ortho rig: 1.0 = half the viewport
   * height; margins use ~0.40, page-heroes use ~0.6). */
  scale: number
  /** Spin handed to the whole assembly — radians per pixel of D. */
  spin: number
  /** Breathing depth with the unsigned clock S (0.08 subtle … 0.22
   * organic) — «تكبير وتصغير» while the section holds. */
  breath: number
  /** Breathing phase offset (radians) — staggers neighbours. */
  phase: number
  /** Palette matching the section's background band. */
  palette: 'light' | 'dark'
  /** Extra world-Y offset (design fine-tuning, default 0). */
  yOff?: number
  /** Base tilt (radians, X axis) — gives flat objects perspective. */
  tilt?: number
  /** Lateral nudge on the anchor fraction (negative = toward the
   * screen edge) — resolves collisions with wide content blocks. */
  xPad?: number
}

export interface LandmarkRoute {
  landmarks: readonly LandmarkSpec[]
  /** Ambient dust density multiplier. */
  dust: number
}

const g = {
  light: 'light',
  dark: 'dark',
} as const

/** «إعادة الهيكلة» — the per-route narrative. Sides ALTERNATE through
 * each page (end/start/end/…) so the eye crosses the content column
 * once per section: a designed reading rhythm, not decoration soup. */
export const LANDMARK_ROUTES: Record<RunePresetKey, LandmarkRoute> = {
  // '/' — the living system. The hero is deliberately landmark-free
  // (its silk canvas IS its meaning); the narrative starts under the
  // fold with the harvest and ends at the calculator dials.
  home: {
    landmarks: [
      {
        id: 'stats-title', kind: 'constellation', side: 'end', yFrac: 0.5,
        scale: 0.46, spin: 0.00032, breath: 0.2, phase: 0.0, palette: g.light,
      },
      {
        id: 'manifesto-title', kind: 'sheetFlow', side: 'end', yFrac: 0.45,
        scale: 0.5, spin: 0.0002, breath: 0.12, phase: 1.1, palette: g.light, tilt: 0.3, xPad: -0.04,
      },
      {
        id: 'bento-title', kind: 'panelGrid', side: 'start', yFrac: 0.5,
        scale: 0.44, spin: 0.0004, breath: 0.14, phase: 2.2, palette: g.light, xPad: -0.04,
      },
      {
        id: 'sim-title', kind: 'nodeMesh', side: 'end', yFrac: 0.5,
        scale: 0.5, spin: 0.0003, breath: 0.16, phase: 3.3, palette: g.dark,
      },
      {
        id: 'work-title', kind: 'galleryFrames', side: 'start', yFrac: 0.5,
        scale: 0.5, spin: 0.0003, breath: 0.12, phase: 0.7, palette: g.light,
      },
      {
        id: 'method-title', kind: 'staircase', side: 'end', yFrac: 0.55,
        scale: 0.48, spin: 0.0004, breath: 0.1, phase: 2.0, palette: g.light,
      },
      {
        id: 'calc-title', kind: 'dials', side: 'start', yFrac: 0.35,
        scale: 0.42, spin: 0.0002, breath: 0.08, phase: 4.1, palette: g.light, tilt: 0.25, xPad: -0.1,
      },
    ],
    dust: 1,
  },

  // '/services/websites' — «البنية»: the hero's layers separate as you
  // scroll (architecture revealed), the types fan as panels, the build
  // journey climbs as six steps, the calculator sweeps its dials. The
  // ThreeDSection band keeps its own icosahedron canvas (landmark-free).
  websites: {
    landmarks: [
      {
        id: 'page-hero-title', kind: 'stackedLayers', side: 'end', yFrac: 0.5,
        scale: 0.58, spin: 0.00025, breath: 0.1, phase: 0.0, palette: g.dark, tilt: 0.18,
      },
      {
        id: 'types-title', kind: 'panelGrid', side: 'end', yFrac: 0.16,
        scale: 0.42, spin: 0.0004, breath: 0.12, phase: 1.4, palette: g.light, xPad: -0.04,
      },
      {
        id: 'journey-title', kind: 'staircase', side: 'start', yFrac: 0.18,
        scale: 0.46, spin: 0.0004, breath: 0.1, phase: 2.8, palette: g.light,
      },
      {
        id: 'calc-title', kind: 'dials', side: 'end', yFrac: 0.35,
        scale: 0.42, spin: 0.0002, breath: 0.08, phase: 0.9, palette: g.light, tilt: 0.25, xPad: -0.04,
      },
    ],
    dust: 0.85,
  },

  // '/services/automation' — «الآلة»: gears the SCROLL literally turns,
  // an integrations hub with orbiting channel satellites, the n8n mesh
  // glowing on the dark band, the calculator dials closing.
  automation: {
    landmarks: [
      {
        id: 'page-hero-title', kind: 'gears', side: 'end', yFrac: 0.5,
        scale: 0.56, spin: 0.00016, breath: 0.08, phase: 0.0, palette: g.dark, tilt: 0.35,
      },
      {
        id: 'int-title', kind: 'orbitSystem', side: 'end', yFrac: 0.5,
        scale: 0.5, spin: 0.0003, breath: 0.18, phase: 1.9, palette: g.light,
      },
      {
        id: 'n8n-title', kind: 'nodeMesh', side: 'start', yFrac: 0.5,
        scale: 0.52, spin: 0.0003, breath: 0.16, phase: 3.4, palette: g.dark,
      },
      {
        id: 'calc-title', kind: 'dials', side: 'start', yFrac: 0.35,
        scale: 0.42, spin: 0.0002, breath: 0.08, phase: 5.0, palette: g.light, tilt: 0.25, xPad: -0.1,
      },
    ],
    dust: 1.15,
  },

  // '/work' — «المعرض»: frames fan open through the hero, then a margin
  // echo of frames accompanies the grid.
  work: {
    landmarks: [
      {
        id: 'page-hero-title', kind: 'galleryFrames', side: 'end', yFrac: 0.55,
        scale: 0.56, spin: 0.0003, breath: 0.1, phase: 0.0, palette: g.dark,
      },
      {
        id: 'work-grid-title', kind: 'galleryFrames', side: 'start', yFrac: 0.5,
        scale: 0.38, spin: 0.0003, breath: 0.1, phase: 2.4, palette: g.light,
      },
    ],
    dust: 1,
  },

  // '/about' — «الرحلة»: the story path DRAWS itself with the scroll and
  // lights its milestone stations; the values stack balances on the dark
  // band; the team gathers as a constellation; the numbers rise as bars.
  about: {
    landmarks: [
      {
        id: 'page-hero-title', kind: 'sheetFlow', side: 'end', yFrac: 0.5,
        scale: 0.5, spin: 0.0002, breath: 0.12, phase: 0.0, palette: g.dark, tilt: 0.3,
      },
      {
        id: 'story-title', kind: 'journeyPath', side: 'end', yFrac: 0.55,
        scale: 0.62, spin: 0.0002, breath: 0.1, phase: 1.2, palette: g.light, tilt: 0.42,
      },
      {
        id: 'values-title', kind: 'blockStack', side: 'start', yFrac: 0.16,
        scale: 0.44, spin: 0.00035, breath: 0.08, phase: 2.6, palette: g.dark,
      },
      {
        id: 'team-title', kind: 'constellation', side: 'end', yFrac: 0.5,
        scale: 0.46, spin: 0.00032, breath: 0.18, phase: 3.8, palette: g.light,
      },
      {
        id: 'numbers-title', kind: 'barsRising', side: 'start', yFrac: 0.5,
        scale: 0.46, spin: 0.00028, breath: 0.1, phase: 5.1, palette: g.light,
      },
    ],
    dust: 1.05,
  },

  // '/contact' — «الإشارة»: the beacon breathes rings over the hero, an
  // orbit hub accompanies the channels, and the form's envelope seals
  // itself as you scroll to send.
  contact: {
    landmarks: [
      {
        id: 'page-hero-title', kind: 'beacon', side: 'end', yFrac: 0.5,
        scale: 0.54, spin: 0.0002, breath: 0.12, phase: 0.0, palette: g.dark,
      },
      {
        id: 'channels-title', kind: 'orbitSystem', side: 'start', yFrac: 0.5,
        scale: 0.42, spin: 0.0003, breath: 0.16, phase: 2.3, palette: g.light,
      },
      {
        id: 'contact-form-title', kind: 'envelope', side: 'end', yFrac: 0.07,
        scale: 0.48, spin: 0.00018, breath: 0.08, phase: 4.4, palette: g.light, tilt: 0.2, xPad: -0.1,
      },
    ],
    dust: 1.3,
  },

  // 404 / catch-all — one faint constellation (waypoints home).
  default: {
    landmarks: [
      {
        id: 'nf-recovery-heading', kind: 'constellation', side: 'end', yFrac: 0.5,
        scale: 0.4, spin: 0.0003, breath: 0.16, phase: 0.0, palette: g.light,
      },
    ],
    dust: 0.7,
  },
}

/** Route patterns → preset keys. Locale-stripped, trailing-slash-tolerant. */
const ROUTE_MAP: { match: (p: string) => boolean; key: RunePresetKey }[] = [
  { match: (p) => p === '/', key: 'home' },
  { match: (p) => p === '/services/websites', key: 'websites' },
  { match: (p) => p === '/services/automation', key: 'automation' },
  { match: (p) => p === '/work', key: 'work' },
  { match: (p) => p === '/about', key: 'about' },
  { match: (p) => p === '/contact', key: 'contact' },
]

const LOCALE_PREFIXES = ['/ar', '/en']

/**
 * Strip a leading locale segment from a pathname.
 * '/en/work' → '/work', '/ar/work' → '/work', '/en' → '/', '/work' → '/work'.
 */
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

/** Writing direction for a (possibly locale-prefixed) pathname —
 * resolves the logical sides ('start'/'end') in the scene. English
 * routes are the /en family; everything else (incl. the /ar default)
 * is RTL. */
export function runeDirForPath(pathname: string): 'rtl' | 'ltr' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'ltr' : 'rtl'
}
