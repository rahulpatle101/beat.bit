// Arcade core (GAME_DESIGN.md §3–§5): challenge charts, judging, scoring with anti-spam
// safeguards, and progression. Pure functions only; no audio, no DOM.

import { arrangement, kitById, type Bar, type KitId } from './kits'
import type { TrackId } from './patterns'

// ---------- Challenges ----------

export type Pad = 'kick' | 'snare'
export interface Cue {
  id: number
  bar: number
  step: number
  pad: Pad
  /** Audio-clock time (s), filled in once the arrangement starts. */
  time: number
}
export interface Challenge {
  id: 'wake-the-city'
  name: string
  kitId: KitId
  bars: Bar[]
  pads: { pad: Pad; key: string; label: string }[]
  /** First N cues of a first attempt get a "NOW" hint. */
  hinted: number
  cues: Omit<Cue, 'time'>[]
}

/**
 * The player plays the kit's accented ('x') kick and snare on 8th-note positions (snare only
 * after the intro). Everything else, including softer and 16th-note hits, stays in the backing,
 * so the groove remains intact.
 */
export function chartFor(bars: Bar[]): Omit<Cue, 'time'>[] {
  const out: Omit<Cue, 'time'>[] = []
  bars.forEach((bar, b) => {
    const intro = b < 2
    for (let step = 0; step < 16; step += 2) {
      for (const pad of ['kick', 'snare'] as const) {
        if (intro && pad === 'snare') continue
        if (bar.drums[pad]?.[step] === 'x') out.push({ id: out.length, bar: b, step, pad })
      }
    }
  })
  return out
}

export function wakeTheCity(): Challenge {
  const bars = arrangement(kitById('neon-drive'))
  return {
    id: 'wake-the-city',
    name: 'WAKE THE CITY',
    kitId: 'neon-drive',
    bars,
    pads: [
      { pad: 'kick', key: 'f', label: 'KICK' },
      { pad: 'snare', key: 'j', label: 'SNARE' },
    ],
    hinted: 4,
    cues: chartFor(bars),
  }
}

/** Grid steps the player performs (muted from the backing). */
export function playerSteps(c: Challenge): Set<string> {
  return new Set(c.cues.map((q) => `${q.bar}:${q.pad}:${q.step}`))
}
export const isPlayerStep = (set: Set<string>, bar: number, track: TrackId, step: number) => set.has(`${bar}:${track}:${step}`)

// ---------- Judging ----------

export type Judgement = 'perfect' | 'great' | 'good'
export interface Windows {
  perfect: number
  great: number
  good: number
}
/** Seconds. Normal: ±35 / ±70 / ±110 ms. Assist doubles every window. */
export const NORMAL: Windows = { perfect: 0.035, great: 0.07, good: 0.11 }
export const ASSIST: Windows = { perfect: 0.07, great: 0.14, good: 0.22 }

export function judge(offsetSec: number, w: Windows): Judgement | null {
  const a = Math.abs(offsetSec)
  if (a <= w.perfect) return 'perfect'
  if (a <= w.great) return 'great'
  if (a <= w.good) return 'good'
  return null
}

// ---------- Scoring ----------

export const POINTS: Record<Judgement, number> = { perfect: 100, great: 70, good: 40 }
export const WEIGHT: Record<Judgement, number> = { perfect: 1, great: 0.7, good: 0.4 }
export const STRAY_PENALTY = 10
export const DEBOUNCE = 0.04
export const multiplier = (combo: number) => (combo >= 32 ? 4 : combo >= 16 ? 3 : combo >= 8 ? 2 : 1)

export interface RunState {
  cues: Cue[]
  judged: Map<number, Judgement | 'miss'>
  score: number
  combo: number
  maxCombo: number
  counts: Record<Judgement | 'miss' | 'stray', number>
  lastPress: Partial<Record<Pad, number>>
  /** Bars with a miss or stray (for "light every district"). */
  dirtyBars: Set<number>
}

export function newRun(cues: Cue[]): RunState {
  return {
    cues,
    judged: new Map(),
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0, stray: 0 },
    lastPress: {},
    dirtyBars: new Set(),
  }
}

export type PressResult =
  | { kind: 'hit'; judgement: Judgement; cue: Cue; offset: number; points: number }
  | { kind: 'stray' }
  | { kind: 'ignored' }

