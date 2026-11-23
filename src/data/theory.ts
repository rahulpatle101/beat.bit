// Small music-theory helpers for the Remix engine (V3.4). Pitch classes are 0–11 (C = 0).

import type { Bar, KitId } from './kits'

/** Diatonic scale used when GENERATING notes (borrowed/chromatic colours stay composer-only). */
export const KIT_SCALE: Record<KitId, number[]> = {
  'neon-drive': [4, 6, 7, 9, 11, 1, 2], // E Dorian
  'pixel-quest': [0, 2, 4, 5, 7, 9, 11], // C major
  'night-shift': [5, 7, 8, 10, 0, 1, 3], // F natural minor
  'boss-rush': [2, 4, 5, 7, 9, 10, 1], // D harmonic minor
}

export const STRONG_STEPS = new Set([0, 4, 8, 12])
export const pc = (midi: number) => ((midi % 12) + 12) % 12

export const inScale = (midi: number, scale: number[]) => scale.includes(pc(midi))

/** Move `k` diatonic steps (k may be negative). Off-scale input is first snapped down. */
export function scaleStep(midi: number, k: number, scale: number[]): number {
  let m = snapToScale(midi, scale)
  const dir = Math.sign(k)
  for (let i = 0; i < Math.abs(k); i++) {
    m += dir
    while (!inScale(m, scale)) m += dir
  }
  return m
}

export function snapToScale(midi: number, scale: number[]): number {
  for (let d = 0; d < 12; d++) {
    if (inScale(midi - d, scale)) return midi - d
    if (inScale(midi + d, scale)) return midi + d
  }
  return midi
}

/** Nearest MIDI note whose pitch class is in `tones` (ties go down). */
export function nearestTone(midi: number, tones: Set<number>): number {
  for (let d = 0; d < 12; d++) {
    if (tones.has(pc(midi - d))) return midi - d
    if (tones.has(pc(midi + d))) return midi + d
  }
  return midi
}

export interface BarHarmony {
  /** Chord tones (pitch classes): every chord sounding in the bar + the bass root. */
  tones: Set<number>
  /** Root pitch class (the bar's first bass note, else the lowest chord note). */
  root: number
}

/**
 * Harmony per bar, derived from the COMPOSED bars (chords sounding in the bar, including long
 * chords carried over from earlier bars, plus the bass root). The progression is fixed: remixes
 * read harmony from the origin, never from a mutated composition.
 */
export function harmonyOf(bars: Bar[]): BarHarmony[] {
  return bars.map((bar, i) => {
    const tones = new Set<number>()
    bars.forEach((b, j) =>
      (b.chords ?? []).forEach((c) => {
        const start = j * 16 + c.step
        if (start < (i + 1) * 16 && start + c.len > i * 16) c.midis.forEach((m) => tones.add(pc(m)))
      }),
    )
    const bass = [...(bar.bass ?? [])].sort((a, b) => a.step - b.step)[0]
    const lowestChord = [...tones][0]
    const root = bass ? pc(bass.midi) : (lowestChord ?? 0)
    tones.add(root)
    return { tones, root }
  })
}
