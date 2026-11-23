// V2.1 performers: Stomper (kick), Resident (snare), Wire Birds (hi-hat), Rooftop Crowd (clap).
// Poses are pure functions of (time since the sound was heard, step length): the motion
// personalities in ART_DIRECTION.md → V2.1 "Motion personalities and timing".
// Performers never move without a sound event (hit()).

import type { TrackId } from '@/data/patterns'
import { APARTMENTS, BIRD_X, CROWD_X, FRAME, ROOF, STOMPER, wireY } from './geometry'
import { SPRITES, drawSilhouette, drawSprite } from './sprites'

// ---------- Timing (pure, unit-tested) ----------

export const TIMING = {
  kick: (s: number) => ({ hit: Math.min(2 * FRAME, 0.65 * s), land: Math.min(FRAME, 0.3 * s) }),
  snare: (s: number) => ({ cheer: Math.min(FRAME, 0.4 * s), light: 3 * s }),
  hat: (s: number) => ({ hop: Math.min(50, 0.35 * s) }),
  clap: (s: number) => ({ stagger: Math.min(40, 0.25 * s), half: Math.min(FRAME, 0.35 * s), hold: 0.9 * s }),
}

export type KickPose = 'ready' | 'hit' | 'land'
export function kickPose(age: number, s: number): KickPose {
  if (!(age >= 0)) return 'ready'
  const t = TIMING.kick(s)
  return age < t.hit ? 'hit' : age < t.hit + t.land ? 'land' : 'ready'
}

/** null = window dark. level = light intensity (100/60/30% per step). */
export function snarePose(age: number, s: number): { cheer: boolean; level: number } | null {
  if (!(age >= 0)) return null
  const t = TIMING.snare(s)
  if (age >= t.light) return null
  return { cheer: age < t.cheer, level: [1, 0.6, 0.3][Math.floor(age / s)] ?? 0 }
}

export function hatHop(age: number, s: number): boolean {
  return age >= 0 && age < TIMING.hat(s).hop
}

export type ClapPose = 'ready' | 'half' | 'full'
/** `figure` index staggers odd figures; pass 0 for no stagger (reduced motion). */
export function clapPose(age: number, s: number, figure: number): ClapPose {
  if (!(age >= 0)) return 'ready'
  const t = TIMING.clap(s)
  const a = age - (figure % 2) * t.stagger
  if (a < 0) return 'ready'
  if (a < t.half) return 'half'
  if (a < t.hold) return 'full'
  if (a < t.hold + t.half) return 'half'
  return 'ready'
}

// ---------- Performer state + drawing ----------

export interface PerformerPalette {
  actor: string
  actorRim: string
  actorMid: string
  actorHi: string
  visorIdle: string
  visorReady: string
  void: string
  kick: string
  snare: string
  hat: string
  clap: string
}

export interface DrawOptions {
  /** Skyline drop (px) for building-attached performers. The Stomper ignores it. */
  dy: number
  reducedMotion: boolean
  /** Awake test per performer part (switch-on / power-down sequencing, decided by the city). */
  awake: (part: 'stomper' | 'crowd' | 'bird', index: number) => boolean
  /** Light multiplier for a window at x (blackout gating), 0..1. */
  lightAt: (x: number) => number
}

export class Performers {
  private at: Record<TrackId, number> = { kick: -Infinity, snare: -Infinity, hat: -Infinity, clap: -Infinity }
  private step: Record<TrackId, number> = { kick: 144, snare: 144, hat: 144, clap: 144 }
  private apartment = 2 // rotates 0→1→2 on each snare
  private bird = 3 // rotates left→right on each hat
  private p: PerformerPalette

  constructor(palette: PerformerPalette) {
    this.p = palette
  }

  /** A sound for `track` was heard at `now` (ms, frame timebase). */
  hit(track: TrackId, now: number, stepMs: number) {
    this.at[track] = now
    this.step[track] = stepMs
    if (track === 'snare') this.apartment = (this.apartment + 1) % APARTMENTS.length
    if (track === 'hat') this.bird = (this.bird + 1) % BIRD_X.length
  }

  reset() {
    this.at = { kick: -Infinity, snare: -Infinity, hat: -Infinity, clap: -Infinity }
  }

