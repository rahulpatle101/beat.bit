// Remix Dice (V2.2): a musically constrained variation of the current pattern.
//
// Rules (DESIGN.md → V2.2):
// - Identity: kick/snare notes on downbeats (steps 1/5/9/13) of the chain's ORIGIN pattern
//   are anchors and never change.
// - Noticeable but coherent: every roll changes 2–4 cells, at least one on kick, snare or clap.
// - Musical moves only: pickups, pushes, ghosts, layers, hat density, turnarounds.
// - Density caps per track keep patterns from getting crowded.
// - Drift limit: repeated rolls stay within MAX_DRIFT cells of the origin (a roll first
//   nudges back toward the origin when needed).
// Pure: randomness comes from the injected rng, so it's deterministic in tests.

import { STEPS, TRACK_IDS, clonePattern, isEmpty, type Pattern, type TrackId } from './patterns'

export interface Change {
  track: TrackId
  step: number
  on: boolean
}

export interface RemixResult {
  pattern: Pattern
  changes: Change[]
}

export const MIN_CHANGES = 2
export const MAX_CHANGES = 4
export const MAX_DRIFT = 8
const CAPS: Record<TrackId, number> = { kick: 6, snare: 4, hat: 16, clap: 4 }
const DOWNBEATS = [0, 4, 8, 12]
const AUDIBLE: TrackId[] = ['kick', 'snare', 'clap']

export function hamming(a: Pattern, b: Pattern): number {
  let d = 0
  for (const t of TRACK_IDS) for (let i = 0; i < STEPS; i++) if (a[t][i] !== b[t][i]) d++
  return d
}

const count = (p: Pattern, t: TrackId) => p[t].filter(Boolean).length

/** A simple backbone, used when rolling an empty pattern. */
function backbone(): Pattern {
  const p: Pattern = {
    kick: Array(STEPS).fill(false),
    snare: Array(STEPS).fill(false),
    hat: Array(STEPS).fill(false),
    clap: Array(STEPS).fill(false),
  }
  p.kick[0] = p.kick[8] = true
  p.snare[4] = p.snare[12] = true
  for (let i = 0; i < STEPS; i += 2) p.hat[i] = true
  return p
}

type Move = { audible: boolean; weight: number; plan: (ctx: Ctx) => Change[] | null }

interface Ctx {
  p: Pattern
  origin: Pattern
  rng: () => number
  touched: Set<string>
  budget: number
}

const key = (t: TrackId, s: number) => `${t}:${s}`
const pick = <T,>(arr: T[], rng: () => number): T | undefined =>
  arr.length ? arr[Math.floor(rng() * arr.length)] : undefined

function isAnchor(origin: Pattern, t: TrackId, s: number) {
  return (t === 'kick' || t === 'snare') && DOWNBEATS.includes(s) && origin[t][s]
}
function cap(ctx: Ctx, t: TrackId) {
  return Math.max(CAPS[t], count(ctx.origin, t))
}
function free(ctx: Ctx, t: TrackId, s: number) {
  return !ctx.touched.has(key(t, s)) && !isAnchor(ctx.origin, t, s)
}
/** Add a note on one of `steps` for track t (empty, untouched, under the cap). */
function addOn(ctx: Ctx, t: TrackId, steps: number[]): Change[] | null {
  if (count(ctx.p, t) >= cap(ctx, t)) return null
  const s = pick(steps.filter((i) => !ctx.p[t][i] && free(ctx, t, i)), ctx.rng)
  return s === undefined ? null : [{ track: t, step: s, on: true }]
}
/** Remove a non-anchor note on one of `steps` (keeps at least `keep` notes on the track). */
function removeOn(ctx: Ctx, t: TrackId, steps: number[], keep = 1): Change[] | null {
  if (count(ctx.p, t) <= keep) return null
  const s = pick(steps.filter((i) => ctx.p[t][i] && free(ctx, t, i)), ctx.rng)
  return s === undefined ? null : [{ track: t, step: s, on: false }]
}

const ALL = Array.from({ length: STEPS }, (_, i) => i)
const ANDS = [2, 6, 10, 14] // "and" 16ths
const AS = [3, 7, 11, 15] // "a" 16ths (pickups into the next beat)
const OFF16 = [1, 3, 5, 7, 9, 11, 13, 15]
const LAST_BEAT = [13, 14, 15]

