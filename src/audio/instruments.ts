// Kit instruments (MUSIC_DIRECTION.md §5): velocity drums + open hat/crash/shaker/toms, four
// bass presets, four chord presets, five lead presets, and the mix (role buses + delay/reverb).
// Promoted from the V2.3b preview prototypes. Every voice takes a BaseAudioContext (offline
// render ready), schedules nodes at exact times, and has a fixed stop time (no stuck notes).

import { midiToHz, pulseCoefficients } from '@/audio/lead'
import { VOICES } from '@/audio/voices'
import type { TrackId } from '@/data/patterns'

type Ctx = BaseAudioContext

// ---------- helpers ----------

const pulseWaves = new WeakMap<Ctx, Map<number, PeriodicWave>>()
function pulse(ctx: Ctx, duty: number): PeriodicWave {
  let m = pulseWaves.get(ctx)
  if (!m) pulseWaves.set(ctx, (m = new Map()))
  let w = m.get(duty)
  if (!w) {
    const { real, imag } = pulseCoefficients(duty, 32)
    w = ctx.createPeriodicWave(real, imag)
    m.set(duty, w)
  }
  return w
}

type Wave = OscillatorType | 'pulse25' | 'pulse12'
function osc(ctx: Ctx, wave: Wave, hz: number, t: number, detuneCents = 0): OscillatorNode {
  const o = ctx.createOscillator()
  if (wave === 'pulse25') o.setPeriodicWave(pulse(ctx, 0.25))
  else if (wave === 'pulse12') o.setPeriodicWave(pulse(ctx, 0.125))
  else o.type = wave
  o.frequency.setValueAtTime(hz, t)
  o.detune.value = detuneCents
  return o
}

/** ADSR on a gain param with a fixed hold; robust when hold < attack + decay. */
export function adsr(g: AudioParam, t: number, peak: number, a: number, d: number, s: number, hold: number, r: number) {
  const peakAt = t + Math.min(a, hold)
  const susAt = Math.max(peakAt, Math.min(t + a + d, t + hold))
  g.setValueAtTime(0, t)
  g.linearRampToValueAtTime(peak, peakAt)
  g.linearRampToValueAtTime(peak * s, susAt)
  g.setValueAtTime(peak * s, t + hold)
  g.linearRampToValueAtTime(0, t + hold + r)
  return t + hold + r
}

function endAfter(src: AudioScheduledSourceNode[], end: number, ...nodes: AudioNode[]) {
  src.forEach((s) => s.stop(end + 0.01))
  src[0].onended = () => {
    src.forEach((s) => s.disconnect())
    nodes.forEach((n) => n.disconnect())
  }
}

// ---------- drums ----------

/** Existing V1 drum voice with a velocity gain. */
export function drum(ctx: Ctx, out: AudioNode, track: TrackId, t: number, vel: number, noise: AudioBuffer) {
  const g = ctx.createGain()
  g.gain.value = vel
  g.connect(out)
  VOICES[track](ctx, g, t, noise)
}

function noiseHit(ctx: Ctx, out: AudioNode, t: number, noise: AudioBuffer, hp: number, bp: number | null, peak: number, decay: number) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const h = ctx.createBiquadFilter()
  h.type = 'highpass'
  h.frequency.value = hp
  const g = ctx.createGain()
  let chain: AudioNode = src.connect(h)
  if (bp) {
    const b = ctx.createBiquadFilter()
    b.type = 'bandpass'
    b.frequency.value = bp
    b.Q.value = 0.8
    chain = chain.connect(b)
  }
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  chain.connect(g).connect(out)
  src.start(t)
  endAfter([src], t + decay, h, g)
}

export const openHat = (ctx: Ctx, out: AudioNode, t: number, vel: number, noise: AudioBuffer) =>
  noiseHit(ctx, out, t, noise, 7500, 10000, 0.22 * vel, 0.28)
export const crash = (ctx: Ctx, out: AudioNode, t: number, vel: number, noise: AudioBuffer) =>
  noiseHit(ctx, out, t, noise, 3500, null, 0.2 * vel, 1.8)
export const shaker = (ctx: Ctx, out: AudioNode, t: number, vel: number, noise: AudioBuffer) =>
  noiseHit(ctx, out, t, noise, 6000, 8000, 0.12 * vel, 0.06)

/** Synth tom: sine with a short downward pitch sweep. */
export function tom(ctx: Ctx, out: AudioNode, t: number, midi: number, vel: number) {
  const hz = midiToHz(midi)
  const o = osc(ctx, 'sine', hz * 1.6, t)
  o.frequency.exponentialRampToValueAtTime(hz, t + 0.09)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.55 * vel, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  o.connect(g).connect(out)
  o.start(t)
  endAfter([o], t + 0.32, g)
}

// ---------- bass ----------

