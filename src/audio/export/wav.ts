// 16-bit PCM WAV encoding (RIFF/WAVE, little-endian, interleaved channels).
// Used by DOWNLOAD BEAT and by the dev-only preview renderers (src/dev/wav.ts re-exports it).
// No normalisation, dither or gain: samples are clamped to [-1, 1] and rounded to the nearest step.

/** The parts of an AudioBuffer the encoder reads (so it can be unit-tested without Web Audio). */
export interface PcmSource {
  numberOfChannels: number
  sampleRate: number
  length: number
  getChannelData(channel: number): Float32Array
}

export const WAV_HEADER_BYTES = 44

/** Convert one float sample to a signed 16-bit integer (asymmetric scale: -1 → -32768, 1 → 32767). */
export function floatTo16(x: number): number {
  if (!(x === x)) return 0 // NaN
  const s = x < -1 ? -1 : x > 1 ? 1 : x
  return s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff)
}

export function encodeWav(buf: PcmSource): ArrayBuffer {
  const ch = buf.numberOfChannels
  const n = buf.length
  const blockAlign = ch * 2
  const dataBytes = n * blockAlign
  const out = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes)
  const v = new DataView(out)
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataBytes, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true) // fmt chunk size
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, ch, true)
  v.setUint32(24, buf.sampleRate, true)
  v.setUint32(28, buf.sampleRate * blockAlign, true) // byte rate
  v.setUint16(32, blockAlign, true)
  v.setUint16(34, 16, true) // bits per sample
  str(36, 'data')
  v.setUint32(40, dataBytes, true)
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c))
  const pcm = new Int16Array(out, WAV_HEADER_BYTES)
  // Int16Array uses platform endianness; every browser we target is little-endian, but stay exact.
  const little = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1
  let o = 0
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const s = floatTo16(data[c][i])
      if (little) pcm[o] = s
      else v.setInt16(WAV_HEADER_BYTES + o * 2, s, true)
      o++
    }
  return out
}

export function toBase64(ab: ArrayBuffer): string {
  let bin = ''
  const bytes = new Uint8Array(ab)
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
