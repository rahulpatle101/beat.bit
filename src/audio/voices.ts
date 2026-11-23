// Synthesized drum voices: a clean, analog-inspired kit (ART_DIRECTION.md, Sound identity).
// Every voice schedules its nodes at an exact AudioContext time and cleans up after itself.

import type { TrackId } from '@/data/patterns'

export type Voice = (ctx: BaseAudioContext, out: AudioNode, time: number, noise: AudioBuffer) => void

/** One second of white noise, shared by every noise-based voice. */
export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function noiseSource(ctx: BaseAudioContext, noise: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noise
  return src
}

/** Fast attack, exponential decay to silence. */
function envelope(g: GainNode, time: number, peak: number, decay: number, attack = 0.002) {
  g.gain.setValueAtTime(0, time)
  g.gain.linearRampToValueAtTime(peak, time + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay)
}

/** Disconnect the graph once the source finishes, so nodes can be collected. */
function cleanupOnEnd(src: AudioScheduledSourceNode, ...nodes: AudioNode[]) {
  src.onended = () => {
    src.disconnect()
    for (const n of nodes) n.disconnect()
  }
}

// Kick: sine with a fast downward pitch sweep (~150 → 45 Hz) and a short click on top.
const kick: Voice = (ctx, out, t, noise) => {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, t)
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  envelope(amp, t, 1.0, 0.42)
  osc.connect(amp).connect(out)
  osc.start(t)
  osc.stop(t + 0.5)
  cleanupOnEnd(osc, amp)

  // Click: a tiny burst of high-passed noise for definition on small speakers.
  const click = noiseSource(ctx, noise)
  const hp = ctx.createBiquadFilter()
  const clickAmp = ctx.createGain()
  hp.type = 'highpass'
  hp.frequency.value = 3000
  envelope(clickAmp, t, 0.25, 0.006, 0.0005)
  click.connect(hp).connect(clickAmp).connect(out)
  click.start(t)
  click.stop(t + 0.02)
  cleanupOnEnd(click, hp, clickAmp)
}

// Snare: high-passed noise ("wires") plus a short tonal body around 180 Hz.
const snare: Voice = (ctx, out, t, noise) => {
  const n = noiseSource(ctx, noise)
  const hp = ctx.createBiquadFilter()
  const nAmp = ctx.createGain()
  hp.type = 'highpass'
  hp.frequency.value = 1200
  envelope(nAmp, t, 0.55, 0.17)
  n.connect(hp).connect(nAmp).connect(out)
  n.start(t)
  n.stop(t + 0.25)
  cleanupOnEnd(n, hp, nAmp)

  const body = ctx.createOscillator()
  const bAmp = ctx.createGain()
  body.type = 'triangle'
  body.frequency.setValueAtTime(190, t)
  body.frequency.exponentialRampToValueAtTime(150, t + 0.08)
  envelope(bAmp, t, 0.55, 0.09)
  body.connect(bAmp).connect(out)
  body.start(t)
  body.stop(t + 0.15)
  cleanupOnEnd(body, bAmp)
}

// Hi-hat: six detuned square oscillators (metallic) through band + high-pass, very short.
const HAT_RATIOS = [2, 3, 4.16, 5.43, 6.79, 8.21]
const hat: Voice = (ctx, out, t) => {
  const bp = ctx.createBiquadFilter()
  const hp = ctx.createBiquadFilter()
  const amp = ctx.createGain()
  bp.type = 'bandpass'
  bp.frequency.value = 10000
  hp.type = 'highpass'
  hp.frequency.value = 7000
  envelope(amp, t, 0.22, 0.045, 0.001)
  bp.connect(hp).connect(amp).connect(out)

  const end = t + 0.08
  HAT_RATIOS.forEach((ratio, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 40 * ratio
    osc.connect(bp)
    osc.start(t)
    osc.stop(end)
    // The last oscillator to end tears down the shared filter chain.
    if (i === HAT_RATIOS.length - 1) cleanupOnEnd(osc, bp, hp, amp)
    else osc.onended = () => osc.disconnect()
  })
}

// Clap: band-passed noise retriggered three times ~10 ms apart, then a longer tail.
const clap: Voice = (ctx, out, t, noise) => {
  const n = noiseSource(ctx, noise)
  const bp = ctx.createBiquadFilter()
  const amp = ctx.createGain()
  bp.type = 'bandpass'
  bp.frequency.value = 1300
  bp.Q.value = 1.2

  const g = amp.gain
  g.setValueAtTime(0, t)
  for (let i = 0; i < 3; i++) {
    const bt = t + i * 0.011
    g.setValueAtTime(0.75, bt)
    g.exponentialRampToValueAtTime(0.08, bt + 0.009)
  }
  const tail = t + 0.033
  g.setValueAtTime(0.6, tail)
  g.exponentialRampToValueAtTime(0.0001, tail + 0.2)

  n.connect(bp).connect(amp).connect(out)
  n.start(t)
  n.stop(tail + 0.25)
  cleanupOnEnd(n, bp, amp)
}

export const VOICES: Record<TrackId, Voice> = { kick, snare, hat, clap }
