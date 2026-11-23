// Signal City: a 160×50 logical-pixel scene (DESIGN.md §11, ART_DIRECTION.md Animation language).
// Each instrument owns one layer of the city. Scene state is a handful of timestamps; the
// renderer derives every frame from (event time, now), quantized to a ~12 fps pixel cadence.
// No React in here.

import type { TrackId } from '@/data/patterns'

export const W = 160
export const H = 50
const GROUND = 44 // street line y; buildings sit above it
const FRAME = 1000 / 12 // scene frame length in ms (pixel-honest stepped motion)

export interface Palette {
  void: string
  ink: string
  inkDim: string
  kick: string
  snare: string
  hat: string
  clap: string
  sky1: string
  sky2: string
  building: string
  windowOff: string
  signOff: string
  street: string
  lampOff: string
}

// ---------- City layout (hand-placed, deterministic) ----------

/** [x, width, height] */
const BUILDINGS: [number, number, number][] = [
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
const TOWER = 4
const [TX, TW, TH] = BUILDINGS[TOWER]
const TOWER_TOP = GROUND - TH
const ANTENNA_X = TX + Math.floor(TW / 2)
const SIGN_X = TX + 4
const SIGN_Y = TOWER_TOP + 3

// 3×5 pixel letters for the neon sign.
const LETTERS: Record<string, string[]> = {
  B: ['110', '101', '110', '101', '110'],
  I: ['111', '010', '010', '010', '111'],
  T: ['111', '010', '010', '010', '010'],
}
const SIGN_PIXELS: [number, number][] = []
'BIT'.split('').forEach((ch, i) => {
  LETTERS[ch].forEach((row, y) =>
    row.split('').forEach((bit, x) => {
      if (bit === '1') SIGN_PIXELS.push([SIGN_X + i * 4 + x, SIGN_Y + y])
    }),
  )
})

/** Windows: 2×2 on a 4px grid inside each building (skipping the tower's sign area). */
const WINDOWS: [number, number][] = []
BUILDINGS.forEach(([bx, bw, bh], i) => {
  const top = GROUND - bh
  const firstY = i === TOWER ? SIGN_Y + 8 : top + 3
  for (let y = firstY; y + 2 <= GROUND - 2; y += 4) {
    for (let x = bx + 2; x + 2 <= bx + bw - 1; x += 4) WINDOWS.push([x, y])
  }
})

/** Seeded PRNG so the city (and its random choices) are stable between reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STARS: [number, number][] = (() => {
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

const LAMPS = Array.from({ length: 16 }, (_, i) => 5 + i * 10)
const IDLE_WINDOW = WINDOWS.findIndex(([x, y]) => x >= 92 && y >= GROUND - 12)

// 4×4 Bayer matrix for the sky's two-tone ordered dither.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

// ---------- Scene ----------

interface LitWindow {
  index: number
  start: number
  life: number
}

export class CityScene {
  private ctx: CanvasRenderingContext2D
  private sky: HTMLCanvasElement
  private city: HTMLCanvasElement
  private rnd = mulberry32(42)
  private p: Palette

  playing = false
  reducedMotion = false

  // Event state (performance.now() timestamps in ms; -Infinity = never)
  private kickAt = -Infinity
  private kickLen = 160
  private hatAt = -Infinity
  private star = 0
  private clapAt = -Infinity
  private clapHold = 150
  private windows: LitWindow[] = []
  private currentStep = -1

  constructor(canvas: HTMLCanvasElement, palette: Palette) {
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.p = palette
    this.sky = this.buildSky()
    this.city = this.buildCity()
  }

  private layer(draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const el = document.createElement('canvas')
    el.width = W
    el.height = H
    const c = el.getContext('2d')!
    draw(c)
    return el
  }

  private buildSky() {
    return this.layer((c) => {
      // Vertical two-tone ordered dither: darker at the top, lighter toward the horizon.
      for (let y = 0; y < GROUND; y++) {
        const t = y / GROUND // 0 → 1
        for (let x = 0; x < W; x++) {
          const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16
          c.fillStyle = t > threshold ? this.p.sky2 : this.p.sky1
          c.fillRect(x, y, 1, 1)
        }
      }
      c.fillStyle = this.p.void
      c.fillRect(0, GROUND, W, H - GROUND)
      c.fillStyle = this.p.inkDim
      c.globalAlpha = 0.35
      for (const [x, y] of STARS) c.fillRect(x, y, 1, 1)
      c.globalAlpha = 1
    })
  }

  private buildCity() {
    return this.layer((c) => {
      c.fillStyle = this.p.building
      for (const [x, w, h] of BUILDINGS) c.fillRect(x, GROUND - h, w, h)
      // Antenna mast
      c.fillRect(ANTENNA_X, TOWER_TOP - 5, 1, 5)
      c.fillStyle = this.p.windowOff
      for (const [x, y] of WINDOWS) c.fillRect(x, y, 2, 2)
      c.fillStyle = this.p.signOff
      for (const [x, y] of SIGN_PIXELS) c.fillRect(x, y, 1, 1)
    })
  }

  // ---------- Events (called at the moment a step is heard) ----------

  step(step: number, tracks: TrackId[], stepMs: number, now: number) {
    this.currentStep = step
    for (const t of tracks) {
      switch (t) {
        case 'kick':
          this.kickAt = now
          this.kickLen = Math.min(2 * FRAME, stepMs * 0.7)
          break
        case 'snare': {
          const n = 3 + Math.floor(this.rnd() * 4) // 3–6 windows
          for (let i = 0; i < n; i++) {
            const index = Math.floor(this.rnd() * WINDOWS.length)
            this.windows = this.windows.filter((w) => w.index !== index)
            this.windows.push({ index, start: now, life: stepMs * 3 })
          }
          break
        }
        case 'hat':
          this.hatAt = now
          this.star = Math.floor(this.rnd() * STARS.length)
          break
        case 'clap':
          this.clapAt = now
          this.clapHold = Math.max(stepMs, 2 * FRAME)
          break
      }
    }
  }

  stop() {
    this.currentStep = -1
    this.kickAt = this.hatAt = this.clapAt = -Infinity
    this.windows = []
  }

  // ---------- Render ----------

  draw(now: number) {
    const c = this.ctx
    const p = this.p
    const rm = this.reducedMotion
    c.drawImage(this.sky, 0, 0)

    // Hi-hat: one star twinkles (a 2-frame cross, then a bright dot).
    const hatAge = now - this.hatAt
    if (!rm && hatAge < 4 * FRAME) {
      const [sx, sy] = STARS[this.star]
      c.fillStyle = p.ink
      c.fillRect(sx, sy, 1, 1)
      if (hatAge < 2 * FRAME) {
        c.globalAlpha = 0.5
        c.fillRect(sx - 1, sy, 1, 1)
        c.fillRect(sx + 1, sy, 1, 1)
        c.fillRect(sx, sy - 1, 1, 1)
        c.fillRect(sx, sy + 1, 1, 1)
        c.globalAlpha = 1
      }
    }

    // Kick: the whole skyline drops 1px for ~2 frames.
    const kickAge = now - this.kickAt
    const dy = !rm && kickAge < this.kickLen ? 1 : 0
    c.drawImage(this.city, 0, dy)

    // Snare: lit windows fade out in 3 stepped levels.
    this.windows = this.windows.filter((w) => now - w.start < w.life)
    c.fillStyle = p.snare
    for (const w of this.windows) {
      const level = Math.floor(((now - w.start) / w.life) * 3) // 0,1,2
      c.globalAlpha = [1, 0.6, 0.3][level] ?? 0
      const [x, y] = WINDOWS[w.index]
      c.fillRect(x, y + dy, 2, 2)
    }
    c.globalAlpha = 1

    // Hi-hat: antenna light blinks teal.
    c.fillStyle = hatAge < 2 * FRAME ? p.hat : p.inkDim
    c.globalAlpha = hatAge < 2 * FRAME ? 1 : 0.35
    c.fillRect(ANTENNA_X - 1, TOWER_TOP - 6 + dy, 3, 1)
    c.globalAlpha = 1

    // Clap: the neon sign flickers on (on/off/on), holds for a step, then fades.
    const clapAge = now - this.clapAt
    let sign = 0
    if (clapAge >= 0) {
      if (rm) sign = clapAge < this.clapHold ? 1 : 0
      else if (clapAge < FRAME) sign = 1
      else if (clapAge < 2 * FRAME) sign = 0.15
      else if (clapAge < 2 * FRAME + this.clapHold) sign = 1
      else if (clapAge < 3 * FRAME + this.clapHold) sign = 0.45
    }
    if (sign > 0) {
      c.fillStyle = p.clap
      c.globalAlpha = sign
      for (const [x, y] of SIGN_PIXELS) c.fillRect(x, y + dy, 1, 1)
      c.globalAlpha = 1
    }

    // Kick: the street line flashes coral.
    const streetFlash = kickAge < FRAME ? 1 : kickAge < 2 * FRAME ? 0.5 : 0
    c.fillStyle = p.street
    c.fillRect(0, GROUND, W, 1)
    if (streetFlash) {
      c.fillStyle = p.kick
      c.globalAlpha = streetFlash
      c.fillRect(0, GROUND, W, 1)
      c.globalAlpha = 1
    }

    // Playhead: 16 street lamps, the current one lit.
    LAMPS.forEach((x, i) => {
      const lit = i === this.currentStep
      c.fillStyle = lit ? p.ink : p.lampOff
      c.fillRect(x - 1, 46, 3, 1)
      c.fillRect(x, 47, 1, 3)
      if (lit) {
        c.globalAlpha = 0.25
        c.fillRect(x - 2, 45, 5, 1)
        c.globalAlpha = 1
      }
    })

    // Idle: one window cursor blinks at 1 Hz (steady with reduced motion).
    if (!this.playing && IDLE_WINDOW >= 0) {
      const on = rm || Math.floor(now / 500) % 2 === 0
      if (on) {
        const [x, y] = WINDOWS[IDLE_WINDOW]
        c.fillStyle = p.snare
        c.fillRect(x, y, 2, 2)
      }
    }
  }
}

/** Read scene colors from the CSS tokens so the canvas and UI share one palette. */
export function readPalette(el: Element = document.documentElement): Palette {
  const s = getComputedStyle(el)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  return {
    void: v('--void', '#0d0e12'),
    ink: v('--ink', '#e6e1d3'),
    inkDim: v('--ink-dim', '#8a8d96'),
    kick: v('--kick', '#e8615a'),
    snare: v('--snare', '#f0b54a'),
    hat: v('--hat', '#5cc6d3'),
    clap: v('--clap', '#a88bf2'),
    sky1: v('--sky-1', '#0f1220'),
    sky2: v('--sky-2', '#141830'),
    building: v('--building', '#1a1d26'),
    windowOff: v('--window-off', '#22252f'),
    signOff: v('--sign-off', '#2b2540'),
    street: v('--street', '#2a2d36'),
    lampOff: v('--lamp-off', '#3a3d46'),
  }
}
