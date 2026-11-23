// SOUND LAB (dev-only): offline rendering, loudness measurement and sound-quality checks.
// Everything renders through the real master chain + mix buses (createMasterChain/createMix),
// and live playback in the lab calls the same `layer()` function: one code path for both.

import { createMasterChain } from '@/audio/chain'
import { chord, crash, createMix, drum, openHat, shaker, tom, type Mix } from '@/audio/instruments'
import { drumVel, glideFrom, playBassNote, playChordHit, playLeadNote, type BassSound, type ChordSound, type LeadSound } from '@/audio/kitPlayer'
import { stepDuration } from '@/audio/scheduler'
import { createNoiseBuffer } from '@/audio/voices'
import { NEON_DRIVE, arrangement, section, type Bar, type Kit, type Note } from '@/data/kits'
import { encodeWav, toBase64 } from '../wav'
import { PRESETS, presetById, type Preset, type Role } from '@/audio/synth/presets'
import { playPreset } from '@/audio/synth/presetSynth'

const SR = 44100
const LEAD_IN = 0.05
const TAIL = 2.4

/** A layer voice: a lab preset (with its calibrated gain), the kit's shipped sound, or NEON's original voice. */
export type LayerVoice = { kind: 'preset'; preset: Preset; gain: number } | { kind: 'prod' } | { kind: 'orig' } | { kind: 'off' }
export type VoiceSet = Record<Role, LayerVoice>

/** The audition phrase: NEON DRIVE's main section (4 bars, the hook), same notes for every preset. */
export const PHRASE_KIT: Kit = NEON_DRIVE
export const phraseBars = (): Bar[] => section(PHRASE_KIT, 'main')
export const arrangementBars = (): Bar[] => arrangement(PHRASE_KIT)

interface Voices {
  ctx: BaseAudioContext
  mix: Mix
  noise: AudioBuffer
}

/** Play one step of one bar with a voice set. Shared by live playback and offline renders. */
export function playStep(v: Voices, kit: Kit, bar: Bar, step: number, time: number, stepSec: number, set: VoiceSet, drums: boolean) {
  const { ctx, mix, noise } = v
  if (drums) {
    for (const key of ['kick', 'snare', 'hat', 'clap'] as const) {
      const vel = drumVel(bar.drums[key], step)
      if (vel) drum(ctx, mix.drums, key, time, vel, noise)
    }
    const oh = drumVel(bar.drums.ohat, step)
    if (oh) openHat(ctx, mix.drums, time, oh, noise)
    const cr = drumVel(bar.drums.crash, step)
    if (cr) crash(ctx, mix.drums, time, cr, noise)
    const sh = drumVel(bar.drums.shaker, step)
    if (sh) shaker(ctx, mix.drums, time, sh, noise)
    for (const n of bar.toms ?? []) if (n.step === step) tom(ctx, mix.drums, time, n.midi, n.vel)
  }
  // 'prod' = the kit's shipped sounds (via the kit player); 'orig' = NEON DRIVE's pre-V3.2a voices.
  const sound = <K extends 'bass' | 'chords' | 'lead' | 'lead2'>(voice: LayerVoice, key: K) =>
    voice.kind === 'orig' ? ORIGINAL[key] : (kit.presets[key] ?? kit.presets.lead)
  // BASS
  const b = set.bass
  bar.bass?.forEach((n, i) => {
    if (n.step !== step) return
    if (b.kind === 'prod' || b.kind === 'orig') playBassNote(v, sound(b, 'bass') as BassSound, bar.bass!, i, time, stepSec)
    else if (b.kind === 'preset') playPreset(ctx, mix.bass, b.preset, time, [n.midi], n.len * stepSec, { stepSec, velocity: n.vel, gain: b.gain, glideFrom: glideFrom(bar.bass!, i) })
  })
  // CHORDS (+ the kit's riff layer stays on its production voice: it is part of the composition's texture)
  const c = set.chords
  for (const h of bar.chords ?? [])
    if (h.step === step) {
      if (c.kind === 'prod' || c.kind === 'orig') playChordHit(v, sound(c, 'chords') as ChordSound, h.midis, time, h.len * stepSec, h.vel, stepSec)
      else if (c.kind === 'preset') playPreset(ctx, mix.chords, c.preset, time, h.midis, h.len * stepSec, { stepSec, velocity: h.vel, gain: c.gain })
    }
  if (c.kind !== 'off') for (const h of bar.riff ?? []) if (h.step === step) chord(ctx, mix.chords, time, h.midis, h.len * stepSec, (bar.riffBright ?? 0.5) * h.vel, 'riff', stepSec)
  // LEAD (+ lead2 doubling)
  const l = set.lead
  const line = (notes: Note[] | undefined, key: 'lead' | 'lead2') =>
    notes?.forEach((n, i) => {
      if (n.step !== step) return
      if (l.kind === 'prod' || l.kind === 'orig') playLeadNote(v, sound(l, key) as LeadSound, notes, i, time, stepSec)
      else if (l.kind === 'preset') playPreset(ctx, mix.lead, l.preset, time, [n.midi], n.len * stepSec, { stepSec, velocity: n.vel, gain: l.gain, glideFrom: glideFrom(notes, i) })
    })
  line(bar.lead, 'lead')
  line(bar.lead2, 'lead2')
}
/** NEON DRIVE's voices before the V3.2a sound change, kept for A/B in the lab. */
export const ORIGINAL = { bass: 'funk', chords: 'stab', lead: 'warm', lead2: 'pulse25' } as const


