// DOWNLOAD BEAT: render → encode → save, entirely in the browser (no uploads, no recording).

import { kitById } from '@/data/kits'
import { exportFilename, type ExportTiming } from './beatFile'
import { renderBeat, type BeatSnapshot } from './render'
import { encodeWav } from './wav'

export interface BeatFile {
  blob: Blob
  filename: string
  timing: ExportTiming
  /** Highest absolute sample value in the render (for QA; the mix is not altered). */
  samplePeak: number
}

export async function exportBeatWav(snap: BeatSnapshot, bars: number, onProgress?: (f: number) => void): Promise<BeatFile> {
  if (typeof OfflineAudioContext === 'undefined') throw new Error('This browser cannot render audio offline')
  const { buffer, timing } = await renderBeat(snap, bars, { onProgress })
  let samplePeak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > samplePeak) samplePeak = a
    }
  }
  // Let the UI paint "ENCODING" before the (synchronous) encode.
  await new Promise((r) => setTimeout(r, 0))
  const blob = new Blob([encodeWav(buffer)], { type: 'audio/wav' })
  return { blob, filename: exportFilename(kitById(snap.kitId).name, timing.bpm, bars), timing, samplePeak }
}

/** Revoke after the browser has had time to start the download (immediate revoke can cancel it). */
const REVOKE_AFTER_MS = 30_000

/** Save a blob as a file via a temporary object URL, revoked afterwards. Returns a cleanup. */
export function saveBlob(blob: Blob, filename: string): () => void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  let revoked = false
  const revoke = () => {
    if (revoked) return
    revoked = true
    clearTimeout(timer)
    URL.revokeObjectURL(url)
  }
  const timer = setTimeout(revoke, REVOKE_AFTER_MS)
  try {
    a.click()
  } catch (e) {
    revoke()
    throw e
  } finally {
    a.remove()
  }
  return revoke
}
