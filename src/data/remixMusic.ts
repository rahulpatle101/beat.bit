// Intelligent Remix (V3.4): seeded, temperature-controlled variations of a kit's MAIN section
// (the bars Sandbox loops): melody, bass and (where safe) chord rhythm. Drums keep using the
// V2.2 Remix Dice (remix.ts) with temperature-scaled options (drumOptions below).
//
// Musical contract (tested over thousands of seeds in remixMusic.test.ts):
// - The harmonic progression is fixed: harmony is read from the ORIGIN bars, chord voicings never change.
// - Every note the engine writes is in the kit's diatonic scale; notes on strong steps (1/5/9/13)
//   are chord tones; bass chromatics only as a step-15 semitone approach to the next bar's root.
// - The first bass note of every bar (the root anchor) never moves.
// - Ranges, leap size, density and the bass↔kick relationship stay within limits.
// - Identity: a temperature-dependent share of the original notes is always preserved.
// - Deterministic: (current bars, seed, temperature, parts, kick) → identical result. Each part has
//   its own random stream, so toggling one part never changes another part's result.

import { mulberry32 } from '@/scene/geometry'
import type { Bar, ChordHit, Kit, Note } from './kits'
import { section } from './kits'
import { KIT_SCALE, STRONG_STEPS, harmonyOf, inScale, nearestTone, pc, scaleStep, snapToScale, type BarHarmony } from './theory'

export type Part = 'drums' | 'melody' | 'bass' | 'chords'
export const PARTS: Part[] = ['drums', 'melody', 'bass', 'chords']
export const DEFAULT_PARTS: Part[] = ['drums', 'melody', 'bass']
export type Band = 'subtle' | 'groovy' | 'wild' | 'chaos'

export const bandOf = (t: number): Band => (t < 25 ? 'subtle' : t < 60 ? 'groovy' : t < 85 ? 'wild' : 'chaos')
export const BAND_LABEL: Record<Band, string> = { subtle: 'SUBTLE', groovy: 'GROOVY', wild: 'WILD', chaos: 'CHAOS' }
export const DEFAULT_TEMPERATURE = 40

interface BandSpec {
  /** Max diatonic steps for a substitution. */
  sub: number
  /** Max onset displacement (16ths). */
  displace: number
  /** Max melodic leap created by a changed note (semitones). */
  leap: number
  /** Extra notes allowed per bar over the original (melody / bass). */
  extraMelody: number
  extraBass: number
  /** Min share of origin notes preserved (identity floor). */
  floor: number
  ops: { melody: MelodyOp[]; bass: BassOp[]; chords: ChordOp[] }
}
type MelodyOp = 'sub' | 'target' | 'displace' | 'rest' | 'fill' | 'octave' | 'ending' | 'call'
type BassOp = 'sub' | 'octave' | 'displace' | 'drop' | 'add' | 'approach'
type ChordOp = 'shift' | 'add' | 'drop'

export const BANDS: Record<Band, BandSpec> = {
  subtle: { sub: 1, displace: 0, leap: 7, extraMelody: 0, extraBass: 0, floor: 0.7, ops: { melody: ['sub', 'ending'], bass: ['sub'], chords: ['shift'] } },
  groovy: { sub: 2, displace: 1, leap: 9, extraMelody: 1, extraBass: 1, floor: 0.4, ops: { melody: ['sub', 'target', 'displace', 'rest', 'fill', 'ending'], bass: ['sub', 'octave', 'displace', 'drop', 'add'], chords: ['shift'] } },
  wild: { sub: 3, displace: 2, leap: 12, extraMelody: 2, extraBass: 2, floor: 0.15, ops: { melody: ['sub', 'target', 'displace', 'rest', 'fill', 'octave', 'ending', 'call'], bass: ['sub', 'octave', 'displace', 'drop', 'add', 'approach'], chords: ['shift', 'add', 'drop'] } },
  chaos: { sub: 4, displace: 2, leap: 12, extraMelody: 3, extraBass: 2, floor: 0, ops: { melody: ['sub', 'target', 'displace', 'rest', 'fill', 'octave', 'ending', 'call'], bass: ['sub', 'octave', 'displace', 'drop', 'add', 'approach'], chords: ['shift', 'add', 'drop'] } },
}

/** Share of notes touched per roll: continuous in temperature (0 → 6 %, 100 → 56 %). */
export const strengthOf = (t: number) => 0.06 + 0.5 * Math.max(0, Math.min(100, t)) / 100

/** Drum Remix Dice options per temperature (changes per roll and drift limit vs the kit grid). */
export function drumOptions(t: number): { min: number; max: number; drift: number } {
  return { subtle: { min: 1, max: 2, drift: 4 }, groovy: { min: 2, max: 4, drift: 8 }, wild: { min: 3, max: 6, drift: 12 }, chaos: { min: 5, max: 8, drift: 16 } }[bandOf(t)]
}

