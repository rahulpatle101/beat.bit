// DEV-ONLY: renders a composed kit (all sections) offline through the real master chain,
// and measures it objectively (clipping, per-section loudness, stem balance, tail silence).

import { createMasterChain } from '@/audio/chain'
import { stepDuration } from '@/audio/scheduler'
import { createNoiseBuffer } from '@/audio/voices'
import { encodeWav, toBase64 } from '../wav'
import { KITS, type Kit } from '@/data/kits'
import { createMix, drum } from '@/audio/instruments'
import { drumVel, playKitStep } from '@/audio/kitPlayer'

type Stem = 'all' | 'drums' | 'bass' | 'chords' | 'lead'
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
  // Stem renders mute the other role buses (FX sends follow their role bus).
  if (stem !== 'all') for (const r of ['drums', 'bass', 'chords', 'lead'] as const) if (r !== stem) mix[r].gain.value = 0

  bars.forEach(({ bar }, bi) => {
    const t0 = LEAD_IN + bi * 16 * step
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * step
      // The four grid drums (kick/snare/hat/clap) with their composed velocities…
      for (const key of ['kick', 'snare', 'hat', 'clap'] as const) {
        const v = drumVel(bar.drums[key], s)
        if (v) drum(ctx, mix.drums, key, t, v, noise)
      }
      // …and every other layer through the shared kit player (same code path as the app).
      playKitStep({ ctx, mix, noise }, kit, bar, s, t, step)
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
