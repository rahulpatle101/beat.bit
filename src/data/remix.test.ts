import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/scene/geometry'
import { GROOVES, STEPS, TRACK_IDS, emptyPattern, samePattern, type Pattern } from './patterns'
import { MAX_CHANGES, MAX_DRIFT, MIN_CHANGES, hamming, remix } from './remix'

const AUDIBLE = ['kick', 'snare', 'clap']
const anchors = (p: Pattern) =>
  (['kick', 'snare'] as const).flatMap((t) => [0, 4, 8, 12].filter((s) => p[t][s]).map((s) => `${t}:${s}`))
const count = (p: Pattern, t: keyof Pattern) => p[t].filter(Boolean).length

describe('Remix Dice', () => {
  it('every roll: 2–4 changes, at least one audible, result differs, changes match the diff', () => {
    for (const g of GROOVES) {
      for (let seed = 1; seed <= 500; seed++) {
        const { pattern, changes } = remix(g.pattern, g.pattern, mulberry32(seed))
        expect(changes.length).toBeGreaterThanOrEqual(MIN_CHANGES)
        expect(changes.length).toBeLessThanOrEqual(MAX_CHANGES)
        expect(changes.some((c) => AUDIBLE.includes(c.track))).toBe(true)
        expect(samePattern(pattern, g.pattern)).toBe(false)
        expect(hamming(pattern, g.pattern)).toBe(changes.length) // no cell toggled twice
        for (const c of changes) expect(pattern[c.track][c.step]).toBe(c.on)
      }
    }
  })

  it('never touches the input pattern (pure)', () => {
    const g = GROOVES[0]
    const before = JSON.stringify(g.pattern)
    remix(g.pattern, g.pattern, mulberry32(7))
    expect(JSON.stringify(g.pattern)).toBe(before)
  })

  it('is deterministic for a given seed', () => {
    const g = GROOVES[1]
    expect(remix(g.pattern, g.pattern, mulberry32(42))).toEqual(remix(g.pattern, g.pattern, mulberry32(42)))
  })

  it('repeated rolls keep identity: anchors stay, drift ≤ 8, density capped, no track emptied', () => {
    for (const g of GROOVES) {
      for (let seed = 1; seed <= 60; seed++) {
        const rng = mulberry32(seed * 977)
        let p = g.pattern
        for (let roll = 0; roll < 40; roll++) {
          const r = remix(p, g.pattern, rng)
          expect(r.changes.length).toBeGreaterThanOrEqual(MIN_CHANGES)
          expect(r.changes.length).toBeLessThanOrEqual(MAX_CHANGES)
          p = r.pattern
          expect(anchors(p)).toEqual(expect.arrayContaining(anchors(g.pattern)))
          expect(hamming(p, g.pattern)).toBeLessThanOrEqual(MAX_DRIFT)
          expect(count(p, 'kick')).toBeLessThanOrEqual(Math.max(6, count(g.pattern, 'kick')))
          expect(count(p, 'snare')).toBeLessThanOrEqual(Math.max(4, count(g.pattern, 'snare')))
          expect(count(p, 'clap')).toBeLessThanOrEqual(Math.max(4, count(g.pattern, 'clap')))
          for (const t of TRACK_IDS) if (count(g.pattern, t) > 0) expect(count(p, t), `${g.id} seed ${seed} roll ${roll} ${t} changes ${JSON.stringify(r.changes)}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('rolling an empty pattern gives a simple backbone', () => {
    const { pattern, changes } = remix(emptyPattern(), emptyPattern(), mulberry32(1))
    expect(pattern.kick[0] && pattern.snare[4] && pattern.snare[12]).toBe(true)
    expect(changes.length).toBe(TRACK_IDS.reduce((n, t) => n + count(pattern, t), 0))
  })

  it('curated grooves are distinct, valid 16-step patterns', () => {
    expect(new Set(GROOVES.map((g) => g.bpm)).size).toBe(GROOVES.length)
    expect(GROOVES.map((g) => g.name)).toEqual(['SIGNAL', 'BOOM BAP', 'TECHNO', 'BOSS FIGHT'])
    for (const g of GROOVES) {
      for (const t of TRACK_IDS) expect(g.pattern[t]).toHaveLength(STEPS)
      expect(g.bpm).toBeGreaterThanOrEqual(60)
      expect(g.bpm).toBeLessThanOrEqual(180)
    }
  })
})