const SALT: Record<Part, number> = { drums: 0x9e3779b1, melody: 0x85ebca6b, bass: 0xc2b2ae35, chords: 0x27d4eb2f }
export const partRng = (seed: number, part: Part) => mulberry32((seed ^ SALT[part]) >>> 0)

// ---------------------------------------------------------------- composition helpers

/** A deep copy of the kit's main-section bars: the "original composition" Remix starts from. */
export function originComposition(kit: Kit): Bar[] {
  return cloneBars(section(kit, 'main'))
}
export function cloneBars(bars: Bar[]): Bar[] {
  return bars.map((b) => ({
    ...b,
    drums: { ...b.drums },
    ...(b.bass ? { bass: b.bass.map((n) => ({ ...n })) } : {}),
    ...(b.lead ? { lead: b.lead.map((n) => ({ ...n })) } : {}),
    ...(b.lead2 ? { lead2: b.lead2.map((n) => ({ ...n })) } : {}),
    ...(b.chords ? { chords: b.chords.map((c) => ({ ...c, midis: [...c.midis] })) } : {}),
    ...(b.riff ? { riff: b.riff.map((c) => ({ ...c, midis: [...c.midis] })) } : {}),
    ...(b.toms ? { toms: b.toms.map((n) => ({ ...n })) } : {}),
  }))
}

type Src = 'lead' | 'lead2' | 'riff'
interface MNote extends Note {
  src: Src
  /** true = untouched by this roll. */
  keep: boolean
}

/** The melodic line of a bar: lead + lead2 + single-note riff (NIGHT SHIFT's riff is its melody). */
export function melodyOf(bar: Bar): Note[] {
  return extractMelody(bar).map(({ step, midi, len, vel }) => ({ step, midi, len, vel }))
}
function extractMelody(bar: Bar): MNote[] {
  const out: MNote[] = []
  for (const n of bar.lead ?? []) out.push({ ...n, src: 'lead', keep: true })
  for (const n of bar.lead2 ?? []) out.push({ ...n, src: 'lead2', keep: true })
  for (const c of bar.riff ?? []) if (c.midis.length === 1) out.push({ step: c.step, midi: c.midis[0], len: c.len, vel: c.vel, src: 'riff', keep: true })
  return out.sort((a, b) => a.step - b.step)
}
function writeMelody(bar: Bar, notes: MNote[]): Bar {
  const pick = (s: Src): Note[] => notes.filter((n) => n.src === s).map(({ step, midi, len, vel }) => ({ step, midi, len, vel }))
  const out: Bar = { ...bar }
  if (bar.lead !== undefined || notes.some((n) => n.src === 'lead')) out.lead = pick('lead')
  if (bar.lead2 !== undefined || notes.some((n) => n.src === 'lead2')) out.lead2 = pick('lead2')
  if (bar.riff !== undefined || notes.some((n) => n.src === 'riff')) {
    const multi = (bar.riff ?? []).filter((c) => c.midis.length !== 1)
    out.riff = [...multi, ...pick('riff').map((n): ChordHit => ({ step: n.step, midis: [n.midi], len: n.len, vel: n.vel }))].sort((a, b) => a.step - b.step)
  }
  return out
}

const pickOne = <T,>(arr: T[], rng: () => number): T | undefined => (arr.length ? arr[Math.floor(rng() * arr.length)] : undefined)
const weighted = <T extends string>(ops: T[], rng: () => number) => ops[Math.floor(rng() * ops.length)]

/** Share of origin notes (bar, step, pitch) still present. */
export function preserved(origin: Note[][], current: Note[][]): number {
  let total = 0
  let kept = 0
  origin.forEach((bar, i) => {
    for (const n of bar) {
      total++
      if (current[i]?.some((m) => m.step === n.step && m.midi === n.midi)) kept++
    }
  })
  return total ? kept / total : 1
}

// ---------------------------------------------------------------- shared repair

interface LineCtx {
  scale: number[]
  harmony: BarHarmony[]
  lo: number
  hi: number
  spec: BandSpec
}

/** Sort, de-duplicate onsets, remove overlaps, keep inside the bar. */
function tidy<T extends Note & { keep: boolean }>(notes: T[], maxLen = 16): T[] {
  // Same onset: the untouched (original) note wins.
  const s = [...notes].sort((a, b) => a.step - b.step || Number(b.keep) - Number(a.keep))
  const out: T[] = []
  for (const n of s) {
    if (n.step < 0 || n.step > 15) continue
    if (out.length && out[out.length - 1].step === n.step) continue
    out.push({ ...n })
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1]?.step ?? 16
    out[i].len = Math.max(0, Math.min(out[i].len, next - out[i].step, 16 - out[i].step, maxLen))
  }
  return out.filter((n) => n.len >= 1)
}

