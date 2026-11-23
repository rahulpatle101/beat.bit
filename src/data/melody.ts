// Constrained, seeded melody generator (V2_3_MELODY_PROPOSAL.md §4).
// - 6-note minor pentatonic per groove: no wrong notes are possible.
// - Phrase grammar A A′ B A″ over 4 beats; A″ always resolves to the root.
// - Density band and rhythmic bias per groove; avoids steps where kick and snare both hit.
// - Pure and deterministic: the same (groove, seed, drums) always gives the same melody.

import { mulberry32 } from '@/scene/geometry'
import { STEPS, type GrooveId, type Pattern } from './patterns'

/** Index into the 6-note scale: 0 = root … 5 = octave. */
export type Degree = 0 | 1 | 2 | 3 | 4 | 5
/** 16 steps; null = rest. */
export type Melody = (Degree | null)[]

/** Minor pentatonic + octave, in semitones above the root. */
export const SCALE = [0, 3, 5, 7, 10, 12] as const
export const DEGREE_NAMES: Record<GrooveId, readonly string[]> = {
  signal: ['A', 'C', 'D', 'E', 'G', 'A'],
  'boom-bap': ['D', 'F', 'G', 'A', 'C', 'D'],
  techno: ['F', 'A♭', 'B♭', 'C', 'E♭', 'F'],
  'boss-fight': ['E', 'G', 'A', 'B', 'D', 'E'],
}

interface Profile {
  /** MIDI note of the root (degree 0). */
  root: number
  /** Notes per bar, inclusive. */
  min: number
  max: number
  /** One-beat rhythm templates (16th positions 0–3 within a beat). */
  templates: number[][]
  /** Curated default seed for this groove. */
  seed: number
}

export const PROFILES: Record<GrooveId, Profile> = {
  // Mixed 8ths/16ths.
  signal: { root: 57, min: 6, max: 8, seed: 421, templates: [[0, 2], [0, 3], [0, 2, 3], [1, 3], [0, 1, 3]] },
  // Sparse, offbeat, laid back.
  'boom-bap': { root: 50, min: 4, max: 6, seed: 90, templates: [[0], [2], [3], [0, 3], [2, 3]] },
  // Offbeat 8ths between the four-on-the-floor kicks.
  techno: { root: 53, min: 6, max: 8, seed: 128, templates: [[2], [1, 3], [2, 3], [1, 2]] },
  // Driving 8ths, climbing.
  'boss-fight': { root: 52, min: 8, max: 11, seed: 150, templates: [[0, 2], [0, 1, 2, 3], [0, 2, 3], [0, 1, 3]] },
}

export function emptyMelody(): Melody {
  return Array(STEPS).fill(null)
}

/** MIDI note for a degree in a groove's key. */
export function midiFor(groove: GrooveId, degree: Degree): number {
  return PROFILES[groove].root + SCALE[degree]
}

const clampDeg = (d: number): Degree => Math.max(0, Math.min(5, Math.round(d))) as Degree
const isRoot = (d: Degree) => d === 0 || d === 5

/**
 * Generate a one-bar melody for `groove` from `seed`. `drums` (optional) is the current
 * drum pattern, used to keep notes off steps where kick and snare both hit.
 */
export function generateMelody(groove: GrooveId, seed: number, drums?: Pattern): Melody {
  const prof = PROFILES[groove]
  const rng = mulberry32(seed * 7919 + 13)
  // Seeded retries: each attempt is validated against the same rules the tests check.
  for (let attempt = 0; attempt < 40; attempt++) {
    const m = attemptMelody(prof, rng, drums)
    if (isValidMelody(m, prof)) return m
  }
  return fallbackMelody(prof)
}

/** The musical rules every generated melody must satisfy (also used by tests). */
export function isValidMelody(m: Melody, prof: Profile): boolean {
  const ns = m.flatMap((d) => (d === null ? [] : [d]))
  if (ns.length < prof.min || ns.length > prof.max) return false
  if (!isRoot(ns[ns.length - 1])) return false
  let leaps = 0
  for (let k = 1; k < ns.length; k++) {
    const a = ns[k - 1], b = ns[k]
    const octave = (a === 0 && b === 5) || (a === 5 && b === 0)
    if (!octave && Math.abs(b - a) > 3) return false
    leaps = Math.abs(b - a) >= 2 && !octave ? leaps + 1 : 0
    if (leaps > 2) return false
  }
  const rhythm = (beat: number) => [0, 1, 2, 3].filter((p) => m[beat * 4 + p] !== null).join()
  return rhythm(1) === rhythm(0) && rhythm(3) === rhythm(0)
}

/** Always-valid motif (root–3rd–5th–root shapes) used if every seeded attempt fails. */
function fallbackMelody(prof: Profile): Melody {
  const out = emptyMelody()
  const per = Math.max(1, Math.min(4, Math.round(prof.min / 4)))
  const shape: Degree[] = [0, 1, 3, 1]
  for (let beat = 0; beat < 4; beat++) for (let i = 0; i < per; i++) out[beat * 4 + i * Math.floor(4 / per)] = shape[(beat + i) % 4]
  const last = lastNoteIndex(out)
  out[last] = 0
  return out
}

