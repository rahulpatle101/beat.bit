// DOWNLOAD BEAT: pure timing and naming rules (no Web Audio here, so they are unit-tested).

import { stepDuration } from '@/audio/scheduler'
import { clampBpm } from '@/data/patterns'

export const EXPORT_BAR_OPTIONS = [4, 8, 16] as const
export type ExportBars = (typeof EXPORT_BAR_OPTIONS)[number]
export const DEFAULT_EXPORT_BARS: ExportBars = 8
export const EXPORT_SAMPLE_RATE = 44100
export const EXPORT_CHANNELS = 2

/** Minimum tail after the last bar: Dream Pad release (0.8 s) + most of the 1.8 s reverb. */
export const MIN_TAIL_SEC = 2.5
/** Dotted-8th delay repeats allowed to ring out (each is −9.9 dB; the first is ≈ −22 dB). */
const DELAY_REPEATS = 5

/**
 * Tail length for a tempo: at least MIN_TAIL_SEC; at slow tempos long enough for five delay
 * repeats (3 steps each) plus 0.5 s, so the echo of the last lead note isn't cut off.
 */
export function tailSeconds(bpm: number): number {
  return Math.max(MIN_TAIL_SEC, DELAY_REPEATS * 3 * stepDuration(bpm) + 0.5)
}

export interface ExportTiming {
  bpm: number
  bars: number
  stepSec: number
  barSec: number
  /** Length of the complete bars (bar 1 starts at 0 s). */
  musicSec: number
  tailSec: number
  totalSec: number
  /** Frames in the rendered buffer (music + tail, rounded up). */
  frames: number
  sampleRate: number
}

export function exportTiming(bpm: number, bars: number, sampleRate = EXPORT_SAMPLE_RATE): ExportTiming {
  const b = clampBpm(bpm)
  const stepSec = stepDuration(b)
  const barSec = stepSec * 16
  const musicSec = barSec * bars
  const tailSec = tailSeconds(b)
  const frames = Math.ceil((musicSec + tailSec) * sampleRate)
  return { bpm: b, bars, stepSec, barSec, musicSec, tailSec, totalSec: frames / sampleRate, frames, sampleRate }
}

/** WAV byte size (16-bit PCM, 44-byte header). */
export const wavBytes = (frames: number, channels = EXPORT_CHANNELS) => 44 + frames * channels * 2

/** e.g. beatbit-neon-drive-108bpm-8bars.wav */
export function exportFilename(kitName: string, bpm: number, bars: number): string {
  const slug =
    kitName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'beat'
  return `beatbit-${slug}-${clampBpm(bpm)}bpm-${bars}bars.wav`
}

/** "17.1 s" / "1:08" style label for the panel. */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)} s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec - m * 60)
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`
}