/**
 * Leap control for changed notes: pick the octave of the note's pitch class (inside the range)
 * that minimises the larger leap to its neighbours; if still wider than `limit`, use the nearest
 * legal tone (chord tone on strong steps / long notes, else scale tone) midway between them.
 */
function smoothLeaps<T extends Note & { keep: boolean }>(line: T[], c: LineCtx, bi: number, limit: number) {
  const h = c.harmony[bi]
  const scaleSet = new Set(c.scale)
  // Removing a note can make two untouched notes adjacent across a wide gap: re-open the later one.
  for (let i = 1; i < line.length; i++) if (line[i].keep && line[i - 1].keep && Math.abs(line[i].midi - line[i - 1].midi) > 12) line[i].keep = false
  for (let pass = 0; pass < 2; pass++)
    line.forEach((n, i) => {
      if (n.keep) return
      const nb = [line[i - 1], line[i + 1]].filter(Boolean) as T[]
      if (!nb.length) return
      const worst = (m: number) => Math.max(...nb.map((x) => Math.abs(m - x.midi)))
      if (worst(n.midi) <= limit) return
      let best = n.midi
      for (let m = c.lo; m <= c.hi; m++) if (pc(m) === pc(n.midi) && worst(m) < worst(best)) best = m
      if (worst(best) > limit) {
        const mid = Math.round(nb.reduce((a, x) => a + x.midi, 0) / nb.length)
        const tones = STRONG_STEPS.has(n.step) || n.len >= 2 ? h.tones : scaleSet
        best = foldRange(nearestTone(mid, tones), c.lo, c.hi)
      }
      n.midi = best
    })
}

function foldRange(m: number, lo: number, hi: number) {
  while (m > hi) m -= 12
  while (m < lo) m += 12
  return m
}

// ---------------------------------------------------------------- melody

function mutateMelodyBar(notes: MNote[], bi: number, c: LineCtx, rng: () => number, nOps: number, originCount: number): MNote[] {
  const h = c.harmony[bi]
  let line = notes.map((n) => ({ ...n }))
  const ops = c.spec.ops.melody.filter((o) => o !== 'call')
  for (let k = 0; k < nOps; k++) {
    const op = weighted(ops, rng)
    const i = Math.floor(rng() * line.length)
    const n = line[i]
    if (!n && op !== 'fill') continue
    switch (op) {
      case 'sub': {
        if (c.spec.displace === 0 && STRONG_STEPS.has(n.step)) break // subtle: weak steps only
        const d = (1 + Math.floor(rng() * c.spec.sub)) * (rng() < 0.5 ? -1 : 1)
        n.midi = scaleStep(n.midi, d, c.scale)
        n.keep = false
        break
      }
      case 'target': {
        const strong = line.filter((x) => STRONG_STEPS.has(x.step))
        const t = pickOne(strong, rng)
        if (t) {
          const others = [...h.tones].map((p) => nearestTone(t.midi + (rng() < 0.5 ? 3 : -3), new Set([p])))
          t.midi = pickOne(others, rng) ?? t.midi
          t.keep = false
        }
        break
      }
      case 'displace': {
        const d = (1 + Math.floor(rng() * c.spec.displace)) * (rng() < 0.5 ? -1 : 1)
        const prevEnd = i > 0 ? line[i - 1].step + 1 : 0
        const next = line[i + 1]?.step ?? 16
        const to = n.step + d
        if (to >= prevEnd && to < next && to <= 15) {
          n.step = to
          n.len = Math.max(1, Math.min(n.len, next - to))
          n.keep = false
        }
        break
      }
      case 'rest':
        if (line.length > Math.max(1, originCount - 2) && !STRONG_STEPS.has(n.step)) line.splice(i, 1)
        break
      case 'fill': {
        const gaps = line.map((x, j) => ({ j, start: x.step + x.len, end: line[j + 1]?.step ?? 16 })).filter((g) => g.end - g.start >= 2)
        const g = pickOne(gaps, rng)
        if (g && line.length < originCount + c.spec.extraMelody) {
          const prev = line[g.j]
          const nextNote = line[g.j + 1] ?? prev
          const step = g.start + Math.floor(rng() * Math.min(2, g.end - g.start - 1))
          let midi = snapToScale(Math.round((prev.midi + nextNote.midi) / 2), c.scale)
          if (STRONG_STEPS.has(step)) midi = nearestTone(midi, h.tones)
          line.push({ step, midi, len: 1, vel: 0.8, src: prev.src, keep: false })
          line.sort((a, b) => a.step - b.step)
        }
        break
      }
      case 'octave': {
        const to = n.midi + (rng() < 0.5 ? 12 : -12)
        if (to >= c.lo && to <= c.hi) {
          n.midi = to
          n.keep = false
        }
        break
      }
      case 'ending': {
        // Phrase-ending variation: the last note of the bar moves to another chord tone.
        const last = line[line.length - 1]
        if (!last) break
        const alts = [...h.tones].filter((p) => p !== pc(last.midi)).map((p) => nearestTone(last.midi, new Set([p])))
        const to = pickOne(alts, rng)
        if (to !== undefined) {
          last.midi = to
          last.keep = false
        }
        break
      }
    }
  }
  line = repairMelody(line, bi, c, originCount)
  return line
}

