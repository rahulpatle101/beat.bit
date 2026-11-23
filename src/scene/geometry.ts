// Signal City geometry on the 160×50 logical-pixel grid.
// V1 layout (unchanged) + V2.1 performer placements (ART_DIRECTION.md → V2.1 "Composition").

export const W = 160
export const H = 50
export const GROUND = 44 // street line y; buildings sit above it
export const FRAME = 1000 / 12 // scene "pixel frame" in ms (~12 fps stepped motion)

// ---------- V1 city ----------

/** [x, width, height] */
export const BUILDINGS: [number, number, number][] = [
  [0, 13, 17],
  [14, 17, 25],
  [32, 12, 15],
  [45, 22, 30],
  [68, 19, 38], // tower: antenna + neon sign
  [88, 16, 21],
  [105, 12, 28],
  [118, 20, 18],
  [139, 21, 26],
]
export const TOWER = 4
const [TX, TW, TH] = BUILDINGS[TOWER]
export const TOWER_TOP = GROUND - TH
export const ANTENNA_X = TX + Math.floor(TW / 2)
const SIGN_X = TX + 4
const SIGN_Y = TOWER_TOP + 3

// 3×5 pixel letters for the neon sign.
const LETTERS: Record<string, string[]> = {
  B: ['110', '101', '110', '101', '110'],
  I: ['111', '010', '010', '010', '111'],
  T: ['111', '010', '010', '010', '010'],
}
export const SIGN_PIXELS: [number, number][] = []
'BIT'.split('').forEach((ch, i) => {
  LETTERS[ch].forEach((row, y) =>
    row.split('').forEach((bit, x) => {
      if (bit === '1') SIGN_PIXELS.push([SIGN_X + i * 4 + x, SIGN_Y + y])
    }),
  )
})

/** Windows: 2×2 on a 4px grid inside each building (skipping the tower's sign area). */
export const WINDOWS: [number, number][] = []
BUILDINGS.forEach(([bx, bw, bh], i) => {
  const top = GROUND - bh
  const firstY = i === TOWER ? SIGN_Y + 8 : top + 3
  for (let y = firstY; y + 2 <= GROUND - 2; y += 4) {
    for (let x = bx + 2; x + 2 <= bx + bw - 1; x += 4) WINDOWS.push([x, y])
  }
})

/** Seeded PRNG so the city (and its random choices) are stable between reloads. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const STARS: [number, number][] = (() => {
  const rnd = mulberry32(7)
  const out: [number, number][] = []
  while (out.length < 14) {
    const x = Math.floor(rnd() * W)
    const y = Math.floor(rnd() * 16) + 1
    // Keep stars out of buildings.
    const inside = BUILDINGS.some(([bx, bw, bh]) => x >= bx && x < bx + bw && y >= GROUND - bh)
    if (!inside && Math.abs(x - ANTENNA_X) > 3) out.push([x, y])
  }
  return out
})()

export const LAMPS = Array.from({ length: 16 }, (_, i) => 5 + i * 10)
export const IDLE_WINDOW = WINDOWS.findIndex(([x, y]) => x >= 92 && y >= GROUND - 12)

// ---------- V2.1 performers (approved coordinates) ----------

/** Stomper (kick): 9×12, top-left; feet on y = 43. Not shifted by the skyline drop. */
export const STOMPER = { x: 19, y: 32 }

/** Rooftop crowd (clap): 4 figures, 4 px wide, on building 4's roof. */
export const CROWD_X = [47, 52, 57, 62]
export const ROOF = GROUND - BUILDINGS[3][2] // y = 14

/** Power line between buildings 7 and 9, sagging 3 px. */
export const WIRE = { x0: 117, y0: 17, x1: 138, y1: 19, sag: 3 }
export function wireY(x: number): number {
  const t = (x - WIRE.x0) / (WIRE.x1 - WIRE.x0)
  return Math.round(WIRE.y0 + (WIRE.y1 - WIRE.y0) * t + WIRE.sag * Math.sin(Math.PI * t))
}
/** Wire birds (hi-hat): 4×3 each, sitting on the wire. */
export const BIRD_X = [120, 125, 130, 134]

/**
 * Apartment windows (snare): each merges a 2×2 block of existing V1 windows into one 6×6
 * window, so no facade is cut. Picked as the block nearest the approved anchor.
 */
function apartmentBlock(building: number, prefer: [number, number]) {
  const [bx, bw, bh] = BUILDINGS[building]
  const top = GROUND - bh
  const has = (x: number, y: number) => WINDOWS.some((w) => w[0] === x && w[1] === y)
  const candidates = WINDOWS.filter(
    ([x, y]) => x >= bx && x < bx + bw && y >= top && has(x + 4, y) && has(x, y + 4) && has(x + 4, y + 4),
  )
  candidates.sort(
    (a, b) =>
      Math.hypot(a[0] - prefer[0], a[1] - prefer[1]) - Math.hypot(b[0] - prefer[0], b[1] - prefer[1]),
  )
  const [x, y] = candidates[0]
  return { x, y }
}
export const APARTMENTS = [
  apartmentBlock(1, [16, 22]), // → (16, 22)
  apartmentBlock(5, [93, 27]), // → (94, 26)
  apartmentBlock(8, [149, 22]), // → (149, 21)
]
/** Indices of V1 windows absorbed into apartment windows (never lit individually). */
export const APARTMENT_WINDOWS = new Set(
  WINDOWS.flatMap(([x, y], i) =>
    APARTMENTS.some((a) => x >= a.x && x < a.x + 6 && y >= a.y && y < a.y + 6) ? [i] : [],
  ),
)

/** Ambient windows while playing (approved preview set): 8 windows, none on the tower. */
const AMBIENT_XY: [number, number][] = [
  [2, 30], [51, 25], [2, 38], [51, 37], [55, 21], [38, 36], [107, 31], [16, 34],
]
export const AMBIENT_WINDOWS = AMBIENT_XY.map(([ax, ay]) =>
  WINDOWS.findIndex(([x, y]) => x === ax && y === ay),
)