/** Offline render of `bars` with a voice set (optionally solo a role, optionally without FX/master). */
export async function renderBars(kit: Kit, bars: Bar[], set: VoiceSet, opts: { drums?: boolean; dry?: boolean } = {}): Promise<AudioBuffer> {
  const step = stepDuration(kit.bpm)
  const length = Math.ceil((LEAD_IN + bars.length * 16 * step + TAIL) * SR)
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, sampleRate: SR, length })
  const noise = createNoiseBuffer(ctx)
  let mix: Mix
  if (opts.dry) {
    // Dry: role buses straight to the destination (no FX sends, no compressor/limiter) — used by click checks.
    const g = () => {
      const n = ctx.createGain()
      n.connect(ctx.destination)
      return n
    }
    mix = { drums: g(), bass: g(), chords: g(), lead: g() } as unknown as Mix
  } else mix = createMix(ctx, createMasterChain(ctx).input, step)
  bars.forEach((bar, bi) => {
    for (let s = 0; s < 16; s++) playStep({ ctx, mix, noise }, kit, bar, s, LEAD_IN + (bi * 16 + s) * step, step, set, opts.drums ?? false)
  })
  return ctx.startRendering()
}

// ---------------------------------------------------------------- loudness

/** BS.1770-style integrated loudness (K-weighting via biquads, 400 ms blocks, −70/−10 gates). */
export async function lufs(buf: AudioBuffer): Promise<number> {
  const k = await kWeight(buf)
  const block = Math.floor(0.4 * SR)
  const hop = Math.floor(0.1 * SR)
  const blocks: number[] = []
  for (let i = 0; i + block <= k.length; i += hop) {
    let s = 0
    for (let c = 0; c < k.numberOfChannels; c++) {
      const d = k.getChannelData(c)
      let e = 0
      for (let j = i; j < i + block; j++) e += d[j] * d[j]
      s += e / block
    }
    blocks.push(s)
  }
  const L = (ms: number) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-12))
  const abs = blocks.filter((b) => L(b) > -70)
  if (!abs.length) return -70
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const gated = abs.filter((b) => L(b) > rel)
  return +L(gated.reduce((a, b) => a + b, 0) / gated.length).toFixed(1)
}