function repairMelody(notes: MNote[], bi: number, c: LineCtx, originCount: number): MNote[] {
  const h = c.harmony[bi]
  let line = tidy(notes)
  line.forEach((n) => {
    if (n.keep) return
    if (!inScale(n.midi, c.scale)) n.midi = snapToScale(n.midi, c.scale)
    if (STRONG_STEPS.has(n.step) || n.len >= 2) {
      // Strong steps and long notes land on chord tones (no sustained avoid notes).
      if (!h.tones.has(pc(n.midi))) n.midi = nearestTone(n.midi, h.tones)
    }
    n.midi = foldRange(n.midi, c.lo, c.hi)
  })
  smoothLeaps(line, c, bi, c.spec.leap)
  // Unchanged chromatic notes must still resolve by a semitone to the next note.
  line.forEach((n, i) => {
    if (inScale(n.midi, c.scale)) return
    const next = line[i + 1]
    if (!next || Math.abs(next.midi - n.midi) !== 1) {
      n.midi = snapToScale(n.midi, c.scale)
      n.keep = false
    }
  })
  // Density: never more than original + extra; drop changed short weak notes first.
  while (line.length > originCount + c.spec.extraMelody) {
    const j = line.findIndex((n) => !n.keep && !STRONG_STEPS.has(n.step))
    line.splice(j >= 0 ? j : line.length - 1, 1)
  }
  return line
}

/** Call-and-response: an answer bar re-uses its call's rhythm with a new, harmony-fitted contour. */
function callResponse(lines: MNote[][], c: LineCtx, rng: () => number, originCounts: number[]) {
  const pairs = [[0, 1], [2, 3]].filter(([a]) => lines[a]?.length)
  const pair = pickOne(pairs, rng)
  if (!pair) return
  const [call, resp] = pair
  const src = lines[resp][0]?.src ?? lines[call][0].src
  const shift = pickOne([-2, 2, 4, -4], rng)!
  const invert = rng() < 0.4
  const pivot = lines[call][0].midi
  lines[resp] = repairMelody(
    lines[call].map((n) => {
      let m = invert ? pivot - (n.midi - pivot) : n.midi
      m = scaleStep(m, shift, c.scale)
      return { ...n, midi: m, src, keep: false }
    }),
    resp,
    c,
    Math.max(originCounts[resp], originCounts[call]),
  )
}

// ---------------------------------------------------------------- bass

interface BNote extends Note {
  keep: boolean
}

function kickAlign(notes: Note[], kick: boolean[]) {
  const kicks = kick.map((k, i) => (k ? i : -1)).filter((i) => i >= 0)
  if (!kicks.length || !notes.length) return 0
  return notes.filter((n) => kick[n.step]).length / notes.length
}

