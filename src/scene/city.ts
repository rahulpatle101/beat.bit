// Signal City Live: a 160×50 logical-pixel scene.
// V1 (DESIGN.md §11): each instrument owns one layer of the city.
// V2.1 (ART_DIRECTION.md / DESIGN.md → V2.1): each instrument also has a performer, and the
// city has moments (switch-on, power-down, blackout, ripple). Scene state is a handful of
// timestamps; every frame is derived from (event time, now). No React in here.
//
// Timing rule: rhythmic motion comes only from heard sound events (step(), audition()).
// Moments come from transport/UI cues and use fixed pixel-frame counts.

import type { MoodId, TrackId } from '@/data/patterns'
import {
  AMBIENT_WINDOWS,
  ANTENNA_X,
  APARTMENTS,
  APARTMENT_WINDOWS,
  BUILDINGS,
  FRAME,
  GROUND,
  H,
  IDLE_WINDOW,
  LAMPS,
  SIGN_PIXELS,
  STARS,
  TOWER_TOP,
  W,
  WINDOWS,
  WIRE,
  mulberry32,
  wireY,
} from './geometry'
import { Performers } from './performers'

export { W, H } from './geometry'

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
  actor: string
  actorRim: string
  actorMid: string
  visorIdle: string
  visorReady: string
  wire: string
}

export type SceneCue = 'start' | 'stop' | 'cleared' | 'groove' | 'non-empty' | 'remix'

/** V2.2 city moods: subtle sky tints per groove (top / horizon dither pair). */
export const MOODS: Record<MoodId, { sky1: string; sky2: string }> = {
  night: { sky1: '', sky2: '' }, // '' = the V1 palette sky (--sky-1 / --sky-2)
  warm: { sky1: '#16111a', sky2: '#241921' },
  teal: { sky1: '#0b1419', sky2: '#0f222a' },
  red: { sky1: '#190c13', sky2: '#290f19' },
}

// 4×4 Bayer matrix for the sky's two-tone ordered dither.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Snare lights this many small windows (V2.1 C2; V1 was 3–6). */
const SNARE_WINDOWS = 3
const SNARE_CANDIDATES = WINDOWS.map((_, i) => i).filter((i) => !APARTMENT_WINDOWS.has(i))

interface LitWindow {
  index: number
  start: number
  life: number
}

type Mode = 'idle' | 'on' | 'dark'
type Transition = 'switchOn' | 'powerDown' | 'blackout' | 'return' | null

export class CityScene {
  private ctx: CanvasRenderingContext2D
  private sky: HTMLCanvasElement
  private city: HTMLCanvasElement
  private rnd = mulberry32(42)
  private p: Palette
  private performers: Performers

  reducedMotion = false

  // V1 event state (frame-timebase timestamps in ms; -Infinity = never)
  private kickAt = -Infinity
  private kickLen = 160
  private hatAt = -Infinity
  private star = 0
  private clapAt = -Infinity
  private clapHold = 150
  private windows: LitWindow[] = []
  private currentStep = -1

  // V2.1 moments
  private mode: Mode = 'idle'
  private transition: Transition = null
  private modeAt = -Infinity
  private rippleAt = -Infinity
  private cues: SceneCue[] = []

  // V2.2
  private skies = new Map<MoodId, HTMLCanvasElement>()
  private mood: MoodId = 'night'
  private rollAt = -Infinity
  private rollSeed = 1

  constructor(canvas: HTMLCanvasElement, palette: Palette) {
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.p = palette
    this.sky = this.buildSky('night')
    this.skies.set('night', this.sky)
    this.city = this.buildCity()
    this.performers = new Performers({
      actor: palette.actor,
      actorRim: palette.actorRim,
      actorMid: palette.actorMid,
      actorHi: palette.ink,
      visorIdle: palette.visorIdle,
      visorReady: palette.visorReady,
      void: palette.void,
      kick: palette.kick,
      snare: palette.snare,
      hat: palette.hat,
      clap: palette.clap,
    })
  }