async function filtered(buf: AudioBuffer, chain: (ctx: OfflineAudioContext) => [AudioNode, AudioNode]): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext({ numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate, length: buf.length })
  const src = ctx.createBufferSource()
  src.buffer = buf
  const [first, last] = chain(ctx)
  src.connect(first)
  last.connect(ctx.destination)
  src.start()
  return ctx.startRendering()
}
const kWeight = (buf: AudioBuffer) =>
  filtered(buf, (ctx) => {
    const shelf = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 1681, gain: 4 })
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 38, Q: -6.02 })
    shelf.connect(hp)
    return [shelf, hp]
  })
const band = (buf: AudioBuffer, lo: number | null, hi: number | null) =>
  filtered(buf, (ctx) => {
    const nodes: BiquadFilterNode[] = []
    if (lo) nodes.push(new BiquadFilterNode(ctx, { type: 'highpass', frequency: lo, Q: -3.01 }), new BiquadFilterNode(ctx, { type: 'highpass', frequency: lo, Q: -3.01 }))
    if (hi) nodes.push(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: hi, Q: -3.01 }), new BiquadFilterNode(ctx, { type: 'lowpass', frequency: hi, Q: -3.01 }))
    nodes.reduce((a, b) => (a.connect(b), b))
    return [nodes[0], nodes[nodes.length - 1]]
  })

function energy(buf: AudioBuffer, a = 0, b = buf.length) {
  let e = 0
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c)
    for (let i = a; i < b; i++) e += d[i] * d[i]
  }
  return e
}
const db = (x: number) => +(10 * Math.log10(Math.max(x, 1e-15))).toFixed(1)
function peakOf(buf: AudioBuffer) {
  let p = 0
  let clipped = 0
  for (let c = 0; c < buf.numberOfChannels; c++)
    for (const v of buf.getChannelData(c)) {
      const a = Math.abs(v)
      if (a > p) p = a
      if (a >= 0.99) clipped++
    }
  return { peak: +p.toFixed(3), clipped }
}

// ---------------------------------------------------------------- calibration

const solo = (role: Role, v: LayerVoice): VoiceSet => ({ lead: { kind: 'off' }, bass: { kind: 'off' }, chords: { kind: 'off' }, [role]: v }) as VoiceSet

/** Loudness of the current production voice for each role on the audition phrase: the targets. */
export async function productionLoudness(): Promise<Record<Role, number>> {
  const out = {} as Record<Role, number>
  for (const r of ['lead', 'bass', 'chords'] as const) out[r] = await lufs(await renderBars(PHRASE_KIT, phraseBars(), solo(r, { kind: 'orig' })))
  return out
}

/** Gain that brings preset `p` to its loudness target on the phrase. The master compressor makes
 *  level non-linear, so solve in the dB domain with a secant iteration (converges in 2–4 renders). */
export async function calibrate(p: Preset): Promise<{ gain: number; raw: number; matched: number }> {
  const bars = phraseBars()
  const measure = async (gainDb: number) => lufs(await renderBars(PHRASE_KIT, bars, solo(p.role, { kind: 'preset', preset: p, gain: 10 ** (gainDb / 20) })))
  const raw = await measure(0)
  let x0 = 0
  let y0 = raw - p.loudness
  let x1 = -y0
  let y1 = (await measure(x1)) - p.loudness
  for (let i = 0; i < 6 && Math.abs(y1) > 0.15; i++) {
    const slope = Math.abs(y1 - y0) > 1e-3 ? (y1 - y0) / (x1 - x0) : 1
    const x2 = x1 - y1 / Math.max(0.3, slope)
    x0 = x1
    y0 = y1
    x1 = x2
    y1 = (await measure(x1)) - p.loudness
  }
  return { gain: +(10 ** (x1 / 20)).toFixed(3), raw, matched: +(y1 + p.loudness).toFixed(1) }
}

