// Musical constraint tests for the V3.4 Remix engine.
import { describe, expect, it } from 'vitest'
import { KITS, kitGrid } from './kits'
import { hamming, remix } from './remix'
import {
  BANDS,
  bandOf,
  chordsRemixable,
  cloneBars,
  drumOptions,
  melodyOf,
  originComposition,
  partRng,
  preserved,
  remixMusic,
  validateRemix,
  type Band,
  type Part,
} from './remixMusic'

const TEMPS = [0, 8, 16, 24, 30, 40, 50, 59, 62, 70, 78, 84, 86, 92, 100]
const SEEDS = 36 // 15 temps × 36 seeds = 540 variations per kit (+ chains below)
const ALL: Part[] = ['melody', 'bass', 'chords']

describe('Remix engine: musical constraints', () => {
  for (const kit of KITS) {
    const origin = originComposition(kit)
    const kick = kitGrid(kit).pattern.kick

    it(`${kit.name}: ${TEMPS.length * SEEDS} single rolls from the original are valid`, () => {
      const problems: string[] = []
      for (const t of TEMPS)
        for (let seed = 1; seed <= SEEDS; seed++) {
          const r = remixMusic({ kit, origin, current: origin, kick, seed: seed * 7919, temperature: t, parts: ALL })
          for (const p of validateRemix(kit, origin, r.bars, t, kick)) problems.push(`t=${t} seed=${seed}: ${p}`)
        }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it(`${kit.name}: chained rolls (10 chains × 12 rolls per band) stay valid and keep identity`, () => {
      const problems: string[] = []
      for (const t of [10, 40, 72, 95])
        for (let chain = 0; chain < 10; chain++) {
          let bars = origin
          for (let k = 0; k < 12; k++) {
            bars = remixMusic({ kit, origin, current: bars, kick, seed: chain * 1000 + k + 1, temperature: t, parts: ALL }).bars
            for (const p of validateRemix(kit, origin, bars, t, kick)) problems.push(`t=${t} chain=${chain} roll=${k}: ${p}`)
          }
        }
      expect(problems.slice(0, 10)).toEqual([])
    })

    it(`${kit.name}: deterministic, and unselected parts are untouched`, () => {
      const req = { kit, origin, current: origin, kick, seed: 4242, temperature: 70, parts: ALL }
      expect(remixMusic(req)).toEqual(remixMusic(req))
      const melodyOnly = remixMusic({ ...req, parts: ['melody'] }).bars
      expect(melodyOnly.map((b) => b.bass)).toEqual(origin.map((b) => b.bass))
      expect(melodyOnly.map((b) => b.chords)).toEqual(origin.map((b) => b.chords))
      const bassOnly = remixMusic({ ...req, parts: ['bass'] }).bars
      expect(bassOnly.map(melodyOf)).toEqual(origin.map(melodyOf))
      // Each part has its own random stream: adding bass doesn't change the melody result.
      expect(remixMusic({ ...req, parts: ['melody', 'bass'] }).bars.map(melodyOf)).toEqual(melodyOnly.map(melodyOf))
      // Inputs are never mutated.
      expect(origin).toEqual(originComposition(kit))
    })

    it(`${kit.name}: chords only change rhythm, and only when they are stabs`, () => {
      const r = remixMusic({ kit, origin, current: origin, kick, seed: 9, temperature: 95, parts: ['chords'] })
      if (!chordsRemixable(origin)) expect(r.bars).toEqual(cloneBars(origin))
      for (const [bi, b] of r.bars.entries()) {
        const voicings = new Set((origin[bi].chords ?? []).map((c) => c.midis.join('.')))
        for (const c of b.chords ?? []) expect(voicings.has(c.midis.join('.'))).toBe(true)
      }
    })
  }

  it('temperature measurably increases variation (not density)', () => {
    const stats: Record<Band, { change: number; density: number; n: number }> = {
      subtle: { change: 0, density: 0, n: 0 },
      groovy: { change: 0, density: 0, n: 0 },
      wild: { change: 0, density: 0, n: 0 },
      chaos: { change: 0, density: 0, n: 0 },
    }
    for (const kit of KITS) {
      const origin = originComposition(kit)
      const kick = kitGrid(kit).pattern.kick
      const om = origin.map(melodyOf)
      const ob = origin.map((b) => b.bass ?? [])
      for (const t of TEMPS)
        for (let seed = 1; seed <= 30; seed++) {
          const r = remixMusic({ kit, origin, current: origin, kick, seed, temperature: t, parts: ['melody', 'bass'] })
          const s = stats[bandOf(t)]
          s.change += 1 - (preserved(om, r.bars.map(melodyOf)) + preserved(ob, r.bars.map((b) => b.bass ?? []))) / 2
          s.density += (r.bars.flatMap(melodyOf).length + r.bars.flatMap((b) => b.bass ?? []).length) / (om.flat().length + ob.flat().length)
          s.n++
        }
    }
    const mean = (b: Band) => ({ change: stats[b].change / stats[b].n, density: stats[b].density / stats[b].n })
    const m = { subtle: mean('subtle'), groovy: mean('groovy'), wild: mean('wild'), chaos: mean('chaos') }
    console.log('variation by band', JSON.stringify(m))
    expect(m.subtle.change).toBeLessThan(m.groovy.change)
    expect(m.groovy.change).toBeLessThan(m.wild.change)
    expect(m.wild.change).toBeLessThan(m.chaos.change)
    expect(m.subtle.change).toBeLessThan(0.2)
    expect(m.chaos.change).toBeGreaterThan(0.3)
    // Chaos is not "more notes": average density stays within ±15 % of the original.
    for (const b of Object.values(m)) expect(Math.abs(b.density - 1)).toBeLessThan(0.15)
  })

  it('identity floors are ordered subtle > groovy > wild > chaos', () => {
    expect(BANDS.subtle.floor).toBeGreaterThan(BANDS.groovy.floor)
    expect(BANDS.groovy.floor).toBeGreaterThan(BANDS.wild.floor)
    expect(BANDS.wild.floor).toBeGreaterThanOrEqual(BANDS.chaos.floor)
  })

  it('drum remix follows the temperature options (changes and drift)', () => {
    for (const kit of KITS) {
      const g = kitGrid(kit).pattern
      for (const t of [10, 40, 72, 95]) {
        const o = drumOptions(t)
        let p = g
        for (let k = 0; k < 20; k++) {
          const r = remix(p, g, partRng(k + 1, 'drums'), o)
          expect(r.changes.length).toBeLessThanOrEqual(o.max)
          p = r.pattern
          expect(hamming(p, g)).toBeLessThanOrEqual(o.drift)
        }
      }
    }
  })
})