  /** True while the transport is running (on or blacked out). */
  get playing(): boolean {
    return this.mode !== 'idle'
  }

  private layer(draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const el = document.createElement('canvas')
    el.width = W
    el.height = H
    const c = el.getContext('2d')!
    draw(c)
    return el
  }

  /** Switch the sky tint (cached per mood). Visual only; applied on the next frame. */
  setMood(mood: MoodId) {
    if (mood === this.mood) return
    this.mood = mood
    let sky = this.skies.get(mood)
    if (!sky) {
      sky = this.buildSky(mood)
      this.skies.set(mood, sky)
    }
    this.sky = sky
  }

  private buildSky(mood: MoodId) {
    const sky1 = MOODS[mood].sky1 || this.p.sky1
    const sky2 = MOODS[mood].sky2 || this.p.sky2
    return this.layer((c) => {
      // Vertical two-tone ordered dither: darker at the top, lighter toward the horizon.
      for (let y = 0; y < GROUND; y++) {
        const t = y / GROUND // 0 → 1
        for (let x = 0; x < W; x++) {
          const threshold = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16
          c.fillStyle = t > threshold ? sky2 : sky1
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
      // V2.1: apartment windows merge 2×2 blocks of V1 windows (no facade cut).
      for (const a of APARTMENTS) c.fillRect(a.x, a.y, 6, 6)
      c.fillStyle = this.p.signOff
      for (const [x, y] of SIGN_PIXELS) c.fillRect(x, y, 1, 1)
      // V2.1: power line between buildings 7 and 9.
      c.fillStyle = this.p.wire
      for (let x = WIRE.x0; x <= WIRE.x1; x++) c.fillRect(x, wireY(x), 1, 1)
    })
  }

  // ---------- Events ----------

  /** A scheduled step was heard at `now` (frame timebase). */
  step(step: number, tracks: TrackId[], stepMs: number, now: number) {
    this.currentStep = step
    for (const t of tracks) {
      this.performers.hit(t, now, stepMs)
      switch (t) {
        case 'kick':
          this.kickAt = now
          this.kickLen = Math.min(2 * FRAME, stepMs * 0.7)
          break
        case 'snare': {
          for (let i = 0; i < SNARE_WINDOWS; i++) {
            const index = SNARE_CANDIDATES[Math.floor(this.rnd() * SNARE_CANDIDATES.length)]
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

  /** An audition sound was heard (step toggled on while stopped): its performer reacts once. */
  audition(track: TrackId, stepMs: number, now: number) {
    this.performers.hit(track, now, stepMs)
  }

  /** Transport and UI cues. Applied at the next draw, in the frame timebase. */
  cue(c: SceneCue) {
    this.cues.push(c)
  }

  private applyCue(c: SceneCue, now: number) {
    switch (c) {
      case 'start':
        this.mode = 'on'
        this.transition = 'switchOn'
        this.modeAt = now
        break
      case 'stop':
        this.mode = 'idle'
        this.transition = 'powerDown'
        this.modeAt = now
        this.currentStep = -1
        this.kickAt = this.hatAt = this.clapAt = -Infinity
        this.windows = []
        this.performers.reset()
        break
      case 'cleared':
        if (this.mode !== 'on') break
        this.mode = 'dark'
        this.transition = 'blackout'
        this.modeAt = now
        this.clapAt = -Infinity // the sign goes dark
        break
      case 'non-empty':
        if (this.mode !== 'dark') break
        this.mode = 'on'
        this.transition = 'return'
        this.modeAt = now
        break
      case 'groove':
        if (this.mode === 'dark') this.applyCue('non-empty', now)
        else if (this.mode === 'on') this.rippleAt = now
        break
      case 'remix':
        this.rollAt = now
        this.rollSeed = (this.rollSeed * 16807) % 2147483647
        break
    }
  }

  // ---------- Moments ----------

  /** Light multiplier for a window at x (switch-on / blackout / return sweeps). */
  private lightAt = (x: number, now: number): number => {
    const age = now - this.modeAt
    const rm = this.reducedMotion
    const col4 = Math.floor(x / 40) // 0..3 → 4-frame left→right sweep
    if (this.mode === 'dark') {
      if (rm || this.transition !== 'blackout') return 0
      return age < col4 * FRAME ? 1 : 0
    }
    if (this.mode === 'on' && !rm) {
      if (this.transition === 'switchOn') return age >= col4 * FRAME ? 1 : 0
      if (this.transition === 'return') return age >= (x < W / 2 ? 0 : 1) * FRAME ? 1 : 0
    }
    return 1
  }

  /** Switch-on and power-down sequencing for performers. */
  private awake = (part: 'stomper' | 'crowd' | 'bird', index: number, now: number): boolean => {
    const age = now - this.modeAt
    const rm = this.reducedMotion
    if (this.mode === 'idle') return this.transition === 'powerDown' && !rm && age < FRAME
    if (this.transition !== 'switchOn' || rm) return true
    if (part === 'stomper') return age >= FRAME
    if (part === 'bird') return age >= index * FRAME
    return age >= 2 * FRAME // crowd stands on frame 2
  }

  // ---------- Render ----------

  draw(now: number) {
    for (const c of this.cues.splice(0)) this.applyCue(c, now)

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

    // V2.1 ambient windows: the city is "on" while playing (30% amber), with sweeps and ripple.
    if (this.mode !== 'idle') {
      const rippleAge = now - this.rippleAt
      c.fillStyle = p.snare
      for (const i of AMBIENT_WINDOWS) {
        const [x, y] = WINDOWS[i]
        const light = this.lightAt(x, now)
        if (!light) continue
        const rc = Math.floor(x / 54) // 3-frame ripple
        const rippling = !rm && rippleAge >= rc * FRAME && rippleAge < (rc + 1) * FRAME
        c.globalAlpha = rippling ? 0.75 : 0.3
        c.fillRect(x, y + dy, 2, 2)
      }
      c.globalAlpha = 1
    }

    // V2.2 remix tumble: for 3 pixel frames a few random windows flicker like dice faces.
    const rollAge = now - this.rollAt
    if (!rm && rollAge >= 0 && rollAge < 3 * FRAME) {
      const rr = mulberry32(this.rollSeed + Math.floor(rollAge / FRAME))
      c.fillStyle = p.snare
      c.globalAlpha = 0.8
      for (let k = 0; k < 5; k++) {
        const [x, y] = WINDOWS[SNARE_CANDIDATES[Math.floor(rr() * SNARE_CANDIDATES.length)]]
        c.fillRect(x, y + dy, 2, 2)
      }
      c.globalAlpha = 1
    }

    // Snare: lit windows fade out in 3 stepped levels (gated by blackout).
    this.windows = this.windows.filter((w) => now - w.start < w.life)
    c.fillStyle = p.snare
    for (const w of this.windows) {
      const [x, y] = WINDOWS[w.index]
      const level = Math.floor(((now - w.start) / w.life) * 3) // 0,1,2
      c.globalAlpha = ([1, 0.6, 0.3][level] ?? 0) * this.lightAt(x, now)
      if (c.globalAlpha > 0) c.fillRect(x, y + dy, 2, 2)
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

    // V2.1 performers.
    this.performers.draw(c, now, {
      dy,
      reducedMotion: rm,
      awake: (part, i) => this.awake(part, i, now),
      lightAt: (x) => (this.mode === 'idle' ? 1 : this.lightAt(x, now)),
    })

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
    if (this.mode === 'idle' && IDLE_WINDOW >= 0) {
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
    actor: v('--actor', '#3b3f4a'),
    actorRim: v('--actor-rim', '#6e727c'),
    actorMid: v('--actor-mid', '#6e727c'),
    visorIdle: v('--visor-idle', '#2e2224'),
    visorReady: v('--visor-ready', '#4a2826'),
    wire: v('--wire', '#2e313a'),
  }
}
