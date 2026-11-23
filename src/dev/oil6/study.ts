// DEV-ONLY Oil 6 scene studies (ART_DIRECTION.md → V3.2 Oil 6). Same Signal City composition
// (src/scene/geometry.ts) and the production Performers class, drawn with ONLY the six Oil 6
// colours: no alpha blending anywhere, so every in-between tone is an ordered (Bayer) dither.
// The production renderer (src/scene/city.ts) is not touched.

import {
  AMBIENT_WINDOWS,
  ANTENNA_X,
  APARTMENTS,
  BUILDINGS,
  GROUND,
  H,
  LAMPS,
  SIGN_PIXELS,
  STOMPER,
  STARS,
  TOWER_TOP,
  W,
  WINDOWS,
  WIRE,
  mulberry32,
  wireY,
} from '@/scene/geometry'
import { Performers } from '@/scene/performers'
import { OIL6_RAMP, WORLDS, type Oil6, type WorldId, type WorldRoles } from '@/scene/oil6'

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** Ordered-dither test: true → use the "b" colour for share `mix` (0..1). */
const dither = (x: number, y: number, mix: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < mix

/** Light direction per setting: which building edge catches the light. */
const LIGHT: Record<WorldId, 'right' | 'top' | 'left' | 'none'> = { moonlit: 'right', sunset: 'top', rain: 'none', daylight: 'left' }

export type Moment = 'rest' | 'beat'

// ---------------------------------------------------------------- character (V3.2 proposal)
// 8×14 original character: headphones (h), hair (d), skin (S), eyes (e), jacket (J) + shade (j),
// zip highlight (i), trousers (L), shoes (d). Two poses: rest, and a groove hit (arm up, knee bent).
const CHAR_REST = [
  '..dddd..',
  '.dddddd.',
  'hdSSSSdh',
  'hSeSSeSh',
  '.SSSSSS.',
  '...SS...',
  '.JJiJJj.',
  'JJJiJJjj',
  'JJJiJJjj',
  'S.JiJj.S',
  '..LLLL..',
  '..LL.LL.',
  '..LL.LL.',
  '.ddd.ddd',
]
const CHAR_BEAT = [
  '..dddd.S',
  '.ddddddJ',
  'hdSSSSdJ',
  'hSeSSeSJ',
  '.SSSSSJ.',
  '...SSJ..',
  '.JJiJj..',
  'JJJiJj..',
  'JJJiJjj.',
  'S.JiJj..',
  '..LLLL..',
  '..LL..LL',
  '.LL....L',
  'ddd...dd',
]
export const CHAR_X = 96
export const CHAR_Y = GROUND - CHAR_REST.length

function drawCharacter(c: CanvasRenderingContext2D, r: WorldRoles, pose: Moment, dy: number) {
  const rows = pose === 'beat' ? CHAR_BEAT : CHAR_REST
  const ch = r.character
  const map: Record<string, Oil6> = { d: ch.dark, h: ch.dark, S: ch.skin, e: ch.dark, J: ch.jacket, j: ch.jacketShade, i: ch.hi, L: ch.legs }
  const y0 = CHAR_Y + (pose === 'beat' ? dy : 0)
  for (let j = 0; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const k = rows[j][i]
      if (k === '.') continue
      let col = map[k]
      // 1 px rim on dark pixels whose top/left neighbour is empty (same rule as the performers).
      const empty = (jj: number, ii: number) => jj < 0 || ii < 0 || rows[jj]?.[ii] === '.' || rows[jj]?.[ii] === undefined
      if ((k === 'd' || k === 'L') && (empty(j - 1, i) || empty(j, i - 1))) col = r.actorRimStreet
      c.fillStyle = col
      c.fillRect(CHAR_X + i, y0 + j, 1, 1)
    }
  // Headphones catch the light on the beat (the character's "accent" pixel).
  if (pose === 'beat') {
    c.fillStyle = ch.hi
    c.fillRect(CHAR_X, y0 + 2, 1, 1)
  }
}

// ---------------------------------------------------------------- the study

export function renderStudy(canvas: HTMLCanvasElement, id: WorldId, moment: Moment, opts: { performers?: boolean; character?: boolean } = {}) {
  const r: WorldRoles = WORLDS[id]
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  c.imageSmoothingEnabled = false
  const px = (x: number, y: number, col: Oil6) => {
    c.fillStyle = col
    c.fillRect(x, y, 1, 1)
  }
  const beat = moment === 'beat'

  // 1. Sky: banded ordered dither through the stops.
  const { stops, at } = r.sky
  const w = 0.22
  for (let y = 0; y < GROUND; y++) {
    const t = y / GROUND
    let v = 0
    for (const a of at) v += Math.max(0, Math.min(1, (t - (a - w)) / (2 * w)))
    const k = Math.min(stops.length - 1, Math.floor(v))
    const f = v - k
    for (let x = 0; x < W; x++) px(x, y, k + 1 < stops.length && dither(x, y, f) ? stops[k + 1] : stops[k])
  }

  // 2. Stars (moonlit) — the hi-hat star twinkles cream on the beat.
  if (r.speck) STARS.forEach(([x, y], i) => px(x, y, beat && i === 3 ? r.accent.hat : r.speck!))

  // 3. Clouds.
  const rnd = mulberry32(11)
  if (r.cloud) {
    if (id === 'sunset') {
      // Long thin bands, the classic sunset streak, solid core + dithered tail.
      for (const [x0, y, len] of [[6, 12, 34], [40, 16, 46], [112, 10, 30], [124, 19, 28], [14, 22, 20]] as const)
        for (let x = x0; x < x0 + len; x++) {
          const edge = Math.min(x - x0, x0 + len - 1 - x) / 6
          if (edge >= 1 || dither(x, y, edge)) px(x, y, r.cloud)
        }
    } else if (id === 'rain') {
      // Low, dark cloud bellies: sparse dither in the top rows only (keeps the silhouettes clean).
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < W; x++) {
          const n = 0.7 - y / 10 + 0.2 * Math.sin(x / 11 + y / 4)
          if (dither(x, y, n)) px(x, y, r.cloud)
        }
    } else {
      // Daylight puffs.
      for (const [cx, cy, rw] of [[40, 6, 8], [116, 9, 7], [150, 4, 5]] as const)
        for (let y = cy - 3; y <= cy + 2; y++)
          for (let x = cx - rw - 3; x <= cx + rw + 3; x++) {
            const d = Math.hypot((x - cx) / rw, (y - cy) / 2.6)
            if (d < 0.85 || (d < 1.25 && dither(x, y, 1.25 - d))) px(x, y, r.cloud)
          }
    }
  }

  // 4. Orb (moon / sun), drawn before buildings so the sunset sun sits behind them.
  if (r.orb.kind !== 'none') {
    const { x: ox, y: oy, r: rad } = r.orb
    for (let y = oy - rad - 1; y <= oy + rad + 1; y++)
      for (let x = ox - rad - 1; x <= ox + rad + 1; x++) {
        const d = Math.hypot(x - ox, y - oy)
        if (r.orb.kind === 'moon') {
          const bite = Math.hypot(x - ox - 2, y - oy + 1) < rad - 0.5 // crescent shadow
          if (d <= rad - 0.6 && !bite) px(x, y, r.orb.body)
          else if (d <= rad + 0.3 && !bite) px(x, y, r.orb.edge)
        } else {
          if (d <= rad - 1) px(x, y, r.orb.body)
          else if (d <= rad + 0.4) px(x, y, r.orb.edge)
          else if (id === 'sunset' && d <= rad + 1.4 && dither(x, y, 0.5)) px(x, y, r.orb.edge)
        }
      }
  }

  // 5. Far skyline (aerial perspective): seeded blocks between the main buildings, hazed at the base.
  if (r.far) {
    const fr = mulberry32(3)
    for (let x = 0; x < W; ) {
      const bw = 5 + Math.floor(fr() * 9)
      const bh = 10 + Math.floor(fr() * 16)
      for (let xx = x; xx < Math.min(W, x + bw); xx++)
        for (let y = GROUND - bh; y < GROUND; y++) {
          const hazeMix = r.haze ? Math.max(0, (y - (GROUND - 8)) / 10) : 0
          px(xx, y, r.haze && dither(xx, y, hazeMix) ? r.haze : r.far)
        }
      x += bw + Math.floor(fr() * 3)
    }
  }

  // 6. Buildings + lit edge on the side facing the light.
  const dy = beat ? 1 : 0 // the kick's 1 px skyline drop
  const light = LIGHT[id]
  for (const [x, bw, bh] of BUILDINGS) {
    const top = GROUND - bh + dy
    c.fillStyle = r.building
    c.fillRect(x, top, bw, GROUND - top)
    c.fillStyle = r.buildingEdge
    if (light === 'right') c.fillRect(x + bw - 1, top, 1, GROUND - top)
    if (light === 'left') c.fillRect(x, top, 1, GROUND - top)
    if (light === 'top') c.fillRect(x, top, bw, 1)
  }
  c.fillStyle = r.building
  c.fillRect(ANTENNA_X, TOWER_TOP - 5 + dy, 1, 5)
  px(ANTENNA_X, TOWER_TOP - 6 + dy, beat ? r.accent.hat : r.lampOff) // antenna light

  // 7. Windows: off · ambient (playing) · snare hit.
  const ambient = new Set(AMBIENT_WINDOWS)
  const hitWins = new Set<number>()
  if (beat) for (let k = 0; k < 3; k++) hitWins.add(Math.floor(rnd() * WINDOWS.length))
  WINDOWS.forEach(([x, y], i) => {
    c.fillStyle = hitWins.has(i) ? r.windowHit : beat && ambient.has(i) ? r.windowLit : r.windowOff
    c.fillRect(x, y + dy, 2, 2)
  })
  c.fillStyle = r.windowOff
  for (const a of APARTMENTS) c.fillRect(a.x, a.y + dy, 6, 6)

  // 8. Neon sign (clap).
  for (const [x, y] of SIGN_PIXELS) px(x, y + dy, beat ? r.signLit : r.signOff)

  // 9. Power line.
  for (let x = WIRE.x0; x <= WIRE.x1; x++) px(x, wireY(x) + dy, r.wire)

  // 10. Rain (behind performers + character so they stay readable).
  if (r.rain) {
    // 3 px slanted streaks on a loose diagonal grid (reads as rain, not noise); hats brighten some.
    const rr = mulberry32(beat ? 5 : 9)
    for (let k = 0; k < 85; k++) {
      const x = Math.floor(rr() * (W + 12))
      const y = Math.floor(rr() * (GROUND - 2))
      const col = beat && k % 6 === 0 ? r.rainBright! : r.rain
      for (let t = 0; t < 3; t++) px(x - t, y + t, col)
    }
  }

  // 11. Performers (production class, Oil 6 roles). Beat = every performer on its hit frame.
  const perfPalette = {
    actor: r.actor,
    actorRim: r.actorRim,
    actorMid: r.actorMid,
    actorHi: r.actorHit,
    visorIdle: r.visorIdle,
    visorReady: r.visorReady,
    void: OIL6_RAMP[0],
    kick: r.accent.kick,
    snare: r.accent.snare,
    hat: r.accent.hat,
    clap: r.accent.clap,
  }
  const perf = new Performers(perfPalette)
  const now = 10_000
  if (beat) {
    perf.hit('kick', now - 20, 134)
    perf.hit('snare', now - 20, 134)
    perf.hit('hat', now - 10, 134)
    perf.hit('clap', now - 60, 134)
  }
  const drawOpts = { dy, reducedMotion: false, awake: () => beat, lightAt: () => 1 }
  if (opts.performers !== false) {
    perf.draw(c, now, drawOpts)
    // Street-level figures are seen against buildings, not sky: redraw the stomper with the
    // street rim (a second Performers instance, clipped to the stomper's box).
    if (r.actorRimStreet !== r.actorRim) {
      const street = new Performers({ ...perfPalette, actorRim: r.actorRimStreet })
      if (beat) street.hit('kick', now - 20, 134)
      c.save()
      c.beginPath()
      c.rect(STOMPER.x - 3, STOMPER.y - 1, 15, 14)
      c.clip()
      street.draw(c, now, drawOpts)
      c.restore()
    }
  }

  // 12. Character.
  if (opts.character !== false) drawCharacter(c, r, moment, 0)

  // 13. Street, ground, reflections, splashes, lamps (playhead on step 4).
  c.fillStyle = r.ground
  c.fillRect(0, GROUND + 1, W, H - GROUND - 1)
  c.fillStyle = beat ? r.accent.kick : r.street
  c.fillRect(0, GROUND, W, 1)
  if (r.reflection) {
    // Wet street: lit windows and the sign mirror into the street band as 50 % dithered dashes.
    const lit = WINDOWS.filter((_, i) => hitWins.has(i) || (beat && ambient.has(i))).map(([x]) => x)
    // Broken 1 px dashes on alternate rows (water ripples), never a solid block.
    for (const x of new Set([...lit, ...SIGN_PIXELS.map(([sx]) => sx)]))
      for (const y of [GROUND + 1, GROUND + 3, GROUND + 5]) if (y < H && dither(x, y, 0.5)) px(x, y, r.reflection)
    if (beat) for (const sx of [12, 41, 77, 108, 140]) px(sx, GROUND - 1, r.rainBright!) // kick splashes
  }
  LAMPS.forEach((x, i) => {
    const lit = beat && i === 4
    c.fillStyle = lit ? r.lampLit : r.lampOff
    c.fillRect(x - 1, 46, 3, 1)
    c.fillRect(x, 47, 1, 3)
    if (lit) {
      // Glow without alpha: a dithered halo in the lamp's warm colour.
      for (let gx = x - 3; gx <= x + 3; gx++) if (dither(gx, 45, 0.5)) px(gx, 45, r.windowLit)
    }
  })

  return c
}

