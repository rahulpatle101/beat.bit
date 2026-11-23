// DEV-ONLY: renders a composed kit (all sections) offline through the real master chain,
// and measures it objectively (clipping, per-section loudness, stem balance, tail silence).

import { createMasterChain } from '@/audio/chain'
import { stepDuration } from '@/audio/scheduler'
import { createNoiseBuffer } from '@/audio/voices'
import { encodeWav, toBase64 } from '../wav'
import { KITS, type Kit } from './kits'
import { bass, chord, crash, createMix, drum, lead, openHat, shaker, tom } from './synths'

type Stem = 'all' | 'drums' | 'bass' | 'chords' | 'lead'
const VEL: Record<string, number> = { x: 1, o: 0.65, '-': 0.35 }
const LEAD_IN = 0.05
const TAIL = 2.0
const SR = 44100

export function kitBars(kit: Kit) {
  return kit.sections.flatMap((s) => s.bars.map((b) => ({ section: s.name, bar: b })))
}

export async function renderKit(kit: Kit, stem: Stem = 'all'): Promise<AudioBuffer> {
  const step = stepDuration(kit.bpm)
  const bars = kitBars(kit)
  const length = Math.ceil((LEAD_IN + bars.length * 16 * step + TAIL) * SR)
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, sampleRate: SR, length })
  const master = createMasterChain(ctx).input
  const mix = createMix(ctx, master, step)
  const noise = createNoiseBuffer(ctx)
  const on = (s: Stem) => stem === 'all' || stem === s

  bars.forEach(({ bar }, bi) => {
    const t0 = LEAD_IN + bi * 16 * step
    const at = (s: number) => t0 + s * step
    if (on('drums')) {
      for (const [key, pat] of Object.entries(bar.drums)) {
        ;[...(pat ?? '')].forEach((ch, s) => {
          const v = VEL[ch]
          if (!v) return
          if (key === 'ohat') openHat(ctx, mix.drums, at(s), v, noise)
          else if (key === 'crash') crash(ctx, mix.drums, at(s), v, noise)
          else if (key === 'shaker') shaker(ctx, mix.drums, at(s), v, noise)
          else drum(ctx, mix.drums, key as 'kick' | 'snare' | 'hat' | 'clap', at(s), v, noise)
        })
      }
      for (const n of bar.toms ?? []) tom(ctx, mix.drums, at(n.step), n.midi, n.vel)
    }
    if (on('bass')) for (const n of bar.bass ?? []) bass(ctx, mix.bass, at(n.step), n.midi, n.len * step, n.vel, kit.presets.bass)
    if (on('chords')) {
      for (const c of bar.chords ?? []) chord(ctx, mix.chords, at(c.step), c.midis, c.len * step, c.vel, kit.presets.chords, step)
      for (const c of bar.riff ?? []) chord(ctx, mix.chords, at(c.step), c.midis, c.len * step, (bar.riffBright ?? 0.5) * c.vel, 'riff', step)
    }
    if (on('lead')) {
      const play = (notes: typeof bar.lead, preset: typeof kit.presets.lead) => {
        let prev: { end: number; midi: number } | null = null
        for (const n of notes ?? []) {
          const glide = prev && Math.abs(prev.end - n.step) < 0.01 && Math.abs(prev.midi - n.midi) <= 3 && (preset === 'warm' || preset === 'hero') ? prev.midi : undefined
          lead(ctx, mix.lead, at(n.step), n.midi, n.len * step, n.vel, preset, glide)
          prev = { end: n.step + n.len, midi: n.midi }
        }
      }
      play(bar.lead, kit.presets.lead)
      play(bar.lead2, kit.presets.lead2 ?? kit.presets.lead)
    }
  })
  return ctx.startRendering()
}

function rms(d: Float32Array, a: number, b: number) {
  let s = 0
  for (let i = a; i < b; i++) s += d[i] * d[i]
  return Math.sqrt(s / Math.max(1, b - a))
}
const db = (x: number) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1)

export async function analyseKit(kit: Kit) {
  const step = stepDuration(kit.bpm)
  const full = await renderKit(kit)
  const d = full.getChannelData(0)
  let peak = 0
  let clipped = 0
  for (const v of d) {
    const a = Math.abs(v)
    if (a > peak) peak = a
    if (a >= 0.99) clipped++
  }
  // Per-section loudness (dBFS RMS).
  const sections: Record<string, number> = {}
  let barIdx = 0
  for (const s of kit.sections) {
    const a = Math.floor((LEAD_IN + barIdx * 16 * step) * SR)
    barIdx += s.bars.length
    const b = Math.floor((LEAD_IN + barIdx * 16 * step) * SR)
    sections[s.name] = db(rms(d, a, b))
  }
  // Tail: after the end bar's notes, everything must have decayed (no stuck notes).
  const tailStart = Math.floor((LEAD_IN + barIdx * 16 * step + 1.4) * SR)
  const tailRms = db(rms(d, tailStart, d.length))
  // Stem balance (dBFS RMS over the whole piece).
  const stems: Record<string, number> = {}
  for (const s of ['drums', 'bass', 'chords', 'lead'] as const) {
    const b = await renderKit(kit, s)
    const sd = b.getChannelData(0)
    stems[s] = db(rms(sd, 0, sd.length))
  }
  return {
    name: kit.name,
    bpm: kit.bpm,
    key: kit.key,
    seconds: +full.duration.toFixed(1),
    bars: kitBars(kit).length,
    peak: +peak.toFixed(3),
    clippedSamples: clipped,
    sectionsDb: sections,
    tailDb: tailRms,
    stemsDb: stems,
  }
}

export async function analyseAll() {
  const out = []
  for (const k of KITS) out.push(await analyseKit(k))
  return out
}

export async function kitWav(index: number) {
  const kit = KITS[index]
  const buf = await renderKit(kit)
  return { name: kit.name, base64: toBase64(encodeWav(buf)) }
}
