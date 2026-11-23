import { describe, expect, it } from 'vitest'
import { encodeWav, floatTo16, type PcmSource } from './wav'
import { DEFAULT_EXPORT_BARS, EXPORT_BAR_OPTIONS, MIN_TAIL_SEC, exportFilename, exportTiming, formatDuration, tailSeconds, wavBytes } from './beatFile'
import { ADDED_STEP_VEL, sandboxDrumVel, sandboxLayerBar } from '@/audio/sandbox'
import { KITS, NEON_DRIVE, kitGrid, section } from '@/data/kits'

const pcm = (channels: number[][], sampleRate = 44100): PcmSource => ({
  numberOfChannels: channels.length,
  sampleRate,
  length: channels[0].length,
  getChannelData: (c) => Float32Array.from(channels[c]),
})
const ascii = (v: DataView, o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(o + i)))

describe('encodeWav (16-bit PCM)', () => {
  it('writes a valid RIFF/WAVE header for stereo', () => {
    const buf = encodeWav(pcm([[0, 0.5, -0.5], [1, -1, 0]], 44100))
    const v = new DataView(buf)
    expect(buf.byteLength).toBe(44 + 3 * 2 * 2)
    expect(ascii(v, 0, 4)).toBe('RIFF')
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8)
    expect(ascii(v, 8, 4)).toBe('WAVE')
    expect(ascii(v, 12, 4)).toBe('fmt ')
    expect(v.getUint32(16, true)).toBe(16)
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(2) // channels
    expect(v.getUint32(24, true)).toBe(44100)
    expect(v.getUint32(28, true)).toBe(44100 * 4) // byte rate
    expect(v.getUint16(32, true)).toBe(4) // block align
    expect(v.getUint16(34, true)).toBe(16)
    expect(ascii(v, 36, 4)).toBe('data')
    expect(v.getUint32(40, true)).toBe(12)
  })

  it('interleaves channels L R L R, little-endian', () => {
    const v = new DataView(encodeWav(pcm([[0, 0.5, -0.5], [1, -1, 0]])))
    const s = Array.from({ length: 6 }, (_, i) => v.getInt16(44 + i * 2, true))
    expect(s).toEqual([0, 32767, 16384, -32768, -16384, 0])
  })

  it('keeps mono as one channel', () => {
    const buf = encodeWav(pcm([[0.25, -0.25]], 48000))
    const v = new DataView(buf)
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(48000)
    expect(buf.byteLength).toBe(44 + 4)
  })

  it('clamps out-of-range samples and maps NaN to silence, without other gain', () => {
    expect(floatTo16(2)).toBe(32767)
    expect(floatTo16(-3)).toBe(-32768)
    expect(floatTo16(Number.NaN)).toBe(0)
    expect(floatTo16(0.1)).toBe(Math.round(0.1 * 32767))
    expect(floatTo16(-0.1)).toBe(Math.round(-0.1 * 32768))
  })

  it('byte size matches wavBytes()', () => {
    expect(encodeWav(pcm([new Array(100).fill(0), new Array(100).fill(0)])).byteLength).toBe(wavBytes(100, 2))
  })
})

describe('export timing', () => {
  it('offers 4 / 8 / 16 bars, default 8', () => {
    expect([...EXPORT_BAR_OPTIONS]).toEqual([4, 8, 16])
    expect(DEFAULT_EXPORT_BARS).toBe(8)
  })

  it('renders complete bars: bars × 16 steps × 60/bpm/4', () => {
    for (const bpm of [60, 108, 112, 132, 180])
      for (const bars of [4, 8, 16]) {
        const t = exportTiming(bpm, bars)
        expect(t.musicSec).toBeCloseTo((bars * 4 * 60) / bpm, 9)
        expect(t.frames).toBe(Math.ceil((t.musicSec + t.tailSec) * 44100))
        expect(t.totalSec).toBeGreaterThanOrEqual(t.musicSec + t.tailSec)
        expect(t.totalSec - (t.musicSec + t.tailSec)).toBeLessThan(1 / 44100)
      }
    expect(exportTiming(112, 8).musicSec).toBeCloseTo(17.142857, 5)
    expect(exportTiming(60, 16).musicSec).toBe(64)
  })

  it('tail: at least 2.5 s, longer at slow tempos for the delay echoes', () => {
    expect(tailSeconds(180)).toBe(MIN_TAIL_SEC)
    expect(tailSeconds(140)).toBe(MIN_TAIL_SEC)
    expect(tailSeconds(112)).toBeCloseTo(15 * (60 / 112 / 4) + 0.5, 9) // 2.51 s
    expect(tailSeconds(60)).toBeCloseTo(15 * 0.25 + 0.5, 9) // 4.25 s
    expect(tailSeconds(90)).toBeCloseTo(15 * (60 / 90 / 4) + 0.5, 9)
  })

  it('clamps BPM like the app', () => {
    expect(exportTiming(400, 4).bpm).toBe(180)
    expect(exportTiming(12, 4).bpm).toBe(60)
  })
})

describe('exportFilename', () => {
  it('uses kit, BPM and bars', () => {
    expect(exportFilename('NEON DRIVE', 108, 8)).toBe('beatbit-neon-drive-108bpm-8bars.wav')
    expect(exportFilename('PIXEL QUEST', 132, 16)).toBe('beatbit-pixel-quest-132bpm-16bars.wav')
  })
  it('is filesystem-safe', () => {
    expect(exportFilename('  Boss/Rush: II!  ', 150.4, 4)).toBe('beatbit-boss-rush-ii-150bpm-4bars.wav')
    expect(exportFilename('***', 120, 4)).toBe('beatbit-beat-120bpm-4bars.wav')
  })
  it('every kit name gives a clean slug', () => {
    for (const k of KITS) expect(exportFilename(k.name, k.bpm, 8)).toMatch(/^beatbit-[a-z0-9-]+-\d{2,3}bpm-8bars\.wav$/)
  })
})

describe('formatDuration', () => {
  it('formats seconds and minutes', () => {
    expect(formatDuration(19.64)).toBe('19.6 s')
    expect(formatDuration(68.25)).toBe('1:08')
    expect(formatDuration(119.7)).toBe('2:00')
  })
})

describe('sandbox rules (shared by live playback and export)', () => {
  it('grid velocity = composed accent, or 0.85 for added steps', () => {
    const acc = kitGrid(NEON_DRIVE).accents
    for (let s = 0; s < 16; s++) {
      const expected = acc.kick[s] || ADDED_STEP_VEL
      expect(sandboxDrumVel(NEON_DRIVE, 'kick', s)).toBe(expected)
    }
  })
  it('layers cycle through the main section from its first bar', () => {
    const main = section(NEON_DRIVE, 'main')
    for (let b = 0; b < 16; b++) expect(sandboxLayerBar(NEON_DRIVE, b)).toBe(main[b % main.length])
  })
  it('every kit has a 4-bar main section, so 4 / 8 / 16 bars are whole cycles', () => {
    for (const k of KITS) expect(section(k, 'main').length).toBe(4)
  })
})
