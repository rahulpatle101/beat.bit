// One data-driven voice that plays any Preset. Takes a BaseAudioContext,
// so the identical code runs live and in OfflineAudioContext (WAV export). Click-free by
// construction: gain starts at 0, ramps up over ≥2 ms, ramps back to 0 before the oscillators stop.

import { adsr } from '@/audio/instruments'
import { midiToHz, pulseCoefficients } from '@/audio/lead'
import { createNoiseBuffer } from '@/audio/voices'
import type { Preset } from './presets'

type Ctx = BaseAudioContext

const pulseCache = new WeakMap<Ctx, Map<number, PeriodicWave>>()
function pulse(ctx: Ctx, duty: number) {
  let m = pulseCache.get(ctx)
  if (!m) pulseCache.set(ctx, (m = new Map()))
  let w = m.get(duty)
  if (!w) {
    const { real, imag } = pulseCoefficients(duty, 48)
    w = ctx.createPeriodicWave(real, imag)
    m.set(duty, w)
  }
  return w
}
const noiseCache = new WeakMap<Ctx, AudioBuffer>()
function noise(ctx: Ctx) {
  let b = noiseCache.get(ctx)
  if (!b) noiseCache.set(ctx, (b = createNoiseBuffer(ctx)))
  return b
}
const curveCache = new Map<number, Float32Array<ArrayBuffer>>()
function driveCurve(amount: number) {
  let c = curveCache.get(amount)
  if (!c) {
    c = new Float32Array(1024)
    const k = 1 + amount * 6
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1
      c[i] = Math.tanh(k * x) / Math.tanh(k)
    }
    curveCache.set(amount, c)
  }
  return c
}

export interface PlayOptions {
  /** Step length in seconds (arpeggio rate). */
  stepSec: number
  velocity?: number
  /** Loudness-match / calibration gain. */
  gain?: number
  /** Legato glide source note (if the preset has glide). */
  glideFrom?: number
}

/** Play `midis` (one note, or a chord) with preset `p` at `time` for `dur` seconds. Returns the end time. */
export function playPreset(ctx: Ctx, out: AudioNode, p: Preset, time: number, midis: number[], dur: number, o: PlayOptions): number {
  const vel = o.velocity ?? 1
  const gain = o.gain ?? 1
  if (p.arp && midis.length > 1) {
    // Arpeggio: cycle chord tones (optionally across 2 octaves) at perStep notes per step.
    const tones = [...midis].sort((a, b) => a - b)
    const seq = p.arp.octaves === 2 ? [...tones, ...tones.map((m) => m + 12)] : tones
    const order = p.arp.pattern === 'updown' ? [...seq, ...seq.slice(1, -1).reverse()] : seq
    const tick = o.stepSec / p.arp.perStep
    let end = time
    for (let k = 0, at = time; at < time + dur - 0.004; k++, at += tick) {
      end = voice(ctx, out, p, at, order[k % order.length], tick * p.arp.gate, vel, gain * 0.9, undefined, true)
    }
    return end
  }
  // Block chord: level-compensate so a 4-note chord isn't 4× louder than one note.
  const comp = 1 / Math.sqrt(midis.length)
  let end = time
  for (const m of midis) end = Math.max(end, voice(ctx, out, p, time, m, dur, vel, gain * comp, midis.length === 1 ? o.glideFrom : undefined, false))
  return end
}