function mutateBassBar(notes: BNote[], bi: number, bars: Bar[], c: LineCtx, kick: boolean[], originAlign: number, rng: () => number, nOps: number, originCount: number): BNote[] {
  const h = c.harmony[bi]
  let line = notes.map((n) => ({ ...n }))
  const anchor = line[0]
  const wantKick = originAlign >= 0.5
  const prefer = (s: number) => (wantKick ? kick[s] : !kick[s])
  const chordTonesNear = (m: number) => [...h.tones].map((p) => foldRange(nearestTone(m, new Set([p])), c.lo, c.hi))
  for (let k = 0; k < nOps; k++) {
    const op = weighted(c.spec.ops.bass, rng)
    const i = 1 + Math.floor(rng() * Math.max(0, line.length - 1)) // never the anchor
    const n = line[i]
    switch (op) {
      case 'sub': {
        if (!n) break
        const opts = STRONG_STEPS.has(n.step) || c.spec.sub < 2 ? chordTonesNear(n.midi) : [...chordTonesNear(n.midi), scaleStep(n.midi, rng() < 0.5 ? 1 : -1, c.scale)]
        const to = pickOne(opts.filter((m) => m !== n.midi), rng)
        if (to !== undefined) Object.assign(n, { midi: to, keep: false })
        break
      }
      case 'octave': {
        if (!n) break
        const to = n.midi + (rng() < 0.5 ? 12 : -12)
        if (to >= c.lo && to <= c.hi) Object.assign(n, { midi: to, keep: false })
        break
      }
      case 'displace': {
        if (!n) break
        const prevEnd = line[i - 1].step + 1
        const next = line[i + 1]?.step ?? 16
        const cands = [-2, -1, 1, 2].filter((d) => Math.abs(d) <= c.spec.displace).map((d) => n.step + d).filter((s) => s >= prevEnd && s < next && s <= 15 && prefer(s))
        const to = pickOne(cands, rng)
        if (to !== undefined) Object.assign(n, { step: to, len: Math.max(1, Math.min(n.len, next - to)), keep: false })
        break
      }
      case 'drop': {
        const cands = line.slice(1).filter((x) => !prefer(x.step) && !STRONG_STEPS.has(x.step))
        const d = pickOne(cands, rng)
        if (d && line.length > Math.max(2, originCount - 2)) line = line.filter((x) => x !== d)
        break
      }
      case 'add': {
        if (line.length >= originCount + c.spec.extraBass) break
        const taken = new Set(line.map((x) => x.step))
        const cands = Array.from({ length: 16 }, (_, s) => s).filter((s) => !taken.has(s) && prefer(s) && s > anchor.step && line.every((x) => !(s > x.step && s < x.step + x.len)))
        const s = pickOne(cands, rng)
        if (s === undefined) break
        const near = line.filter((x) => x.step < s).pop() ?? anchor
        const tone = pickOne([h.root, (h.root + 7) % 12], rng)!
        line.push({ step: s, midi: foldRange(nearestTone(near.midi, new Set([tone])), c.lo, c.hi), len: 1, vel: 0.8, keep: false })
        line.sort((a, b) => a.step - b.step)
        break
      }
      case 'approach': {
        // Chromatic approach on step 15 into the next bar's root (semitone below or above).
        const nextRoot = [...(bars[(bi + 1) % bars.length].bass ?? [])].sort((a, b) => a.step - b.step)[0]
        if (!nextRoot) break
        const last = line[line.length - 1]
        const to = nextRoot.midi + (rng() < 0.5 ? -1 : 1)
        if (to < c.lo || to > c.hi) break
        if (last.step === 15 && last !== anchor) Object.assign(last, { midi: to, keep: false })
        else if (last.step + last.len <= 15 && line.length < originCount + c.spec.extraBass) line.push({ step: 15, midi: to, len: 1, vel: 0.7, keep: false })
        break
      }
    }
  }
  return repairBass(line, bi, bars, c)
}

function repairBass(notes: BNote[], bi: number, bars: Bar[], c: LineCtx): BNote[] {
  const h = c.harmony[bi]
  const line = tidy(notes, 4) // ≤ 4 steps: no smeared low end
  const nextRoot = [...(bars[(bi + 1) % bars.length].bass ?? [])].sort((a, b) => a.step - b.step)[0]
  line.forEach((n) => {
    if (n.keep) return
    const approach = n.step === 15 && nextRoot && [1, 11].includes(Math.abs(pc(nextRoot.midi) - pc(n.midi)))
    if (!approach && !inScale(n.midi, c.scale)) n.midi = snapToScale(n.midi, c.scale)
    if (STRONG_STEPS.has(n.step) && !h.tones.has(pc(n.midi))) n.midi = nearestTone(n.midi, h.tones)
    n.midi = foldRange(n.midi, c.lo, c.hi)
  })
  smoothLeaps(line, c, bi, 12)
  return line
}

// ---------------------------------------------------------------- chords (rhythm only)

/** Chord rhythm is only remixed when every chord is a short hit (stabs), never sustained pads. */
export function chordsRemixable(origin: Bar[]): boolean {
  const hitsAll = origin.flatMap((b) => b.chords ?? [])
  return hitsAll.length > 0 && hitsAll.every((c) => c.len <= 4) && origin.every((b) => (b.chords?.length ?? 0) >= 2)
}

function mutateChordsBar(hitsIn: ChordHit[], c: LineCtx, rng: () => number, nOps: number, originCount: number): ChordHit[] {
  let hs = hitsIn.map((x) => ({ ...x, midis: [...x.midis] })).sort((a, b) => a.step - b.step)
  const voicing = hs[0].midis
  for (let k = 0; k < nOps; k++) {
    const op = weighted(c.spec.ops.chords, rng)
    const i = 1 + Math.floor(rng() * Math.max(0, hs.length - 1)) // the first hit stays
    const x = hs[i]
    if (op === 'shift' && x) {
      const d = (1 + Math.floor(rng() * Math.max(1, c.spec.displace))) * (rng() < 0.5 ? -1 : 1)
      const to = x.step + d
      const prevEnd = hs[i - 1].step + hs[i - 1].len
      const next = hs[i + 1]?.step ?? 16
      if (to >= prevEnd && to + x.len <= next && to <= 15) x.step = to
    } else if (op === 'drop' && x && hs.length > Math.max(2, originCount - 1)) {
      hs = hs.filter((y) => y !== x)
    } else if (op === 'add' && hs.length < originCount + 1) {
      const gaps = hs.map((y, j) => ({ start: y.step + y.len, end: hs[j + 1]?.step ?? 16 })).filter((g) => g.end - g.start >= 2)
      const g = pickOne(gaps, rng)
      if (g) hs.push({ step: g.start + 1 <= 15 ? g.start + (g.end - g.start > 2 ? 1 : 0) : g.start, midis: [...voicing], len: 1, vel: 0.75 })
    }
    hs.sort((a, b) => a.step - b.step)
  }
  return hs
}