const MOVES: Move[] = [
  // Kick pickup: a kick on an "a" or "and", leading into a beat.
  { audible: true, weight: 3, plan: (c) => addOn(c, 'kick', [...AS, ...ANDS].filter((s) => s !== 15 || !c.p.kick[0])) },
  // Kick push/pull: move a non-anchor kick by one 16th.
  {
    audible: true,
    weight: 3,
    plan: (c) => {
      if (c.budget < 2) return null
      const from = pick(ALL.filter((s) => c.p.kick[s] && free(c, 'kick', s)), c.rng)
      if (from === undefined) return null
      const to = pick([from - 1, from + 1].filter((s) => s >= 0 && s < STEPS && !c.p.kick[s] && free(c, 'kick', s)), c.rng)
      return to === undefined ? null : [{ track: 'kick', step: from, on: false }, { track: 'kick', step: to, on: true }]
    },
  },
  // Kick drop: thin out a busy kick line.
  { audible: true, weight: 1, plan: (c) => (count(c.p, 'kick') > 2 ? removeOn(c, 'kick', ALL, 2) : null) },
  // Snare ghost: an extra snare around the backbeats.
  { audible: true, weight: 2, plan: (c) => addOn(c, 'snare', [7, 10, 14, 15]) },
  // Snare drop: remove a non-backbeat snare.
  { audible: true, weight: 1, plan: (c) => removeOn(c, 'snare', ALL.filter((s) => !DOWNBEATS.includes(s)), 1) },
  // Clap layer: put a clap on a backbeat, or a fill clap at the end of the bar.
  { audible: true, weight: 2, plan: (c) => addOn(c, 'clap', [4, 12].some((s) => !c.p.clap[s]) ? [4, 12] : [15, 14]) },
  // Clap trim: remove a clap (keeps one if there were claps).
  { audible: true, weight: 1, plan: (c) => removeOn(c, 'clap', ALL, 1) },
  // Turnaround: a kick, snare or clap in the last beat of the bar.
  {
    audible: true,
    weight: 2,
    plan: (c) => {
      const t = pick(AUDIBLE, c.rng)!
      return addOn(c, t, LAST_BEAT)
    },
  },
  // Hat density: add a 16th hat next to an existing hat.
  {
    audible: false,
    weight: 2,
    plan: (c) => addOn(c, 'hat', OFF16.filter((s) => c.p.hat[s - 1] || c.p.hat[(s + 1) % STEPS])),
  },
  // Hat space: remove an offbeat hat from a busy hat line.
  { audible: false, weight: 1, plan: (c) => (count(c.p, 'hat') >= 6 ? removeOn(c, 'hat', OFF16, 4) : null) },
]

function apply(ctx: Ctx, changes: Change[], out: Change[]) {
  for (const ch of changes) {
    ctx.p[ch.track][ch.step] = ch.on
    ctx.touched.add(key(ch.track, ch.step))
    out.push(ch)
    ctx.budget--
  }
}

function weightedMove(moves: Move[], rng: () => number): Move {
  const total = moves.reduce((s, m) => s + m.weight, 0)
  let r = rng() * total
  for (const m of moves) {
    r -= m.weight
    if (r < 0) return m
  }
  return moves[moves.length - 1]
}

/**
 * Roll a variation of `current`. `origin` is the pattern the remix chain started from
 * (anchors + drift limit are measured against it).
 */
export interface DrumRemixOptions {
  /** Changes per roll (inclusive range). */
  min: number
  max: number
  /** Max cells away from the origin pattern after the roll. */
  drift: number
}

export function remix(current: Pattern, origin: Pattern, rng: () => number = Math.random, opts?: DrumRemixOptions): RemixResult {
  const MAX_DRIFT_ = opts?.drift ?? MAX_DRIFT
  if (isEmpty(current)) {
    const pattern = backbone()
    const changes: Change[] = []
    for (const t of TRACK_IDS) pattern[t].forEach((on, step) => on && changes.push({ track: t, step, on: true }))
    return { pattern, changes }
  }

  // V2.2 default: 2–4 changes. V3.4 temperature: min..max (drumOptions in remixMusic.ts).
  const target = opts ? opts.min + Math.floor(rng() * (opts.max - opts.min + 1)) : MIN_CHANGES + (rng() < 0.5 ? 0 : 1) + (rng() < 0.25 ? 1 : 0)
  const ctx: Ctx = { p: clonePattern(current), origin, rng, touched: new Set(), budget: target }
  const out: Change[] = []

  // 1. Drift control: revert enough differences so this roll can't exceed MAX_DRIFT.
  const drift = hamming(current, origin)
  const reverts = Math.ceil(Math.max(0, drift + target - MAX_DRIFT_) / 2)
  if (reverts > 0) {
    const diffs: Change[] = []
    for (const t of TRACK_IDS)
      for (let s = 0; s < STEPS; s++) if (current[t][s] !== origin[t][s]) diffs.push({ track: t, step: s, on: origin[t][s] })
    // Prefer reverts that restore an original note, then audible ones, so the roll is heard
    // and the groove's identity comes back first.
    diffs.sort(
      (a, b) =>
        Number(b.on) - Number(a.on) ||
        Number(AUDIBLE.includes(b.track)) - Number(AUDIBLE.includes(a.track)) ||
        rng() - 0.5,
    )
    let done = 0
    for (const d of diffs) {
      if (done >= reverts) break
      // A revert follows the same rules as moves: never empty a track, never exceed its cap.
      if (!d.on && count(ctx.p, d.track) <= 1) continue
      if (d.on && count(ctx.p, d.track) >= cap(ctx, d.track)) continue
      apply(ctx, [d], out)
      done++
    }
    // If some reverts had to be skipped, shrink the remaining budget to the drift headroom.
    ctx.budget = Math.max(0, Math.min(ctx.budget, MAX_DRIFT_ - hamming(ctx.p, origin)))
  }

  // 2. Make sure the roll is audible (kick, snare, or clap changes).
  const audibleMoves = MOVES.filter((m) => m.audible)
  for (let tries = 0; !out.some((c) => AUDIBLE.includes(c.track)) && ctx.budget > 0 && tries < 40; tries++) {
    const ch = weightedMove(audibleMoves, rng).plan(ctx)
    if (ch && ch.length <= ctx.budget) apply(ctx, ch, out)
  }

  // 3. Fill the rest of the budget with any musical moves.
  for (let tries = 0; ctx.budget > 0 && tries < 80; tries++) {
    const ch = weightedMove(MOVES, rng).plan(ctx)
    if (ch && ch.length <= ctx.budget) apply(ctx, ch, out)
  }

  return { pattern: ctx.p, changes: out }
}