export type BassPreset = 'funk' | 'chip' | 'house' | 'drive'

export function bass(ctx: Ctx, out: AudioNode, t: number, midi: number, dur: number, vel: number, preset: BassPreset) {
  const hz = midiToHz(midi)
  const g = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  let srcs: OscillatorNode[] = []
  let end = t + dur
  switch (preset) {
    case 'funk': {
      // Plucky synth-funk: saw + square, resonant filter "pop".
      srcs = [osc(ctx, 'sawtooth', hz, t), osc(ctx, 'square', hz, t, -6)]
      lp.Q.value = 7
      lp.frequency.setValueAtTime(260, t)
      lp.frequency.linearRampToValueAtTime(1500, t + 0.012)
      lp.frequency.exponentialRampToValueAtTime(360, t + 0.16)
      end = adsr(g.gain, t, 0.2 * vel, 0.004, 0.12, 0.65, dur * 0.9, 0.04)
      break
    }
    case 'chip': {
      // NES-style triangle: pure and bouncy.
      srcs = [osc(ctx, 'triangle', hz, t)]
      lp.frequency.value = 6000
      end = adsr(g.gain, t, 0.5 * vel, 0.002, 0.02, 0.9, dur * 0.85, 0.02)
      break
    }
    case 'house': {
      // Short offbeat bass: sine sub + filtered saw.
      srcs = [osc(ctx, 'sine', hz, t), osc(ctx, 'sawtooth', hz, t)]
      lp.Q.value = 3
      lp.frequency.setValueAtTime(900, t)
      lp.frequency.exponentialRampToValueAtTime(320, t + 0.12)
      end = adsr(g.gain, t, 0.24 * vel, 0.003, 0.09, 0.5, dur * 0.8, 0.03)
      break
    }
    case 'drive': {
      // Driving minor-key bass: two detuned saws, steady filter.
      srcs = [osc(ctx, 'sawtooth', hz, t, -7), osc(ctx, 'sawtooth', hz, t, 7)]
      lp.Q.value = 4
      lp.frequency.setValueAtTime(1300, t)
      lp.frequency.exponentialRampToValueAtTime(650, t + 0.1)
      end = adsr(g.gain, t, 0.15 * vel, 0.003, 0.08, 0.8, dur * 0.9, 0.03)
      break
    }
  }
  srcs.forEach((s) => s.connect(lp))
  lp.connect(g).connect(out)
  srcs.forEach((s) => s.start(t))
  endAfter(srcs, end, lp, g)
}

// ---------- chords ----------

export type ChordPreset = 'stab' | 'pad' | 'chipArp' | 'riff'

export function chord(ctx: Ctx, out: AudioNode, t: number, midis: number[], dur: number, vel: number, preset: ChordPreset, stepSec: number) {
  if (preset === 'chipArp') {
    // Classic chiptune chord: cycle the chord tones every 1/32 note on a square.
    const tick = stepSec / 2
    for (let k = 0, at = t; at < t + dur - 0.005; k++, at += tick) chipNote(ctx, out, at, midis[k % midis.length], tick * 0.9, 0.06 * vel)
    return
  }
  for (const m of midis) {
    const hz = midiToHz(m)
    const g = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    let srcs: OscillatorNode[]
    let end: number
    if (preset === 'stab') {
      srcs = [osc(ctx, 'sawtooth', hz, t, -8), osc(ctx, 'sawtooth', hz, t, 8)]
      lp.Q.value = 2
      lp.frequency.setValueAtTime(3200, t)
      lp.frequency.exponentialRampToValueAtTime(700, t + 0.14)
      end = adsr(g.gain, t, 0.06 * vel, 0.003, 0.12, 0.25, Math.max(0.06, dur * 0.8), 0.06)
    } else if (preset === 'riff') {
      srcs = [osc(ctx, 'square', hz, t), osc(ctx, 'sawtooth', hz, t, 12)]
      lp.Q.value = 6
      lp.frequency.setValueAtTime(2400 * vel + 500, t)
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.1)
      end = adsr(g.gain, t, 0.05, 0.002, 0.08, 0.2, Math.max(0.05, dur * 0.7), 0.04)
    } else {
      srcs = [osc(ctx, 'sawtooth', hz, t, -10), osc(ctx, 'sawtooth', hz, t, 10), osc(ctx, 'triangle', hz / 2, t)]
      lp.frequency.value = 1300
      end = adsr(g.gain, t, 0.022 * vel, 0.25, 0.4, 0.8, dur, 0.5)
    }
    srcs.forEach((s) => s.connect(lp))
    lp.connect(g).connect(out)
    srcs.forEach((s) => s.start(t))
    endAfter(srcs, end, lp, g)
  }
}