// ---------------------------------------------------------------- governors (whole-line limits)

/** Total density never grows past ~15 %: trim changed (else any) weak-step notes from the most inflated bars. */
function capDensity<T extends Note & { keep: boolean }>(lines: T[][], originCounts: number[], protectFirst: boolean) {
  const cap = Math.round(originCounts.reduce((a, b) => a + b, 0) * 1.15) + 1
  let total = lines.reduce((a, l) => a + l.length, 0)
  while (total > cap) {
    const order = lines.map((_, i) => i).sort((a, b) => lines[b].length - originCounts[b] - (lines[a].length - originCounts[a]))
    let removed = false
    for (const bi of order) {
      const l = lines[bi]
      const from = protectFirst ? 1 : 0
      let j = l.findIndex((n, k) => k >= from && !n.keep && !STRONG_STEPS.has(n.step))
      if (j < 0) j = l.findIndex((n, k) => k >= from && !STRONG_STEPS.has(n.step))
      if (j >= 0) {
        l.splice(j, 1)
        removed = true
        break
      }
    }
    if (!removed) break
    total--
  }
}

// ---------------------------------------------------------------- the composition remix

export interface MusicRemixRequest {
  kit: Kit
  /** The kit's original main bars (identity + harmony reference). */
  origin: Bar[]
  /** The current (possibly already remixed) bars. */
  current: Bar[]
  /** The kick row the bass should relate to (the live grid, after any drum remix). */
  kick: boolean[]
  seed: number
  temperature: number
  parts: Part[]
}

export interface MusicRemixResult {
  bars: Bar[]
  changed: { melody: number; bass: number; chords: number }
}

function lineCtx(kit: Kit, origin: Bar[], t: number, kind: 'melody' | 'bass'): LineCtx {
  const notes = kind === 'melody' ? origin.flatMap(melodyOf) : origin.flatMap((b) => b.bass ?? [])
  const ms = notes.map((n) => n.midi)
  const lo = ms.length ? Math.min(...ms) : 60
  const hi = ms.length ? Math.max(...ms) : 72
  return {
    scale: KIT_SCALE[kit.id],
    harmony: harmonyOf(origin),
    lo: kind === 'melody' ? Math.max(52, lo - 5) : Math.max(28, lo - 5),
    hi: kind === 'melody' ? Math.min(91, hi + 7) : Math.min(57, hi + 5),
    spec: BANDS[bandOf(t)],
  }
}