function voice(ctx: Ctx, out: AudioNode, p: Preset, t: number, midi: number, dur: number, vel: number, gain: number, glideFrom: number | undefined, isArpTick: boolean): number {
  const hz = midiToHz(midi)
  const amp = ctx.createGain()
  const nodes: AudioNode[] = [amp]
  const sources: AudioScheduledSourceNode[] = []

  // Signal chain: sources → mix → [drive] → [filter] → [hp] → amp → out
  const mix = ctx.createGain()
  nodes.push(mix)
  let head: AudioNode = mix
  if (p.drive) {
    const ws = ctx.createWaveShaper()
    ws.curve = driveCurve(p.drive)
    ws.oversample = '2x'
    head.connect(ws)
    head = ws
    nodes.push(ws)
  }
  if (p.filter) {
    const f = ctx.createBiquadFilter()
    f.type = p.filter.type
    f.Q.value = p.filter.q
    const base = Math.min(16000, Math.max(40, p.filter.cutoff * (hz / 261.63) ** p.filter.keytrack))
    const fe = p.filter.env
    const hold = dur * p.gate
    const peakAt = t + Math.min(fe.a, hold)
    const susAt = Math.max(peakAt, Math.min(t + fe.a + fe.d, t + hold))
    f.frequency.setValueAtTime(base, t)
    f.frequency.linearRampToValueAtTime(base + p.filter.envAmount * vel, peakAt)
    f.frequency.linearRampToValueAtTime(base + p.filter.envAmount * vel * fe.s, susAt)
    f.frequency.setValueAtTime(base + p.filter.envAmount * vel * fe.s, t + hold)
    f.frequency.linearRampToValueAtTime(base, t + hold + fe.r)
    if (p.filter.lfo) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = p.filter.lfo.rate
      depth.gain.value = p.filter.lfo.depth
      lfo.connect(depth).connect(f.frequency)
      sources.push(lfo)
      nodes.push(depth)
    }
    head.connect(f)
    head = f
    nodes.push(f)
  }
  if (p.hp) {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = p.hp
    hp.Q.value = -3.01 // Butterworth (Web Audio high/low-pass Q is in dB)
    head.connect(hp)
    head = hp
    nodes.push(hp)
  }
  head.connect(amp).connect(out)

  // Oscillators (+ unison copies).
  const uni = p.unison && !isArpTick ? p.unison : { voices: 1, spread: 0 }
  const oscs: OscillatorNode[] = []
  for (const spec of p.oscs) {
    for (let u = 0; u < uni.voices; u++) {
      const spreadCents = uni.voices > 1 ? -uni.spread + (2 * uni.spread * u) / (uni.voices - 1) : 0
      const o = ctx.createOscillator()
      if (spec.wave === 'pulse') o.setPeriodicWave(pulse(ctx, spec.duty ?? 0.25))
      else o.type = spec.wave
      const f = hz * 2 ** (spec.octave ?? 0)
      const startF = glideFrom !== undefined && p.glide ? midiToHz(glideFrom) * 2 ** (spec.octave ?? 0) : p.pitch ? f * 2 ** (p.pitch.semitones / 12) : f
      o.frequency.setValueAtTime(startF, t)
      if (startF !== f) o.frequency.exponentialRampToValueAtTime(f, t + (glideFrom !== undefined && p.glide ? p.glide : p.pitch!.time))
      o.detune.value = (spec.detune ?? 0) + spreadCents
      const lvl = ctx.createGain()
      lvl.gain.value = spec.level / Math.sqrt(uni.voices)
      o.connect(lvl).connect(mix)
      oscs.push(o)
      sources.push(o)
      nodes.push(lvl)
    }
  }
  if (p.noise && !isArpTick) {
    const n = ctx.createBufferSource()
    n.buffer = noise(ctx)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(p.noise, t + 0.002)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    n.connect(ng).connect(mix)
    sources.push(n)
    nodes.push(ng)
  }

  // Delayed vibrato on held notes.
  if (p.vibrato && dur > p.vibrato.delay + 0.05) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = p.vibrato.rate
    depth.gain.setValueAtTime(0, t)
    depth.gain.setValueAtTime(0, t + p.vibrato.delay)
    depth.gain.linearRampToValueAtTime(p.vibrato.depth, t + p.vibrato.delay + 0.15)
    lfo.connect(depth)
    for (const o of oscs) depth.connect(o.detune)
    sources.push(lfo)
    nodes.push(depth)
  }

  // Amp envelope (attack ≥ 2 ms, release to 0 before stop → no clicks).
  const a = p.amp
  const end = adsr(amp.gain, t, 0.5 * vel * gain, Math.max(0.002, a.a), a.d, a.s, Math.max(0.01, dur * p.gate), Math.max(0.008, a.r))
  for (const s of sources) {
    s.start(t)
    s.stop(end + 0.01)
  }
  sources[0].onended = () => {
    for (const s of sources) s.disconnect()
    for (const n of nodes) n.disconnect()
  }
  return end
}
