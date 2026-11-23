// Oil 6 by GrafxKid (https://lospec.com/palette-list/oil-6): the pixel-world palette (ART_DIRECTION.md → V3.2 Oil 6).
// Six colours, dark → light. The pixel world uses ONLY these; variety comes from redistributing
// them across semantic roles per "light setting", plus ordered dithering, silhouettes and contrast.
// Not yet wired into the production renderer (src/scene/city.ts): studies only, pending approval.

export const OIL6 = {
  /** 0 · deep navy: night sky top, nearest silhouettes, outlines. */
  navy: '#272744',
  /** 1 · indigo: night horizon, far silhouettes, rain-night buildings, shadow. */
  indigo: '#494d7e',
  /** 2 · mauve: mid-distance, rim light at night, rain streaks, haze. */
  mauve: '#8b6d9c',
  /** 3 · dusty rose: sunset sky, daylight buildings, warm rim light. */
  rose: '#c69fa5',
  /** 4 · peach: lamp light, lit windows, skin, sunset horizon. */
  peach: '#f2d3ab',
  /** 5 · cream: highlights, moon/sun, hit frames, the single brightest accent. */
  cream: '#fbf5ef',
} as const

export type Oil6 = (typeof OIL6)[keyof typeof OIL6]
/** Dark → light ramp (index = value step). */
export const OIL6_RAMP: readonly Oil6[] = [OIL6.navy, OIL6.indigo, OIL6.mauve, OIL6.rose, OIL6.peach, OIL6.cream]

/**
 * Semantic roles of the pixel world. Each light setting maps every role to one Oil 6 colour
 * (or a dithered pair `[a, b, mix]`, mix = share of b, quantised to 4×4 Bayer levels).
 */
export interface WorldRoles {
  label: string
  /** Sky bands from top to horizon: colours + where each transition is centred (0..1 of sky height). */
  sky: { stops: Oil6[]; at: number[] }
  /** Celestial body: moon or sun (or none). */
  orb: { kind: 'moon' | 'sun' | 'none'; body: Oil6; edge: Oil6; x: number; y: number; r: number }
  /** Stars / cloud specks. */
  speck: Oil6 | null
  cloud: Oil6 | null
  /** Buildings (silhouettes) and their 1 px lit edge (the side facing the light). */
  building: Oil6
  buildingEdge: Oil6
  /** Far skyline layer behind the main buildings (aerial perspective). */
  far: Oil6 | null
  windowOff: Oil6
  /** Ambient lit windows while playing, and snare/hit-lit windows (brighter). */
  windowLit: Oil6
  windowHit: Oil6
  signOff: Oil6
  signLit: Oil6
  wire: Oil6
  street: Oil6
  ground: Oil6
  lampOff: Oil6
  lampLit: Oil6
  /** Performers (V2.1) and the character: body, 1 px rim, hit frame, accents. */
  actor: Oil6
  /** Rim for figures seen against the SKY (crowd, birds). */
  actorRim: Oil6
  /** Rim for figures seen against BUILDINGS at street level (stomper, character). */
  actorRimStreet: Oil6
  actorMid: Oil6
  actorHit: Oil6
  visorIdle: Oil6
  visorReady: Oil6
  /** Accents that replace the track hues inside the pixel world (kick/snare/hat/clap). */
  accent: { kick: Oil6; snare: Oil6; hat: Oil6; clap: Oil6 }
  /** Character (V3.2 proposal): hair+headphones, skin, jacket, trousers, highlight. */
  character: { dark: Oil6; skin: Oil6; jacket: Oil6; jacketShade: Oil6; legs: Oil6; hi: Oil6 }
  /** Weather. */
  rain: Oil6 | null
  rainBright: Oil6 | null
  /** Street reflection colour (mirrored lights, dithered at 50 %). */
  reflection: Oil6 | null
  /** Horizon haze/fog dithered over the far layer and building bases. */
  haze: Oil6 | null
}

const C = OIL6

