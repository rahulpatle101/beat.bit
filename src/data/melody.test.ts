import { describe, expect, it } from 'vitest'
import { LEAD, leadEnvelope, midiToHz, pulseCoefficients } from '@/audio/lead'
import { GROOVES, emptyPattern } from './patterns'
import { PROFILES, SCALE, generateMelody, midiFor, type Melody } from './melody'

const notes = (m: Melody) => m.flatMap((d, i) => (d === null ? [] : [{ i, d }]))
const beatRhythm = (m: Melody, beat: number) =>
  [0, 1, 2, 3].filter((p) => m[beat * 4 + p] !== null).join(',')

describe('melody generator (V2.3)', () => {
  for (const g of GROOVES) {
    it(`${g.name}: 500 seeds satisfy every musical constraint`, () => {
      const prof = PROFILES[g.id]
      for (let seed = 1; seed <= 500; seed++) {
        const m = generateMelody(g.id, seed, g.pattern)
        const ns = notes(m)
        expect(m).toHaveLength(16)
        // In scale (degrees 0–5 only).
        for (const { d } of ns) {
          expect(d).toBeGreaterThanOrEqual(0)
          expect(d).toBeLessThanOrEqual(5)
        }
        // Density band.
        expect(ns.length).toBeGreaterThanOrEqual(prof.min)
        expect(ns.length).toBeLessThanOrEqual(prof.max)
        // Intervals ≤ 3 degrees except root↔octave; ≤ 2 consecutive leaps.
        let leaps = 0
        for (let k = 1; k < ns.length; k++) {
          const a = ns[k - 1].d!, b = ns[k].d!
          const octave = (a === 0 && b === 5) || (a === 5 && b === 0)
          if (!octave) expect(Math.abs(b - a), `seed ${seed}`).toBeLessThanOrEqual(3)
          leaps = Math.abs(b - a) >= 2 && !octave ? leaps + 1 : 0
          expect(leaps, `seed ${seed}`).toBeLessThanOrEqual(2)
        }
        // Resolves: the last note is the root or its octave.
        expect([0, 5]).toContain(ns[ns.length - 1].d)
        // A / A′ / A″ share a rhythm (beats 1, 2, 4).
        expect(beatRhythm(m, 1)).toBe(beatRhythm(m, 0))
        expect(beatRhythm(m, 3)).toBe(beatRhythm(m, 0))
      }
    })
  }

  it('is deterministic and varies across seeds', () => {
    for (const g of GROOVES) {
      expect(generateMelody(g.id, 42, g.pattern)).toEqual(generateMelody(g.id, 42, g.pattern))
      const distinct = new Set(Array.from({ length: 50 }, (_, s) => JSON.stringify(generateMelody(g.id, s + 1, g.pattern))))
      expect(distinct.size).toBeGreaterThan(25)
    }
  })

  it('leaves room on steps where kick and snare both hit (while staying in the band)', () => {
    const drums = emptyPattern()
    for (let s = 0; s < 16; s += 2) drums.kick[s] = drums.snare[s] = true // collisions on every 8th
    for (let seed = 1; seed <= 200; seed++) {
      const m = generateMelody('boss-fight', seed, drums)
      const ns = notes(m)
      const collisions = ns.filter(({ i }) => drums.kick[i] && drums.snare[i] && i !== ns[ns.length - 1].i)
      // Either no collisions remain, or the band minimum stopped further drops.
      expect(collisions.length === 0 || ns.length === PROFILES['boss-fight'].min).toBe(true)
    }
  })

  it('curated presets have no kick+snare collisions, so default melodies keep their full rhythm', () => {
    for (const g of GROOVES) for (let s = 0; s < 16; s++) expect(g.pattern.kick[s] && g.pattern.snare[s]).toBe(false)
  })

  it('maps degrees to the groove key (minor pentatonic)', () => {
    expect(SCALE).toEqual([0, 3, 5, 7, 10, 12])
    expect(midiFor('signal', 0)).toBe(57) // A3
    expect(midiFor('boom-bap', 5)).toBe(62) // D4
    expect(midiFor('techno', 3)).toBe(60) // C4
    expect(midiFor('boss-fight', 4)).toBe(62) // D4
  })
})

describe('BIT LEAD synth (V2.3)', () => {
  it('pulse coefficients follow the 25% duty Fourier series', () => {
    const { real, imag } = pulseCoefficients(0.25, 8)
    expect(real[0]).toBe(0)
    expect(real[1]).toBeCloseTo((2 / Math.PI) * Math.sin(Math.PI / 4), 6)
    expect(real[4]).toBeCloseTo(0, 6) // every 4th harmonic vanishes at 25% duty
    expect([...imag].every((v) => v === 0)).toBe(true)
  })

  it('envelope is ordered, short and ends within the step at every tempo', () => {
    for (const bpm of [60, 104, 150, 180]) {
      const step = 60 / bpm / 4
      const e = leadEnvelope(10, step)
      expect(e.peakAt).toBeGreaterThan(10)
      expect(e.sustainAt).toBeGreaterThanOrEqual(e.peakAt)
      expect(e.releaseAt).toBeGreaterThanOrEqual(e.sustainAt)
      expect(e.endAt - 10).toBeCloseTo(step * LEAD.gate + LEAD.release, 6)
      // Monophonic: the note has fully released before the next step's note (+ release overlap ≤ 40 ms).
      expect(e.endAt - (10 + step)).toBeLessThanOrEqual(LEAD.release)
    }
  })

  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(57)).toBeCloseTo(220, 6)
  })
})