function chipNote(ctx: Ctx, out: AudioNode, t: number, midi: number, dur: number, peak: number) {
  const o = osc(ctx, 'square', midiToHz(midi), t)
  const g = ctx.createGain()
  const end = adsr(g.gain, t, peak, 0.001, 0.01, 0.8, dur, 0.005)
  o.connect(g).connect(out)
  o.start(t)
  endAfter([o], end, g)
}

// ---------- leads ----------

export type LeadPreset = 'warm' | 'pulse25' | 'pulse12' | 'riff' | 'hero'

export function lead(ctx: Ctx, out: AudioNode, t: number, midi: number, dur: number, vel: number, preset: LeadPreset, glideFrom?: number) {
  const hz = midiToHz(midi)
  const g = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  const waves: Wave[] =
    preset === 'warm' ? ['sawtooth', 'square'] : preset === 'pulse25' ? ['pulse25'] : preset === 'pulse12' ? ['pulse12'] : preset === 'hero' ? ['sawtooth', 'sawtooth'] : ['square']
  const srcs = waves.map((w, i) => osc(ctx, w, glideFrom ? midiToHz(glideFrom) : hz, t, waves.length > 1 ? (i ? 9 : -9) : 0))
  if (glideFrom) srcs.forEach((s) => s.frequency.exponentialRampToValueAtTime(hz, t + 0.045))
  lp.frequency.value = preset === 'warm' ? 2600 : preset === 'hero' ? 3400 : 7000
  lp.Q.value = preset === 'warm' ? 1.5 : 0.7
  // Delayed vibrato on held notes (classic lead expression).
  if (dur > 0.22) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 5.6
    depth.gain.setValueAtTime(0, t)
    depth.gain.setValueAtTime(0, t + 0.15)
    depth.gain.linearRampToValueAtTime(preset === 'pulse12' || preset === 'pulse25' ? 18 : 12, t + 0.3)
    lfo.connect(depth)
    srcs.forEach((s) => depth.connect(s.detune))
    lfo.start(t)
    lfo.stop(t + dur + 0.2)
    lfo.onended = () => {
      lfo.disconnect()
      depth.disconnect()
    }
  }
  const peak = (preset === 'warm' ? 0.075 : preset === 'hero' ? 0.075 : preset === 'riff' ? 0.06 : 0.1) * vel
  const end = adsr(g.gain, t, peak, 0.006, 0.09, 0.7, dur * 0.92, preset === 'warm' || preset === 'hero' ? 0.09 : 0.03)
  srcs.forEach((s) => s.connect(lp))
  lp.connect(g).connect(out)
  srcs.forEach((s) => s.start(t))
  endAfter(srcs, end, lp, g)
}

// ---------- mix + effects ----------

export interface Mix {
  drums: GainNode
  bass: GainNode
  chords: GainNode
  lead: GainNode
  /** Dotted-8th delay; update with setDelayTempo when the BPM changes. */
  delay: DelayNode
}

/** Keep the delay locked to a dotted 8th (3 steps) at the current tempo. */
export function setDelayTempo(mix: Mix, stepSec: number, at: number) {
  mix.delay.delayTime.setTargetAtTime(stepSec * 3, at, 0.05)
}

/** Group buses + a tempo-synced delay and a small generated reverb (sends from chords/lead). */
export function createMix(ctx: Ctx, master: AudioNode, stepSec: number): Mix {
  const bus = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    g.connect(master)
    return g
  }
  const roles = { drums: bus(0.95), bass: bus(0.6), chords: bus(0.9), lead: bus(0.95) }

  // Dotted-8th delay (3 steps), filtered feedback.
  const delay = ctx.createDelay(2)
  delay.delayTime.value = stepSec * 3
  const mix: Mix = { ...roles, delay }
  const fb = ctx.createGain()
  fb.gain.value = 0.32
  const dlp = ctx.createBiquadFilter()
  dlp.type = 'lowpass'
  dlp.frequency.value = 2800
  const wet = ctx.createGain()
  wet.gain.value = 0.22
  delay.connect(dlp).connect(fb).connect(delay)
  dlp.connect(wet).connect(master)
  const dSend = ctx.createGain()
  dSend.gain.value = 0.35
  mix.lead.connect(dSend).connect(delay)

  // Generated stereo reverb impulse (~1.8 s), mostly for chords/lead.
  const len = Math.floor(ctx.sampleRate * 1.8)
  const ir = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3
  }
  const verb = ctx.createConvolver()
  verb.buffer = ir
  const vWet = ctx.createGain()
  vWet.gain.value = 0.18
  verb.connect(vWet).connect(master)
  const cSend = ctx.createGain()
  cSend.gain.value = 0.5
  mix.chords.connect(cSend).connect(verb)
  const lSend = ctx.createGain()
  lSend.gain.value = 0.25
  mix.lead.connect(lSend).connect(verb)
  return mix
}
