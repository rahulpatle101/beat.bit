import { describe, expect, it } from 'vitest'
import {
  AMBIENT_WINDOWS,
  APARTMENTS,
  APARTMENT_WINDOWS,
  BIRD_X,
  BUILDINGS,
  CROWD_X,
  H,
  ROOF,
  STOMPER,
  TOWER,
  W,
  WINDOWS,
  WIRE,
  wireY,
} from './geometry'
import { TIMING, clapPose, hatHop, kickPose, snarePose } from './performers'
import { SPRITES } from './sprites'

const S104 = 60000 / 104 / 4 // 144.23 ms
const S180 = 60000 / 180 / 4 // 83.33 ms
const r = (n: number) => Math.round(n)

describe('motion personalities: timing table (ART_DIRECTION V2.1)', () => {
  it('kick: heavy — long hold, then land', () => {
    expect([r(TIMING.kick(S104).hit), r(TIMING.kick(S104).land)]).toEqual([94, 43])
    expect([r(TIMING.kick(S180).hit), r(TIMING.kick(S180).land)]).toEqual([54, 25])
    expect(kickPose(0, S104)).toBe('hit')
    expect(kickPose(90, S104)).toBe('hit')
    expect(kickPose(120, S104)).toBe('land')
    expect(kickPose(140, S104)).toBe('ready')
    expect(kickPose(-1, S104)).toBe('ready')
  })

  it('snare: sharp — short cheer, light fades 100/60/30% over 3 steps', () => {
    expect(r(TIMING.snare(S104).cheer)).toBe(58)
    expect(r(TIMING.snare(S180).cheer)).toBe(33)
    expect(snarePose(10, S104)).toEqual({ cheer: true, level: 1 })
    expect(snarePose(80, S104)).toEqual({ cheer: false, level: 1 })
    expect(snarePose(200, S104)?.level).toBe(0.6)
    expect(snarePose(300, S104)?.level).toBe(0.3)
    expect(snarePose(3 * S104 + 1, S104)).toBeNull()
  })

  it('hi-hat: quick — the shortest pose in the scene', () => {
    expect(TIMING.hat(S104).hop).toBe(50)
    expect(r(TIMING.hat(S180).hop)).toBe(29)
    expect(hatHop(0, S104)).toBe(true)
    expect(hatHop(49, S104)).toBe(true)
    expect(hatHop(51, S104)).toBe(false)
    // Shorter than every other performer's primary pose at both tempos.
    for (const s of [S104, S180]) {
      expect(TIMING.hat(s).hop).toBeLessThan(TIMING.kick(s).hit)
      expect(TIMING.hat(s).hop).toBeLessThanOrEqual(TIMING.clap(s).hold)
    }
  })

  it('clap: restrained — half → full → half → ready, odd figures staggered', () => {
    const seq = [0, 30, 60, 120, 150, 200].map((t) => clapPose(t, S104, 0))
    expect(seq).toEqual(['half', 'half', 'full', 'full', 'half', 'ready'])
    expect(clapPose(10, S104, 1)).toBe('ready') // stagger: figure 2 starts ~36 ms later
    expect(clapPose(40, S104, 1)).toBe('half')
    expect(r(TIMING.clap(S104).stagger)).toBe(36)
  })

  it('every pose resolves within a few steps at 60, 104 and 180 BPM (no stuck poses)', () => {
    for (const bpm of [60, 104, 180]) {
      const s = 60000 / bpm / 4
      expect(kickPose(s, s)).toBe('ready')
      expect(hatHop(s, s)).toBe(false)
      expect(clapPose(2 * s, s, 1)).toBe('ready')
      expect(snarePose(3 * s, s)).toBeNull()
    }
  })
})

describe('composition: approved V2.1 coordinates', () => {
  it('performers sit where the approved preview placed them', () => {
    expect(STOMPER).toEqual({ x: 19, y: 32 })
    expect(CROWD_X).toEqual([47, 52, 57, 62])
    expect(ROOF).toBe(14)
    expect(BIRD_X).toEqual([120, 125, 130, 134])
    expect(WIRE).toEqual({ x0: 117, y0: 17, x1: 138, y1: 19, sag: 3 })
    expect(APARTMENTS).toEqual([{ x: 16, y: 22 }, { x: 94, y: 26 }, { x: 149, y: 21 }])
  })

  it('the Stomper stands on the street and stays inside the canvas', () => {
    expect(STOMPER.y + SPRITES.stomperReady.length - 1).toBe(43)
    expect(STOMPER.x - 2).toBeGreaterThanOrEqual(0) // dust pixels
    expect(STOMPER.x + 10).toBeLessThan(W)
  })

  it('the crowd stays on building 4 and clear of the antenna', () => {
    const [bx, bw] = BUILDINGS[3]
    for (const x of CROWD_X) {
      expect(x).toBeGreaterThanOrEqual(bx)
      expect(x + 3).toBeLessThan(bx + bw)
    }
    expect(ROOF - SPRITES.crowdFull.length).toBeGreaterThanOrEqual(0)
  })

  it('birds sit on the wire inside the canvas', () => {
    for (const x of BIRD_X) {
      expect(x).toBeGreaterThanOrEqual(WIRE.x0)
      expect(x + 3).toBeLessThanOrEqual(WIRE.x1)
      expect(wireY(x + 1) - 4).toBeGreaterThanOrEqual(0)
    }
    expect(wireY(WIRE.x0)).toBe(WIRE.y0)
    expect(wireY(WIRE.x1)).toBe(WIRE.y1)
  })

  it('apartment windows each merge exactly four V1 windows; ambient windows avoid tower and apartments', () => {
    expect(APARTMENT_WINDOWS.size).toBe(12)
    expect(AMBIENT_WINDOWS).toHaveLength(8)
    const [tx, tw] = BUILDINGS[TOWER]
    for (const i of AMBIENT_WINDOWS) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(APARTMENT_WINDOWS.has(i)).toBe(false)
      const [x, y] = WINDOWS[i]
      expect(x < tx || x >= tx + tw).toBe(true)
      expect(y).toBeLessThan(H)
    }
  })

  it('sprites are rectangular (equal-length rows)', () => {
    for (const [name, rows] of Object.entries(SPRITES)) {
      expect(new Set(rows.map((row) => row.length)).size, name).toBe(1)
    }
  })
})