/** Remix the melodic line, bass and chord rhythm of the main bars. Drums: see drumOptions + remix.ts. */
export function remixMusic(req: MusicRemixRequest): MusicRemixResult {
  const { kit, origin, temperature: t, parts } = req
  const spec = BANDS[bandOf(t)]
  const strength = strengthOf(t)
  let bars = cloneBars(req.current)
  const changed = { melody: 0, bass: 0, chords: 0 }

  // MELODY
  if (parts.includes('melody') && origin.some((b) => melodyOf(b).length)) {
    const c = lineCtx(kit, origin, t, 'melody')
    const originLines = origin.map(melodyOf)
    const run = (from: Bar[], rng: () => number) => {
      const lines = from.map(extractMelody)
      lines.forEach((line, bi) => {
        if (!line.length) return
        const nOps = Math.max(0, Math.round(line.length * strength * (0.6 + rng() * 0.8)))
        lines[bi] = mutateMelodyBar(line, bi, c, rng, nOps, originLines[bi].length)
      })
      if (spec.ops.melody.includes('call') && rng() < (bandOf(t) === 'chaos' ? 0.5 : 0.3)) callResponse(lines, c, rng, originLines.map((l) => l.length))
      return lines
    }
    const rng = partRng(req.seed, 'melody')
    let lines = run(bars, rng)
    capDensity(lines, originLines.map((l) => l.length), false)
    lines.forEach((l, bi) => smoothLeaps(l, c, bi, 12)) // removals can create new neighbours
    // Identity floor: chained rolls never drift below the temperature's floor; restart from the origin.
    if (preserved(originLines, lines) < spec.floor) lines = run(origin, rng)
    // Still below (rare): restore whole mutated bars to the original until the floor holds.
    for (let bi = 0; preserved(originLines, lines) < spec.floor && bi < lines.length; bi++) lines[bi] = extractMelody(origin[bi])
    // A roll must be audible: if nothing changed, force one weak-step substitution.
    if (lines.every((l, bi) => sameLine(l, melodyOf(bars[bi])))) {
      const bi = lines.findIndex((l) => l.some((n) => !STRONG_STEPS.has(n.step)))
      if (bi >= 0) {
        const n = lines[bi].find((x) => !STRONG_STEPS.has(x.step))!
        n.midi = scaleStep(n.midi, rng() < 0.5 ? 1 : -1, c.scale)
        n.keep = false
        lines[bi] = repairMelody(lines[bi], bi, c, originLines[bi].length)
      }
    }
    bars = bars.map((b, bi) => writeMelody(b, lines[bi]))
    changed.melody = diffCount(req.current.map(melodyOf), lines)
  }

  // BASS
  if (parts.includes('bass') && origin.some((b) => b.bass?.length)) {
    const c = lineCtx(kit, origin, t, 'bass')
    const rng = partRng(req.seed, 'bass')
    const originLines = origin.map((b) => b.bass ?? [])
    const originAlign = kickAlign(originLines.flat(), req.kick)
    const run = (from: Bar[]) =>
      from.map((b, bi) => {
        const line: BNote[] = [...(b.bass ?? [])].sort((x, y) => x.step - y.step).map((n) => ({ ...n, keep: true }))
        if (line.length < 2) return line
        // The anchor (first note) is always the ORIGIN's first note.
        const anchor = [...originLines[bi]].sort((x, y) => x.step - y.step)[0]
        if (anchor) line[0] = { ...anchor, keep: true }
        const nOps = Math.max(0, Math.round(line.length * strength * (0.6 + rng() * 0.8)))
        return mutateBassBar(line, bi, origin, c, req.kick, originAlign, rng, nOps, originLines[bi].length)
      })
    let lines = run(bars)
    if (preserved(originLines, lines) < spec.floor) lines = run(origin)
    capDensity(lines, originLines.map((l) => l.length), true)
    // Keep the bass↔kick relationship: revert bars to the original until it is within 0.2.
    for (let bi = 0; Math.abs(kickAlign(lines.flat(), req.kick) - originAlign) > 0.2 && bi < lines.length; bi++)
      lines[bi] = originLines[bi].map((n) => ({ ...n, keep: true }))
    for (let bi = 0; preserved(originLines, lines) < spec.floor && bi < lines.length; bi++) lines[bi] = originLines[bi].map((n) => ({ ...n, keep: true }))
    lines.forEach((l, bi) => smoothLeaps(l, c, bi, 12)) // removals can create new neighbours
    bars = bars.map((b, bi) => (b.bass ? { ...b, bass: lines[bi].map(({ step, midi, len, vel }) => ({ step, midi, len, vel })) } : b))
    changed.bass = diffCount(req.current.map((b) => b.bass ?? []), lines)
  }

  // CHORDS (rhythm only, voicings fixed)
  if (parts.includes('chords') && chordsRemixable(origin)) {
    const c = lineCtx(kit, origin, t, 'melody')
    const rng = partRng(req.seed, 'chords')
    const before = bars.map((b) => b.chords ?? [])
    bars = bars.map((b, bi) => {
      const hs = b.chords ?? []
      if (hs.length < 2) return b
      const nOps = Math.max(bandOf(t) === 'subtle' ? 0 : 1, Math.round(hs.length * strength * (0.6 + rng() * 0.8)))
      return { ...b, chords: mutateChordsBar(hs, c, rng, nOps, (origin[bi].chords ?? []).length) }
    })
    changed.chords = bars.reduce((s, b, bi) => s + (JSON.stringify(b.chords) === JSON.stringify(before[bi]) ? 0 : 1), 0)
  }

  return { bars, changed }
}

const sameLine = (a: Note[], b: Note[]) => a.length === b.length && a.every((n, i) => n.step === b[i].step && n.midi === b[i].midi && n.len === b[i].len)
/** Notes that are new or changed (a moved note counts once). */
function diffCount(before: Note[][], after: Note[][]) {
  let d = 0
  after.forEach((line, i) => {
    for (const n of line) if (!before[i]?.some((m) => m.step === n.step && m.midi === n.midi)) d++
  })
  return d
}

// ---------------------------------------------------------------- validation (tests + dev checks)