function attemptMelody(prof: Profile, rng: () => number, drums?: Pattern): Melody {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rng() * a.length)]

  // 1. Rhythm: motif A on beats 1, 2, 4; contrasting B on beat 3; count inside the band.
  let a: number[] = prof.templates[0]
  let b: number[] = prof.templates[0]
  for (let tries = 0; tries < 60; tries++) {
    a = pick(prof.templates)
    b = pick(prof.templates)
    const n = 3 * a.length + b.length
    if (n >= prof.min && n <= prof.max && (b.join() !== a.join() || prof.templates.length === 1)) break
  }

  // 2. Pitches for motif A: start on root, 3rd, or 5th; mostly steps, occasional small leap.
  const motif: Degree[] = []
  let p: Degree = pick([0, 1, 3] as Degree[])
  for (let i = 0; i < a.length; i++) {
    if (i > 0) {
      const move = pick([-1, 1, 1, -2, 2, 3])
      p = clampDeg(p + move)
    }
    motif.push(p)
  }

  // A′: the same rhythm, pitches moved by ±1 degree, or a changed last note (the "call").
  const shift = pick([-1, 1])
  const motifA2: Degree[] =
    rng() < 0.5 ? motif.map((d) => clampDeg(d + shift)) : [...motif.slice(0, -1), clampDeg(motif[motif.length - 1] + shift * 2)]

  // B: contrast. Starts higher, mirrors A's contour.
  const bStart = clampDeg(motif[0] + pick([2, 3]))
  const motifB: Degree[] = []
  for (let i = 0; i < b.length; i++) {
    const ref = motif[Math.min(i, motif.length - 1)]
    motifB.push(clampDeg(bStart - (ref - motif[0])))
  }

  // A″: A's rhythm, ending on the root (nearest of degree 0 or 5).
  const motifA3: Degree[] = [...motif]

  // 3. Lay out the bar.
  const out = emptyMelody()
  const place = (beat: number, rhythm: number[], pitches: Degree[]) =>
    rhythm.forEach((pos, i) => (out[beat * 4 + pos] = pitches[i]))
  place(0, a, motif)
  place(1, a, motifA2)
  place(2, b, motifB)
  place(3, a, motifA3)

  // 4. Constraints, in order: intervals ≤ 3 degrees (octave allowed), ≤ 2 consecutive leaps,
  //    final note on the root.
  smooth(out)
  resolve(out)

  // 5. Leave room for the drums: drop notes on kick+snare steps while staying in the band.
  if (drums) {
    for (let s = 0; s < STEPS; s++) {
      const count = out.filter((d) => d !== null).length
      if (out[s] !== null && drums.kick[s] && drums.snare[s] && count > prof.min && s !== lastNoteIndex(out)) out[s] = null
    }
  }
  return out
}

function lastNoteIndex(m: Melody): number {
  for (let i = m.length - 1; i >= 0; i--) if (m[i] !== null) return i
  return -1
}

/** Enforce interval ≤ 3 degrees (except root↔octave) and at most 2 consecutive leaps (≥ 2). */
function smooth(m: Melody) {
  let prev: Degree | null = null
  let leaps = 0
  for (let i = 0; i < m.length; i++) {
    const d = m[i]
    if (d === null) continue
    let cur: Degree = d
    if (prev !== null) {
      const octave = (prev === 0 && cur === 5) || (prev === 5 && cur === 0)
      let diff: number = cur - prev
      if (!octave && Math.abs(diff) > 3) cur = clampDeg(prev + Math.sign(diff) * 3)
      diff = cur - prev
      const leap = Math.abs(diff) >= 2 && !octave
      leaps = leap ? leaps + 1 : 0
      if (leaps > 2) {
        cur = clampDeg(prev + Math.sign(diff))
        leaps = 0
      }
    }
    m[i] = cur
    prev = cur
  }
}

/** The last note resolves to the root (degree 0 or 5), whichever is closer to the previous note. */
function resolve(m: Melody) {
  const last = lastNoteIndex(m)
  if (last < 0) return
  let prev: Degree | null = null
  for (let i = last - 1; i >= 0; i--) if (m[i] !== null) {
    prev = m[i]
    break
  }
  if (prev === null) {
    m[last] = 0
    return
  }
  const target: Degree = Math.abs(prev - 0) <= Math.abs(prev - 5) ? 0 : 5
  // Keep the final interval within the 3-degree rule: step the previous note toward the root if needed.
  if (Math.abs(target - prev) > 3) {
    for (let i = last - 1; i >= 0; i--) if (m[i] !== null) {
      m[i] = clampDeg(target + Math.sign(prev - target) * 3)
      break
    }
  }
  m[last] = target
}

export { isRoot }
