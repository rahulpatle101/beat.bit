// Dev-only audio verification harness (served by `pnpm dev` at /dev/audio-smoke.html; not in
// the production build). Measures real audio, not just scheduling:
//  - offlineRender(): renders one bar of drums + BIT LEAD through the real master chain in an
//    OfflineAudioContext (export-readiness proof).
//  - liveMelody(): taps the real AudioEngine's output with an AnalyserNode and measures when
//    each lead note actually sounds vs. when it was scheduled; then checks Stop silence and
//    rapid Play/Stop.

import { createMasterChain } from '@/audio/chain'
import { AudioEngine } from '@/audio/engine'
import { LEAD, playLead } from '@/audio/lead'
import { Scheduler, stepDuration } from '@/audio/scheduler'
import { VOICES, createNoiseBuffer } from '@/audio/voices'
import { PROFILES, generateMelody, midiFor } from '@/data/melody'
import { GROOVES, TRACK_IDS, emptyPattern } from '@/data/patterns'
import { encodeWav, toBase64 } from './wav'

function stats(buf: AudioBuffer) {
  const d = buf.getChannelData(0)
  let peak = 0
  let sum = 0
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i])
    if (a > peak) peak = a
    sum += d[i] * d[i]
  }
  return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4) }
}

export async function offlineRender() {
  const results: Record<string, unknown> = {}
  for (const g of GROOVES) {
    const melody = generateMelody(g.id, PROFILES[g.id].seed, g.pattern)
    const step = stepDuration(g.bpm)
    const sr = 44100
    const render = async (drums: boolean, lead: boolean) => {
      const ctx = new OfflineAudioContext({ numberOfChannels: 2, sampleRate: sr, length: Math.ceil((16 * step + 1) * sr) })
      const out = createMasterChain(ctx).input
      const noise = createNoiseBuffer(ctx)
      for (let s = 0; s < 16; s++) {
        const t = s * step
        if (drums) for (const tr of TRACK_IDS) if (g.pattern[tr][s]) VOICES[tr](ctx, out, t, noise)
        const d = melody[s]
        if (lead && d !== null) playLead(ctx, out, t, midiFor(g.id, d), step)
      }
      const t0 = performance.now()
      const buf = await ctx.startRendering()
      return { ...stats(buf), renderMs: Math.round(performance.now() - t0), seconds: +buf.duration.toFixed(2) }
    }
    results[g.name] = { drumsAndLead: await render(true, true), leadOnly: await render(false, true) }
  }
  return results
}

/** Render `bars` bars of a groove with its curated melody → base64 WAV (review listening). */
export async function renderGrooveWav(index: number, bars = 4, withMelody = true) {
  const g = GROOVES[index]
  const melody = generateMelody(g.id, PROFILES[g.id].seed, g.pattern)
  const step = stepDuration(g.bpm)
  const sr = 44100
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, sampleRate: sr, length: Math.ceil((bars * 16 * step + 1) * sr) })
  const out = createMasterChain(ctx).input
  const noise = createNoiseBuffer(ctx)
  for (let b = 0; b < bars; b++)
    for (let s = 0; s < 16; s++) {
      const t = (b * 16 + s) * step
      for (const tr of TRACK_IDS) if (g.pattern[tr][s]) VOICES[tr](ctx, out, t, noise)
      const d = melody[s]
      if (withMelody && d !== null) playLead(ctx, out, t, midiFor(g.id, d), step)
    }
  const wav = encodeWav(await ctx.startRendering())
  return { name: g.name, seed: PROFILES[g.id].seed, base64: toBase64(wav) }
}

export async function liveMelody() {
  // Capture the engine's master-chain input so an analyser can listen to the real output.
  const proto = AudioContext.prototype as AudioContext & { __orig?: () => DynamicsCompressorNode }
  let captured: DynamicsCompressorNode | null = null
  let capturedCtx: AudioContext | null = null
  const orig = proto.createDynamicsCompressor
  proto.createDynamicsCompressor = function (this: AudioContext) {
    const n = orig.call(this)
    captured = n
    // oxlint-disable-next-line no-this-alias -- intentional: capture the engine's AudioContext for the tap
    capturedCtx = this
    return n
  }
  const engine = new AudioEngine()
  const ok = await engine.unlock()
  proto.createDynamicsCompressor = orig
  if (!ok || !captured || !capturedCtx) return { error: 'audio did not start' }
  const ctx: AudioContext = capturedCtx
  const an = ctx.createAnalyser()
  an.fftSize = 256
  ;(captured as DynamicsCompressorNode).connect(an)
  const buf = new Float32Array(an.fftSize)
  const rms = () => {
    an.getFloatTimeDomainData(buf)
    let s = 0
    for (const v of buf) s += v * v
    return Math.sqrt(s / buf.length)
  }

  // Lead-only test melody on 8th notes (gaps between notes make onsets measurable).
  const notes: (number | null)[] = Array(16).fill(null)
  ;[57, 60, 62, 64, 67, 64, 62, 57].forEach((m, i) => (notes[i * 2] = m))
  const scheduled: number[] = []
  const bpm = 104
  const sched = new Scheduler({
    now: () => engine.now(),
    trigger: () => {},
    getPattern: () => emptyPattern(),
    getBpm: () => bpm,
    getMelody: () => ({ on: true, notes }),
    triggerNote: (midi, time, stepSec) => {
      scheduled.push(time)
      engine.triggerLead(midi, time, stepSec)
    },
  })

  // Poll the analyser; record the audio-clock time when RMS crosses up through a threshold.
  const onsets: number[] = []
  let above = false
  const poll = setInterval(() => {
    const r = rms()
    if (!above && r > 0.01) {
      onsets.push(ctx.currentTime)
      above = true
    } else if (above && r < 0.003) above = false
  }, 2)

  sched.start()
  await new Promise((r) => setTimeout(r, 16 * stepDuration(bpm) * 1000 * 2 + 200)) // 2 bars
  sched.stop()
  engine.cut()
  const tStop = ctx.currentTime
  await new Promise((r) => setTimeout(r, 120))
  const rmsAfterStop = rms()
  await new Promise((r) => setTimeout(r, 400))
  const rmsLater = rms()
  clearInterval(poll)

  // Match each detected onset to the nearest earlier scheduled note.
  const lags = onsets
    .map((o) => {
      const s = scheduled.filter((t) => t <= o + 0.002).at(-1)
      return s === undefined ? null : (o - s) * 1000
    })
    .filter((x): x is number => x !== null)

  // Rapid Play/Stop ×21 (ends stopped): no hanging lead notes.
  for (let i = 0; i < 21; i++) {
    if (sched.running) {
      sched.stop()
      engine.cut()
    } else sched.start()
    await new Promise((r) => setTimeout(r, 50))
  }
  if (sched.running) {
    sched.stop()
    engine.cut()
  }
  await new Promise((r) => setTimeout(r, 300))
  const rmsAfterRapid = rms()
  engine.dispose()

  return {
    scheduledNotes: scheduled.filter((t) => t < tStop).length,
    detectedOnsets: onsets.length,
    onsetLagMs: { min: +Math.min(...lags).toFixed(1), max: +Math.max(...lags).toFixed(1), mean: +(lags.reduce((a, b) => a + b, 0) / lags.length).toFixed(1) },
    analyserWindowMs: +((an.fftSize / ctx.sampleRate) * 1000).toFixed(1),
    leadPeakGain: LEAD.peak,
    rmsAfterStop: +rmsAfterStop.toFixed(5),
    rmsLater: +rmsLater.toFixed(5),
    rmsAfterRapid21: +rmsAfterRapid.toFixed(5),
  }
}