// ---------------------------------------------------------------- checks

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

/** Every colour present in the canvas, with pixel counts. */
export function colourCensus(canvas: HTMLCanvasElement): Record<string, number> {
  const d = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
  const out: Record<string, number> = {}
  for (let i = 0; i < d.length; i += 4) {
    const k = d[i + 3] === 255 ? hex(d[i], d[i + 1], d[i + 2]) : `alpha:${d[i + 3]}`
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/**
 * Readability: for a sprite's bounding box, the share of its outline pixels whose colour is at
 * least `minSteps` Oil 6 value steps away from the background pixel just outside the sprite.
 */
export function silhouetteContrast(withSprite: HTMLCanvasElement, without: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }, minSteps = 2) {
  const a = withSprite.getContext('2d')!.getImageData(0, 0, W, H).data
  const b = without.getContext('2d')!.getImageData(0, 0, W, H).data
  const idx = (x: number, y: number) => (y * W + x) * 4
  const step = (d: Uint8ClampedArray, i: number) => OIL6_RAMP.indexOf(hex(d[i], d[i + 1], d[i + 2]) as Oil6)
  const isSprite = (x: number, y: number) => {
    const i = idx(x, y)
    return a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]
  }
  let edges = 0
  let good = 0
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      if (!isSprite(x, y)) continue
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || isSprite(nx, ny)) continue
        edges++
        if (Math.abs(step(a, idx(x, y)) - step(b, idx(nx, ny))) >= minSteps) good++
      }
    }
  return edges ? +(good / edges).toFixed(2) : 0
}