export async function calibrateAll(): Promise<Record<string, number>> {
  const g: Record<string, number> = {}
  for (const p of PRESETS) g[p.id] = (await calibrate(p)).gain
  return g
}

// ---------------------------------------------------------------- quality checks

/** Note on/off times of a role in the phrase (for click checks). */
function noteTimes(role: Role, p: Preset): { on: number; off: number }[] {
  const step = stepDuration(PHRASE_KIT.bpm)
  const out: { on: number; off: number }[] = []
  phraseBars().forEach((bar, bi) => {
    const t0 = LEAD_IN + bi * 16 * step
    const notes: { step: number; len: number }[] = role === 'chords' ? (bar.chords ?? []) : role === 'bass' ? (bar.bass ?? []) : [...(bar.lead ?? []), ...(bar.lead2 ?? [])]
    for (const n of notes) {
      if (p.arp && role === 'chords') {
        const tick = step / p.arp.perStep
        for (let at = 0; at < n.len * step - 0.004; at += tick) out.push({ on: t0 + n.step * step + at, off: t0 + n.step * step + at + tick * p.arp.gate + Math.max(0.008, p.amp.r) })
      } else out.push({ on: t0 + n.step * step, off: t0 + n.step * step + Math.max(0.01, n.len * step * p.gate) + Math.max(0.008, p.amp.r) })
    }
  })
  return out
}

/**
 * Click check on the DRY render. A hard gain step (or an oscillator stopped mid-cycle) shows up as
 * a sample-to-sample jump that is larger than anything the waveform itself does. For every note
 * edge we compare the largest |x[n]−x[n−1]| in a ±0.4 ms window around the edge with the largest
 * jump in the surrounding 40 ms of steady sound. Ratio ≤ 1 means the edge is no sharper than the
 * waveform; > 1.25 is flagged as a click. Release residual: the output 0.5–2 ms after a note's
 * envelope has finished must be ~0 (relative to the phrase peak) when nothing else is sounding.
 */
function clickScore(dry: AudioBuffer, times: { on: number; off: number }[]) {
  const d = dry.getChannelData(0)
  const at = (t: number) => Math.max(1, Math.min(d.length - 1, Math.floor(t * SR)))
  const jump = (a: number, b: number) => {
    let m = 0
    for (let i = at(a); i < at(b); i++) m = Math.max(m, Math.abs(d[i] - d[i - 1]))
    return m
  }
  const maxAbs = (a: number, b: number) => {
    let m = 0
    for (let i = at(a); i < at(b); i++) m = Math.max(m, Math.abs(d[i]))
    return m
  }
  const ref = maxAbs(0, dry.duration) || 1
  let worstEdge = 0
  for (const { on, off } of times)
    for (const e of [on, off]) {
      const edge = jump(e - 0.0004, e + 0.0004)
      const steady = Math.max(jump(e - 0.04, e - 0.0004), jump(e + 0.0004, e + 0.04))
      if (steady < ref * 0.002) continue // edge in silence on both sides → covered by the residual check
      worstEdge = Math.max(worstEdge, edge / steady)
    }
  let worstOff = 0
  for (const { off } of times) {
    if (times.some((n) => n.on <= off + 0.002 && n.off > off)) continue // another note still sounding
    worstOff = Math.max(worstOff, maxAbs(off + 0.0005, off + 0.002) / ref)
  }
  return { onsetEdge: +worstEdge.toFixed(2), releaseResidual: +worstOff.toFixed(4) }
}

export interface PresetReport {
  id: string
  name: string
  role: Role
  gain: number
  rawLufs: number
  matchedLufs: number
  target: number
  peak: number
  clipped: number
  tailDb: number
  onsetEdge: number
  releaseResidual: number
  /** Energy above 6 kHz relative to the total (dB). Harshness indicator. */
  hfDb: number
  /** Bass: energy 150 Hz–2 kHz relative to total (dB) — does it read on laptop speakers? */
  laptopDb: number
  /** Energy below 120 Hz relative to total (dB) — mud for leads/chords, weight for bass. */
  lowDb: number
  pass: boolean
  notes: string[]
}

