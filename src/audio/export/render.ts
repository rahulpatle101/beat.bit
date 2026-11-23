// DOWNLOAD BEAT: renders the current Sandbox beat offline through the same voices, mix buses and
// master chain as live playback (createMix + createMasterChain + drum + playKitStep), using the
// same sandbox rules (src/audio/sandbox.ts). Nothing is recorded from a device.

import { createMasterChain } from '@/audio/chain'
import { createMix, drum } from '@/audio/instruments'
import { playKitStep, type Voices } from '@/audio/kitPlayer'
import { sandboxDrumVel, sandboxLayerBar } from '@/audio/sandbox'
import { createNoiseBuffer } from '@/audio/voices'
import { kitById, type Bar, type KitId } from '@/data/kits'
import { STEPS, TRACK_IDS, clonePattern, type Pattern } from '@/data/patterns'
import { EXPORT_CHANNELS, EXPORT_SAMPLE_RATE, exportTiming, type ExportTiming } from './beatFile'

/** The Sandbox state an export captures (taken at the moment DOWNLOAD WAV is pressed). */
export interface BeatSnapshot {
  kitId: KitId
  pattern: Pattern
  bpm: number
  /** The looping backing bars, if they differ from the kit's composed MAIN section. */
  mainBars?: readonly Bar[]
}

export interface RenderOptions {
  /** 0..1 while rendering (per bar where the browser supports OfflineAudioContext.suspend). */
  onProgress?: (fraction: number) => void
  sampleRate?: number
}

export interface RenderResult {
  buffer: AudioBuffer
  timing: ExportTiming
}

/**
 * Silent pre-roll rendered before bar 1 and trimmed off. The master compressor/limiter start in an
 * un-settled state; a downbeat at t = 0 came out 2.7 dB quieter than in live playback (which always
 * starts 50 ms after the context is already running). With the pre-roll the first hit matches live.
 */
export const PREROLL_SEC = 0.05

export async function renderBeat(snap: BeatSnapshot, bars: number, opts: RenderOptions = {}): Promise<RenderResult> {
  const kit = kitById(snap.kitId)
  const pattern = clonePattern(snap.pattern)
  const timing = exportTiming(snap.bpm, bars, opts.sampleRate ?? EXPORT_SAMPLE_RATE)
  const { stepSec, barSec, frames, sampleRate } = timing

  const preFrames = Math.round(PREROLL_SEC * sampleRate)
  const pre = preFrames / sampleRate
  const ctx = new OfflineAudioContext({ numberOfChannels: EXPORT_CHANNELS, sampleRate, length: preFrames + frames })
  const mix = createMix(ctx, createMasterChain(ctx).input, stepSec)
  const voices: Voices = { ctx, mix, noise: createNoiseBuffer(ctx) }

  // One sandbox bar: grid drums at their sandbox velocities + the kit's main-section layers.
  const scheduled: boolean[] = Array(bars).fill(false)
  const scheduleBar = (bar: number) => {
    if (bar >= bars || scheduled[bar]) return
    scheduled[bar] = true
    const layer = sandboxLayerBar(kit, bar, snap.mainBars)
    for (let s = 0; s < STEPS; s++) {
      const t = pre + (bar * STEPS + s) * stepSec
      for (const track of TRACK_IDS) if (pattern[track][s]) drum(ctx, mix.drums, track, t, sandboxDrumVel(kit, track, s), voices.noise)
      if (layer) playKitStep(voices, kit, layer, s, t, stepSec)
    }
  }

  const report = (f: number) => opts.onProgress?.(Math.min(1, Math.max(0, f)))
  report(0)
  // Schedule incrementally (one bar ahead) when suspend() is available: it keeps main-thread work
  // small (live playback keeps running smoothly) and gives real progress. Otherwise, all at once.
  const scheduleAll = () => {
    for (let b = 0; b < bars; b++) scheduleBar(b)
  }
  const canSuspend = typeof ctx.suspend === 'function'
  if (canSuspend && bars > 1) {
    scheduleBar(0)
    scheduleBar(1)
    try {
      for (let b = 1; b < bars; b++) {
        ctx.suspend(pre + b * barSec).then(
          () => {
            scheduleBar(b + 1)
            report(b / bars)
            return ctx.resume()
          },
          // A refused suspend point: schedule everything left now rather than drop notes.
          scheduleAll,
        )
      }
    } catch {
      scheduleAll()
    }
  } else scheduleAll()

  const rendered = await ctx.startRendering()
  // Never hand out a file with missing bars.
  if (scheduled.some((s) => !s)) throw new Error('Export incomplete: not every bar was scheduled')
  // Trim the pre-roll (a copy, no gain change): the file starts exactly on bar 1's downbeat.
  const buffer = new AudioBuffer({ numberOfChannels: rendered.numberOfChannels, length: frames, sampleRate })
  for (let c = 0; c < rendered.numberOfChannels; c++) buffer.copyToChannel(rendered.getChannelData(c).subarray(preFrames, preFrames + frames), c)
  report(1)
  return { buffer, timing }
}
