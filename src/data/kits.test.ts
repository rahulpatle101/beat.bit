// Music-theory lint for the composed kits (catches composition typos objectively).
import { describe, expect, it } from 'vitest'
import { KITS, arrangement, barPattern, kitById, kitGrid, section, type Note } from './kits'

const SCALES: Record<string, number[]> = {
  // E Dorian + borrowed C (bVI) used in the variation.
  'neon-drive': [4, 6, 7, 9, 11, 1, 2, 0],
  // C major.
  'pixel-quest': [0, 2, 4, 5, 7, 9, 11],
  // F natural minor.
  'night-shift': [5, 7, 8, 10, 0, 1, 3],
  // D natural + harmonic minor (C and C#) + deliberate bII colour (Eb) in the build.
  'boss-rush': [2, 4, 5, 7, 9, 10, 0, 1, 3],
}
const STRONG = new Set([0, 4, 8, 12])

function lint(notes: Note[], scale: number[]) {
  const problems: string[] = []
  notes.forEach((n, i) => {
    const inKey = scale.includes(((n.midi % 12) + 12) % 12)
    if (inKey) return
    if (STRONG.has(n.step)) problems.push(`out-of-key on strong step ${n.step} (midi ${n.midi})`)
    const next = notes[i + 1]
    if (!next || Math.abs(next.midi - n.midi) !== 1)
      problems.push(`chromatic note ${n.midi} at step ${n.step} doesn't resolve by a semitone (next: ${next?.midi ?? 'none'})`)
  })
  return problems
}

describe('composed kits: music-theory lint', () => {
  for (const kit of KITS) {
    it(`${kit.name}: melodic parts stay in key (chromatic notes only as semitone approaches)`, () => {
      const scale = SCALES[kit.id]
      const problems: string[] = []
      // Lint each part as one continuous line through the whole piece, so approach notes can
      // resolve across barlines and section boundaries.
      for (const part of ['bass', 'lead', 'lead2'] as const) {
        const notes = kit.sections.flatMap((s) => s.bars.flatMap((b) => b[part] ?? []))
        for (const p of lint(notes, scale)) problems.push(`${part}: ${p}`)
      }
      expect(problems).toEqual([])
    })

    it(`${kit.name}: structure is intro / main / variation / drop / end, 15 bars, in range`, () => {
      expect(kit.sections.map((s) => s.name)).toEqual(['intro', 'main', 'variation', 'drop', 'end'])
      expect(kit.sections.reduce((n, s) => n + s.bars.length, 0)).toBe(15)
      for (const s of kit.sections)
        for (const b of s.bars) {
          for (const part of ['bass', 'lead', 'lead2'] as const)
            for (const n of b[part] ?? []) {
              expect(n.step).toBeGreaterThanOrEqual(0)
              expect(n.step).toBeLessThan(16)
              expect(n.midi).toBeGreaterThanOrEqual(28) // E1
              expect(n.midi).toBeLessThanOrEqual(86) // D6
            }
          for (const pat of Object.values(b.drums)) expect(pat === undefined || pat.length === 0 || pat.length === 16).toBe(true)
        }
    })
  }
})

describe('kit helpers (V3.0 slice)', () => {
  it('kitGrid = the main section first bar of the four grid drums, with composed accents', () => {
    const k = kitById('neon-drive')
    const { pattern, accents } = kitGrid(k)
    expect(pattern.kick.map(Number).join('')).toBe('1000000100100000') // 'x......o..x.....'
    expect(accents.kick[7]).toBe(0.65)
    expect(accents.snare[7]).toBe(0.35) // ghost note
    expect(pattern.clap[12]).toBe(true)
  })
  it('arrangement is intro → end (15 bars); barPattern mutes chosen tracks', () => {
    const k = kitById('pixel-quest')
    expect(arrangement(k)).toHaveLength(15)
    const p = barPattern(section(k, 'main')[0], new Set(['kick']))
    expect(p.kick.some(Boolean)).toBe(false)
    expect(p.snare[4]).toBe(true)
  })
})

