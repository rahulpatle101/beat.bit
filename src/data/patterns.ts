// Sequence data. Kept free of audio and rendering concerns.

export const STEPS = 16

export type TrackId = 'kick' | 'snare' | 'hat' | 'clap'

export interface TrackInfo {
  id: TrackId
  name: string
}

export const TRACKS: readonly TrackInfo[] = [
  { id: 'kick', name: 'Kick' },
  { id: 'snare', name: 'Snare' },
  { id: 'hat', name: 'Hi-hat' },
  { id: 'clap', name: 'Clap' },
]

export const TRACK_IDS: readonly TrackId[] = TRACKS.map((t) => t.id)

export type Pattern = Record<TrackId, boolean[]>

export const BPM_MIN = 60
export const BPM_MAX = 180
export const BPM_DEFAULT = 104

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return BPM_DEFAULT
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
}

export function emptyPattern(): Pattern {
  return {
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hat: Array(STEPS).fill(false),
    clap: Array(STEPS).fill(false),
  }
}

/** Build a row from 1-indexed step numbers (musician-friendly). */
function row(...steps: number[]): boolean[] {
  const r = Array(STEPS).fill(false)
  for (const s of steps) r[s - 1] = true
  return r
}

/** Starter groove "SIGNAL" (DESIGN.md §5.2). */
export const SIGNAL: { pattern: Pattern; bpm: number } = {
  bpm: 104,
  pattern: {
    kick: row(1, 7, 9, 14),
    snare: row(5, 13),
    hat: row(1, 3, 5, 7, 9, 11, 13, 15, 16),
    clap: row(13, 16),
  },
}

export function clonePattern(p: Pattern): Pattern {
  return {
    kick: [...p.kick],
    snare: [...p.snare],
    hat: [...p.hat],
    clap: [...p.clap],
  }
}

export function isEmpty(p: Pattern): boolean {
  return TRACK_IDS.every((id) => p[id].every((on) => !on))
}