/** A pad press heard at `time` (audio clock). Mutates and returns the result. */
export function press(s: RunState, pad: Pad, time: number, w: Windows): PressResult {
  // Debounce: key repeat / switch bounce counts once.
  const last = s.lastPress[pad]
  if (last !== undefined && time - last < DEBOUNCE) return { kind: 'ignored' }
  s.lastPress[pad] = time
  // One press per cue: the earliest open cue on this pad within the GOOD window.
  let best: Cue | null = null
  for (const c of s.cues) {
    if (c.pad !== pad || s.judged.has(c.id)) continue
    if (Math.abs(time - c.time) <= w.good && (!best || Math.abs(time - c.time) < Math.abs(time - best.time))) best = c
  }
  if (!best) {
    s.counts.stray++
    s.score = Math.max(0, s.score - STRAY_PENALTY)
    s.combo = 0
    const bar = nearestBar(s.cues, time)
    if (bar !== null) s.dirtyBars.add(bar)
    return { kind: 'stray' }
  }
  const j = judge(time - best.time, w)!
  s.judged.set(best.id, j)
  s.counts[j]++
  s.combo++
  s.maxCombo = Math.max(s.maxCombo, s.combo)
  const points = POINTS[j] * multiplier(s.combo)
  s.score += points
  return { kind: 'hit', judgement: j, cue: best, offset: time - best.time, points }
}

/** Mark every cue whose window has fully passed as a MISS. Returns the newly missed cues. */
export function sweep(s: RunState, heardNow: number, w: Windows): Cue[] {
  const missed: Cue[] = []
  for (const c of s.cues) {
    if (s.judged.has(c.id) || !(c.time > 0) || heardNow <= c.time + w.good) continue
    s.judged.set(c.id, 'miss')
    s.counts.miss++
    s.combo = 0
    s.dirtyBars.add(c.bar)
    missed.push(c)
  }
  return missed
}

function nearestBar(cues: Cue[], time: number): number | null {
  let best: Cue | null = null
  for (const c of cues) if (c.time > 0 && (!best || Math.abs(c.time - time) < Math.abs(best.time - time))) best = c
  return best ? best.bar : null
}

/** Accuracy = Σ weights / (cues + strays): mashing inflates the denominator. */
export function accuracy(s: RunState): number {
  let w = 0
  for (const j of s.judged.values()) if (j !== 'miss') w += WEIGHT[j]
  return s.cues.length + s.counts.stray === 0 ? 0 : w / (s.cues.length + s.counts.stray)
}

/** Live accuracy for the HUD: only cues judged so far (+ strays). The final result uses accuracy(). */
export function liveAccuracy(s: RunState): number {
  let w = 0
  for (const j of s.judged.values()) if (j !== 'miss') w += WEIGHT[j]
  const denom = s.judged.size + s.counts.stray
  return denom === 0 ? 1 : w / denom
}

export function stars(acc: number): 0 | 1 | 2 | 3 {
  return acc >= 0.9 ? 3 : acc >= 0.75 ? 2 : acc >= 0.6 ? 1 : 0
}

/** Upper bound of a run's score (every cue PERFECT at the best reachable multiplier). */
export function maxScore(cueCount: number): number {
  let total = 0
  for (let c = 1; c <= cueCount; c++) total += POINTS.perfect * multiplier(c)
  return total
}

// ---------- Progression ----------

export const RANKS = [
  { name: 'ROOKIE', xp: 0 },
  { name: 'BEATMAKER', xp: 300 },
  { name: 'GROOVE PILOT', xp: 900 },
  { name: 'NIGHT HERO', xp: 2000 },
  { name: 'CITY LEGEND', xp: 4000 },
] as const

export function rankFor(xp: number) {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++
  const cur = RANKS[i]
  const next = RANKS[i + 1] ?? null
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1
  return { index: i, name: cur.name, next: next?.name ?? null, toNext: next ? next.xp - xp : 0, progress }
}

/** XP for a finished run: full XP only for a new best star tier, otherwise 20% (anti-farming). */
export function xpAward(runStars: 0 | 1 | 2 | 3, bestStars: number): number {
  const base = [0, 100, 150, 200][runStars]
  return runStars > bestStars ? base : Math.round(base * 0.2)
}

export interface Progress {
  v: 1
  xp: number
  best: Partial<Record<Challenge['id'], { stars: number; score: number; accuracy: number }>>
  assist: boolean
}

const KEY = 'beatbit.progress.v1'
export function loadProgress(storage: Pick<Storage, 'getItem'> | null = globalThis.localStorage ?? null): Progress {
  try {
    const p = JSON.parse(storage?.getItem(KEY) ?? '') as Progress
    if (p && p.v === 1 && typeof p.xp === 'number') return { ...p, best: p.best ?? {}, assist: !!p.assist }
  } catch {
    // fall through to a fresh profile
  }
  return { v: 1, xp: 0, best: {}, assist: false }
}
export function saveProgress(p: Progress, storage: Pick<Storage, 'setItem'> | null = globalThis.localStorage ?? null) {
  try {
    storage?.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable (private mode): progress lasts for the session only
  }
}
