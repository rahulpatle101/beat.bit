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

// ---------- Curated grooves (V2.2) ----------

/** City mood: a subtle sky tint per groove (ART_DIRECTION V2.2 addendum). */
export type MoodId = 'night' | 'warm' | 'teal' | 'red'

export type GrooveId = 'signal' | 'boom-bap' | 'techno' | 'boss-fight'

export interface Groove {
  id: GrooveId
  name: string
  bpm: number
  mood: MoodId
  pattern: Pattern
}

export const GROOVES: readonly Groove[] = [
  { id: 'signal', name: 'SIGNAL', bpm: SIGNAL.bpm, mood: 'night', pattern: SIGNAL.pattern },
  {
    // Laid-back head-nod: kick on 1 and the push into beat 3, backbeat snare, hats with a late pickup.
    id: 'boom-bap',
    name: 'BOOM BAP',
    bpm: 90,
    mood: 'warm',
    pattern: {
      kick: row(1, 7, 11),
      snare: row(5, 13),
      hat: row(1, 3, 5, 7, 9, 11, 13, 15, 16),
      clap: row(13),
    },
  },
  {
    // Four on the floor, offbeat hats, clap on 2 and 4, a snare pickup into the loop.
    id: 'techno',
    name: 'TECHNO',
    bpm: 128,
    mood: 'teal',
    pattern: {
      kick: row(1, 5, 9, 13),
      snare: row(16),
      hat: row(3, 7, 11, 15),
      clap: row(5, 13),
    },
  },
  {
    // Driving 16th hats, galloping double kicks, a doubled snare hit before the turnaround.
    id: 'boss-fight',
    name: 'BOSS FIGHT',
    bpm: 150,
    mood: 'red',
    pattern: {
      kick: row(1, 3, 7, 9, 11, 15),
      snare: row(5, 13, 14),
      hat: row(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
      clap: row(5, 13),
    },
  },
]

export function grooveById(id: GrooveId): Groove {
  return GROOVES.find((g) => g.id === id) ?? GROOVES[0]
}

export function samePattern(a: Pattern, b: Pattern): boolean {
  return TRACK_IDS.every((t) => a[t].every((on, i) => on === b[t][i]))
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
