// BIT LEAD: a monophonic chiptune lead (V2.3, V2_3_MELODY_PROPOSAL.md §1).
// 25% pulse wave via PeriodicWave (oscillators have no pulse-width parameter), a short
// plucky envelope, one note per step. Written against BaseAudioContext so the same voice
// renders in an OfflineAudioContext for future export.

export const LEAD = {
  duty: 0.25,
  harmonics: 32,
  attack: 0.003, // s
  decay: 0.07, // s, down to sustain
  sustain: 0.55, // × peak
  release: 0.04, // s
  peak: 0.16, // sits under the drum kit
  gate: 0.85, // note length as a fraction of one step
}

/** Fourier series of a pulse wave with duty d: real[n] = 2/(nπ)·sin(nπd), imag = 0. */
export function pulseCoefficients(duty = LEAD.duty, harmonics = LEAD.harmonics) {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  return { real, imag }
}

// One PeriodicWave per context (they can't be shared across contexts).
const waves = new WeakMap<BaseAudioContext, PeriodicWave>()
function pulseWave(ctx: BaseAudioContext): PeriodicWave {
  let w = waves.get(ctx)
  if (!w) {
    const { real, imag } = pulseCoefficients()
    w = ctx.createPeriodicWave(real, imag)
    waves.set(ctx, w)
  }
  return w
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** Times of the envelope breakpoints for a note starting at `time` (pure, unit-tested). */
export function leadEnvelope(time: number, stepSec: number) {
  const hold = stepSec * LEAD.gate
  const peakAt = time + Math.min(LEAD.attack, hold)
  const sustainAt = Math.max(peakAt, Math.min(time + LEAD.attack + LEAD.decay, time + hold))
  const releaseAt = time + hold
  const endAt = releaseAt + LEAD.release
  return { peakAt, sustainAt, releaseAt, endAt }
}

/** Play one lead note. The graph disconnects itself when the note ends. */
export function playLead(ctx: BaseAudioContext, out: AudioNode, time: number, midi: number, stepSec: number) {
  const { peakAt, sustainAt, releaseAt, endAt } = leadEnvelope(time, stepSec)
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.setPeriodicWave(pulseWave(ctx))
  osc.frequency.setValueAtTime(midiToHz(midi), time)

  const g = amp.gain
  g.setValueAtTime(0, time)
  g.linearRampToValueAtTime(LEAD.peak, peakAt)
  g.linearRampToValueAtTime(LEAD.peak * LEAD.sustain, sustainAt)
  g.setValueAtTime(LEAD.peak * LEAD.sustain, releaseAt)
  g.linearRampToValueAtTime(0, endAt) // de-clicked release

  osc.connect(amp).connect(out)
  osc.start(time)
  osc.stop(endAt + 0.005)
  osc.onended = () => {
    osc.disconnect()
    amp.disconnect()
  }
}