export const QA_LIMITS = {
  peak: 0.9, // after the −1 dBFS limiter nothing should approach full scale
  tailDb: -60, // dB of the post-tail RMS (stuck-note check)
  onsetEdge: 1.25,
  releaseResidual: 0.01,
  hfDb: { lead: -14, bass: -24, chords: -18 } as Record<Role, number>,
  laptopDb: -12, // bass only
  lowDb: { lead: -20, chords: -14 } as Partial<Record<Role, number>>,
  loudnessTolerance: 0.5,
}

export async function qaPreset(p: Preset, gain?: number): Promise<PresetReport> {
  const cal = gain === undefined ? await calibrate(p) : null
  const g = gain ?? cal!.gain
  const bars = phraseBars()
  const set = solo(p.role, { kind: 'preset', preset: p, gain: g })
  const wet = await renderBars(PHRASE_KIT, bars, set)
  const dry = await renderBars(PHRASE_KIT, bars, set, { dry: true })
  const matched = cal?.matched ?? (await lufs(wet))
  const { peak, clipped } = peakOf(wet)
  const step = stepDuration(PHRASE_KIT.bpm)
  const tailFrom = Math.floor((LEAD_IN + bars.length * 16 * step + 2.2) * SR)
  const tailDb = db(energy(dry, tailFrom) / Math.max(1, dry.length - tailFrom) / 2)
  const total = energy(dry)
  const hfDb = db(energy(await band(dry, 6000, null)) / total)
  const laptopDb = db(energy(await band(dry, 150, 2000)) / total)
  const lowDb = db(energy(await band(dry, null, 120)) / total)
  const clicks = clickScore(dry, noteTimes(p.role, p))
  const notes: string[] = []
  if (peak > QA_LIMITS.peak) notes.push(`peak ${peak}`)
  if (clipped) notes.push(`${clipped} clipped samples`)
  if (tailDb > QA_LIMITS.tailDb) notes.push(`tail ${tailDb} dB (stuck note?)`)
  if (clicks.onsetEdge > QA_LIMITS.onsetEdge) notes.push(`edge jump ×${clicks.onsetEdge} (click)`)
  if (clicks.releaseResidual > QA_LIMITS.releaseResidual) notes.push(`release residual ${clicks.releaseResidual}`)
  if (hfDb > QA_LIMITS.hfDb[p.role]) notes.push(`HF ${hfDb} dB (harsh)`)
  if (p.role === 'bass' && laptopDb < QA_LIMITS.laptopDb) notes.push(`laptop band ${laptopDb} dB (vanishes on small speakers)`)
  const lowLimit = QA_LIMITS.lowDb[p.role]
  if (lowLimit !== undefined && lowDb > lowLimit) notes.push(`low end ${lowDb} dB (muddy)`)
  if (Math.abs(matched - p.loudness) > QA_LIMITS.loudnessTolerance) notes.push(`loudness ${matched} vs ${p.loudness}`)
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    gain: g,
    rawLufs: cal?.raw ?? matched,
    matchedLufs: matched,
    target: p.loudness,
    peak,
    clipped,
    tailDb,
    ...clicks,
    hfDb,
    laptopDb,
    lowDb,
    pass: notes.length === 0,
    notes,
  }
}

export async function qaAll() {
  const out: PresetReport[] = []
  for (const p of PRESETS) out.push(await qaPreset(p))
  return out
}

// ---------------------------------------------------------------- combos + WAVs