/** The four light settings (same city composition; palette redistribution only). */
export const WORLDS = {
  moonlit: {
    label: 'MOONLIT NIGHT',
    sky: { stops: [C.navy, C.indigo, C.mauve], at: [0.4, 1.12] },
    orb: { kind: 'moon', body: C.cream, edge: C.peach, x: 132, y: 8, r: 4 },
    speck: C.rose,
    cloud: null,
    building: C.navy,
    buildingEdge: C.indigo,
    far: C.indigo,
    windowOff: C.indigo,
    windowLit: C.peach,
    windowHit: C.cream,
    signOff: C.indigo,
    signLit: C.rose,
    wire: C.indigo,
    street: C.indigo,
    ground: C.navy,
    lampOff: C.indigo,
    lampLit: C.cream,
    actor: C.navy,
    actorRim: C.rose,
    actorRimStreet: C.rose,
    actorMid: C.indigo,
    actorHit: C.cream,
    visorIdle: C.indigo,
    visorReady: C.mauve,
    accent: { kick: C.peach, snare: C.peach, hat: C.cream, clap: C.rose },
    character: { dark: C.navy, skin: C.peach, jacket: C.mauve, jacketShade: C.indigo, legs: C.indigo, hi: C.cream },
    rain: null,
    rainBright: null,
    reflection: null,
    haze: null,
  },
  sunset: {
    label: 'WARM SUNSET',
    sky: { stops: [C.mauve, C.rose, C.peach], at: [0.35, 0.78] },
    orb: { kind: 'sun', body: C.cream, edge: C.peach, x: 98, y: 33, r: 7 },
    speck: null,
    cloud: C.peach,
    building: C.indigo,
    buildingEdge: C.mauve,
    far: C.mauve,
    windowOff: C.navy,
    windowLit: C.peach,
    windowHit: C.cream,
    signOff: C.navy,
    signLit: C.peach,
    wire: C.navy,
    street: C.navy,
    ground: C.navy,
    lampOff: C.indigo,
    lampLit: C.cream,
    actor: C.navy,
    actorRim: C.navy, // backlit: pure silhouettes, no rim
    actorRimStreet: C.peach,
    actorMid: C.indigo,
    actorHit: C.cream,
    visorIdle: C.indigo,
    visorReady: C.rose,
    accent: { kick: C.peach, snare: C.peach, hat: C.cream, clap: C.cream },
    character: { dark: C.navy, skin: C.peach, jacket: C.rose, jacketShade: C.mauve, legs: C.indigo, hi: C.cream },
    rain: null,
    rainBright: null,
    reflection: null,
    haze: C.rose,
  },
  rain: {
    label: 'RAINY NIGHT',
    sky: { stops: [C.indigo, C.mauve], at: [1.0] },
    orb: { kind: 'none', body: C.navy, edge: C.navy, x: 0, y: 0, r: 0 },
    speck: null,
    cloud: C.navy,
    building: C.navy,
    buildingEdge: C.indigo,
    far: C.indigo,
    windowOff: C.indigo,
    windowLit: C.peach,
    windowHit: C.cream,
    signOff: C.indigo,
    signLit: C.rose,
    wire: C.indigo,
    street: C.mauve,
    ground: C.navy,
    lampOff: C.indigo,
    lampLit: C.cream,
    actor: C.navy,
    actorRim: C.rose,
    actorRimStreet: C.rose,
    actorMid: C.indigo,
    actorHit: C.cream,
    visorIdle: C.indigo,
    visorReady: C.mauve,
    accent: { kick: C.peach, snare: C.peach, hat: C.cream, clap: C.rose },
    character: { dark: C.navy, skin: C.peach, jacket: C.rose, jacketShade: C.mauve, legs: C.indigo, hi: C.cream },
    rain: C.mauve,
    rainBright: C.rose,
    reflection: C.mauve,
    haze: C.mauve,
  },
  daylight: {
    label: 'SOFT DAYLIGHT',
    sky: { stops: [C.rose, C.peach, C.cream], at: [0.25, 0.8] },
    orb: { kind: 'sun', body: C.cream, edge: C.cream, x: 24, y: 7, r: 4 },
    speck: null,
    cloud: C.cream,
    building: C.mauve,
    buildingEdge: C.rose,
    far: C.rose,
    windowOff: C.indigo,
    windowLit: C.peach,
    windowHit: C.cream,
    signOff: C.indigo,
    signLit: C.cream,
    wire: C.indigo,
    street: C.indigo,
    ground: C.mauve,
    lampOff: C.indigo,
    lampLit: C.cream,
    actor: C.navy,
    actorRim: C.navy, // daylight: solid dark figures
    actorRimStreet: C.navy,
    actorMid: C.indigo,
    actorHit: C.cream,
    visorIdle: C.indigo,
    visorReady: C.rose,
    accent: { kick: C.cream, snare: C.peach, hat: C.cream, clap: C.cream },
    character: { dark: C.navy, skin: C.peach, jacket: C.cream, jacketShade: C.peach, legs: C.navy, hi: C.indigo },
    rain: null,
    rainBright: null,
    reflection: null,
    haze: C.peach,
  },
} as const satisfies Record<string, WorldRoles>

export type WorldId = keyof typeof WORLDS