/** Every musical rule the engine promises, checked on a result. Returns human-readable problems. */
export function validateRemix(kit: Kit, origin: Bar[], bars: Bar[], t: number, kick: boolean[]): string[] {
  const p: string[] = []
  const spec = BANDS[bandOf(t)]
  if (bars.length !== origin.length) p.push(`bar count ${bars.length} ≠ ${origin.length}`)
  const harmony = harmonyOf(origin)
  const scale = KIT_SCALE[kit.id]
  const checkLine = (name: string, lines: Note[][], originLines: Note[][], c: LineCtx, allowed: (bi: number) => number, isBass: boolean) => {
    lines.forEach((line, bi) => {
      const o = originLines[bi]
      line.forEach((n, i) => {
        const where = `${name} bar ${bi} step ${n.step}`
        if (n.step < 0 || n.step + n.len > 16 || n.len < 1) p.push(`${where}: outside the bar`)
        if (i > 0 && line[i - 1].step + line[i - 1].len > n.step) p.push(`${where}: overlaps`)
        if (n.midi < c.lo || n.midi > c.hi) {
          if (!o.some((m) => m.step === n.step && m.midi === n.midi)) p.push(`${where}: out of range ${n.midi}`)
        }
        const original = o.some((m) => m.midi === n.midi && m.step === n.step)
        if (original) return
        const nextRootMidi = [...(origin[(bi + 1) % origin.length].bass ?? [])].sort((a, b) => a.step - b.step)[0]?.midi
        const approach = isBass && n.step === 15 && nextRootMidi !== undefined && [1, 11].includes(Math.abs(pc(nextRootMidi) - pc(n.midi)))
        const resolves = !isBass && line[i + 1] && Math.abs(line[i + 1].midi - n.midi) === 1
        if (!inScale(n.midi, scale) && !approach && !resolves) p.push(`${where}: out of key ${n.midi}`)
        if (STRONG_STEPS.has(n.step) && !harmony[bi].tones.has(pc(n.midi)) && !approach) p.push(`${where}: strong step not a chord tone`)
        const prev = line[i - 1]
        if (prev && Math.abs(prev.midi - n.midi) > Math.max(spec.leap, 12)) p.push(`${where}: leap ${Math.abs(prev.midi - n.midi)}`)
      })
      if (line.length > allowed(bi)) p.push(`${name} bar ${bi}: ${line.length} notes > ${allowed(bi)}`)
    })
    const total = lines.flat().length
    const total0 = originLines.flat().length
    if (total > Math.ceil(total0 * 1.25) + 2) p.push(`${name}: density ${total} vs ${total0}`)
    if (preserved(originLines, lines) < spec.floor - 1e-9) p.push(`${name}: identity ${preserved(originLines, lines).toFixed(2)} < ${spec.floor}`)
  }
  const mc = lineCtx(kit, origin, t, 'melody')
  const om = origin.map(melodyOf)
  // Call-and-response may give an answer bar (1, 3) its call's note count.
  const melodyAllowed = (bi: number) =>
    Math.max(om[bi].length + spec.extraMelody, spec.ops.melody.includes('call') && bi % 2 === 1 ? om[bi - 1].length + spec.extraMelody : 0)
  checkLine('melody', bars.map(melodyOf), om, mc, melodyAllowed, false)
  const bc = lineCtx(kit, origin, t, 'bass')
  const ob = origin.map((b) => [...(b.bass ?? [])].sort((a, c) => a.step - c.step))
  const nb = bars.map((b) => [...(b.bass ?? [])].sort((a, c) => a.step - c.step))
  checkLine('bass', nb, ob, bc, (bi) => ob[bi].length + spec.extraBass, true)
  nb.forEach((line, bi) => {
    const a = ob[bi][0]
    if (a && !line.some((n) => n.step === a.step && n.midi === a.midi)) p.push(`bass bar ${bi}: root anchor moved`)
    if (line.some((n) => n.len > 4 && !ob[bi].some((m) => m.step === n.step && m.len === n.len))) p.push(`bass bar ${bi}: note longer than 4 steps`)
  })
  const a0 = kickAlign(ob.flat(), kick)
  const a1 = kickAlign(nb.flat(), kick)
  if (Math.abs(a1 - a0) > 0.25) p.push(`bass↔kick relation ${a0.toFixed(2)} → ${a1.toFixed(2)}`)
  bars.forEach((b, bi) => {
    const oc = origin[bi].chords ?? []
    const nc = b.chords ?? []
    const voicings = new Set(oc.map((c) => c.midis.join('.')))
    for (const c of nc) if (!voicings.has(c.midis.join('.'))) p.push(`chords bar ${bi}: voicing changed`)
    if (Math.abs(nc.length - oc.length) > 1) p.push(`chords bar ${bi}: ${nc.length} hits vs ${oc.length}`)
    nc.forEach((c, i) => {
      if (i > 0 && nc[i - 1].step + nc[i - 1].len > c.step && oc.every((x) => x.len <= 4)) p.push(`chords bar ${bi}: overlap`)
    })
  })
  return p
}