/** Two full-kit combinations: the same NEON DRIVE composition, two very different timbre sets. */
export const COMBOS: { id: string; name: string; lead: string; bass: string; chords: string }[] = [
  { id: 'console', name: 'CONSOLE (8-Bit Pulse · Chip Bass · Arcade Arp)', lead: 'pulse8', bass: 'chipbass', chords: 'arcadearp' },
  { id: 'nightdrive', name: 'NIGHT DRIVE (Neon Lead · Funk Bass · Dream Pad)', lead: 'neon', bass: 'funkbass', chords: 'dreampad' },
]

export function comboSet(c: (typeof COMBOS)[number], gains: Record<string, number>): VoiceSet {
  const v = (id: string): LayerVoice => ({ kind: 'preset', preset: presetById(id), gain: gains[id] ?? 1 })
  return { lead: v(c.lead), bass: v(c.bass), chords: v(c.chords) }
}

export async function analyseCombo(id: string | 'production', gains: Record<string, number>) {
  const kit = PHRASE_KIT
  const bars = arrangement(kit)
  const prod: VoiceSet = { lead: { kind: 'orig' }, bass: { kind: 'orig' }, chords: { kind: 'orig' } }
  const set = id === 'production' ? prod : comboSet(COMBOS.find((c) => c.id === id)!, gains)
  const full = await renderBars(kit, bars, set, { drums: true })
  const { peak, clipped } = peakOf(full)
  const stems: Record<string, number> = {}
  for (const r of ['lead', 'bass', 'chords'] as const) stems[r] = await lufs(await renderBars(kit, bars, solo(r, set[r])))
  stems.drums = await lufs(await renderBars(kit, bars, { lead: { kind: 'off' }, bass: { kind: 'off' }, chords: { kind: 'off' } }, { drums: true }))
  const step = stepDuration(kit.bpm)
  const tailFrom = Math.floor((LEAD_IN + bars.length * 16 * step + 2.2) * SR)
  return { id, seconds: +full.duration.toFixed(1), lufs: await lufs(full), peak, clipped, tailDb: db(energy(full, tailFrom) / Math.max(1, full.length - tailFrom) / 2), stemsLufs: stems }
}

export async function presetWav(id: string, gains: Record<string, number>) {
  const p = presetById(id)
  const buf = await renderBars(PHRASE_KIT, phraseBars(), solo(p.role, { kind: 'preset', preset: p, gain: gains[id] ?? 1 }))
  return { name: `${p.role}-${p.id}`, base64: toBase64(encodeWav(buf)) }
}

export async function comboWav(id: string, gains: Record<string, number>) {
  const c = COMBOS.find((x) => x.id === id)!
  const buf = await renderBars(PHRASE_KIT, arrangement(PHRASE_KIT), comboSet(c, gains), { drums: true })
  return { name: `combo-${c.id}`, base64: toBase64(encodeWav(buf)) }
}

export async function productionWav() {
  const prod: VoiceSet = { lead: { kind: 'orig' }, bass: { kind: 'orig' }, chords: { kind: 'orig' } }
  const buf = await renderBars(PHRASE_KIT, arrangement(PHRASE_KIT), prod, { drums: true })
  return { name: 'combo-production', base64: toBase64(encodeWav(buf)) }
}

/** The same spectral metrics for the current production voices (the reference the presets are judged against). */
export async function qaProduction() {
  const out: Record<string, { lufs: number; hfDb: number; laptopDb: number; lowDb: number; peak: number }> = {}
  for (const r of ['lead', 'bass', 'chords'] as const) {
    const set = solo(r, { kind: 'orig' })
    const wet = await renderBars(PHRASE_KIT, phraseBars(), set)
    const dry = await renderBars(PHRASE_KIT, phraseBars(), set, { dry: true })
    const total = energy(dry)
    out[r] = {
      lufs: await lufs(wet),
      hfDb: db(energy(await band(dry, 6000, null)) / total),
      laptopDb: db(energy(await band(dry, 150, 2000)) / total),
      lowDb: db(energy(await band(dry, null, 120)) / total),
      peak: peakOf(wet).peak,
    }
  }
  return out
}