  /** Is any performer mid-pose? (Lets the city know a reaction is visible.) */
  active(now: number): boolean {
    return (Object.keys(this.at) as TrackId[]).some((t) => now - this.at[t] < 3 * this.step[t])
  }

  draw(c: CanvasRenderingContext2D, now: number, o: DrawOptions) {
    const p = this.p
    const rm = o.reducedMotion
    const age = (t: TrackId) => now - this.at[t]

    // Resident (snare): building-attached → dy.
    const sp = snarePose(age('snare'), this.step.snare)
    if (sp) {
      const w = APARTMENTS[this.apartment]
      const level = sp.level * o.lightAt(w.x)
      if (level > 0) {
        c.globalAlpha = level
        c.fillStyle = p.snare
        c.fillRect(w.x, w.y + o.dy, 6, 6)
        c.globalAlpha = 1
        drawSprite(c, sp.cheer ? SPRITES.residentCheer : SPRITES.residentRest, w.x, w.y + o.dy, { '#': p.void })
      }
    }

    // Wire birds (hi-hat): the next bird hops; its neighbours flinch (eyes flick bright).
    const hop = hatHop(age('hat'), this.step.hat)
    BIRD_X.forEach((bx, i) => {
      const y = wireY(bx + 1) + o.dy - 3
      if (!o.awake('bird', i) && !(hop && i === this.bird)) {
        drawSilhouette(c, SPRITES.birdAsleep, bx, y, p.actor, p.actorRim)
        return
      }
      if (hop && i === this.bird) {
        drawSprite(c, SPRITES.birdAwake, bx, y - (rm ? 0 : 1), { '#': p.actorHi, e: p.hat })
        return
      }
      const flinch = hop && Math.abs(i - this.bird) === 1
      drawSilhouette(c, SPRITES.birdAwake, bx, y, p.actor, p.actorRim, { e: flinch ? p.actorHi : p.actorRim })
    })

    // Rooftop crowd (clap): dark bodies; arm poses + violet hands carry the celebration.
    CROWD_X.forEach((x, i) => {
      const pose = clapPose(age('clap'), this.step.clap, rm ? 0 : i)
      if (pose === 'ready' && !o.awake('crowd', i)) {
        drawSilhouette(c, SPRITES.crowdSit, x, ROOF - 3 + o.dy, p.actor, p.actorRim)
        return
      }
      const rows = pose === 'full' && !rm ? SPRITES.crowdFull : pose === 'ready' ? SPRITES.crowdReady : SPRITES.crowdHalf
      drawSilhouette(c, rows, x, ROOF - rows.length + o.dy, p.actor, p.actorRim, { V: p.clap })
    })

    // Stomper (kick): heavy and grounded. On the street, so no skyline drop.
    const { x, y } = STOMPER
    const kp = kickPose(age('kick'), this.step.kick)
    if (kp === 'hit') {
      if (rm) {
        drawSilhouette(c, SPRITES.stomperReady, x, y, p.actorMid, p.actorHi, { c: p.kick })
      } else {
        drawSprite(c, SPRITES.stomperHit, x, y, { '#': p.actorHi, C: p.kick })
        c.fillStyle = p.actorRim
        c.fillRect(x - 2, y + 11, 1, 1)
        c.fillRect(x - 1, y + 10, 1, 1)
        c.fillRect(x + 9, y + 10, 1, 1)
        c.fillRect(x + 10, y + 11, 1, 1)
      }
    } else if (kp === 'land') {
      if (rm) {
        drawSilhouette(c, SPRITES.stomperReady, x, y, p.actor, p.actorRim, { c: p.kick })
      } else {
        drawSilhouette(c, SPRITES.stomperLand, x, y, p.actorMid, p.actorHi, { c: p.kick })
        c.fillStyle = p.actor
        c.fillRect(x - 2, y + 11, 1, 1)
        c.fillRect(x + 10, y + 11, 1, 1)
      }
    } else if (o.awake('stomper', 0)) {
      drawSilhouette(c, SPRITES.stomperReady, x, y, p.actor, p.actorRim, { c: p.visorReady })
    } else {
      drawSilhouette(c, SPRITES.stomperIdle, x, y, p.actor, p.actorRim, { d: p.visorIdle })
    }
  }
}
