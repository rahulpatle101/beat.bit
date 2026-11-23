// DOWNLOAD BEAT panel (V3.3): export length, format, DOWNLOAD WAV, progress, cassette feedback.
// Built from 8bitcn Button, Toggle Group and Progress. The render captures the beat at the
// moment DOWNLOAD WAV is pressed; later edits don't change a render in progress.

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/8bit/button'
import { Progress } from '@/components/ui/8bit/progress'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/8bit/toggle-group'
import {
  DEFAULT_EXPORT_BARS,
  EXPORT_BAR_OPTIONS,
  EXPORT_SAMPLE_RATE,
  exportTiming,
  formatDuration,
  type ExportBars,
} from '@/audio/export/beatFile'
import { exportBeatWav, saveBlob } from '@/audio/export/download'
import type { BeatSnapshot } from '@/audio/export/render'
import { kitById } from '@/data/kits'
import './export.css'

type Job =
  | { state: 'idle' }
  | { state: 'rendering'; progress: number }
  | { state: 'done'; filename: string; key: string }
  | { state: 'error'; message: string; key: string }

type CassetteState = Job['state']

/** Identity of what an export would contain (a finished message only describes its own beat). */
const beatKey = (s: BeatSnapshot, bars: number) =>
  `${s.kitId}|${s.bpm}|${bars}|${(['kick', 'snare', 'hat', 'clap'] as const).map((t) => s.pattern[t].map(Number).join('')).join('|')}` +
  (s.mainBars ? `|${JSON.stringify(s.mainBars)}` : '')

/** 24×15 pixel cassette in the Oil 6 palette. The reel spokes swap frames while rendering. */
function Cassette({ state, className }: { state: CassetteState; className?: string }) {
  // A 5×5 reel: a disc (corners cut), a dark hub, and two spoke frames (vertical / horizontal).
  const reel = (x: number, y: number) => (
    <>
      <rect x={x + 1} y={y} width="3" height="5" fill="var(--oil-1)" />
      <rect x={x} y={y + 1} width="5" height="3" fill="var(--oil-1)" />
      <g className="reel-a" fill="var(--oil-4)">
        <rect x={x + 2} y={y + 1} width="1" height="1" />
        <rect x={x + 2} y={y + 3} width="1" height="1" />
      </g>
      <g className="reel-b" fill="var(--oil-4)">
        <rect x={x + 1} y={y + 2} width="1" height="1" />
        <rect x={x + 3} y={y + 2} width="1" height="1" />
      </g>
      <rect x={x + 2} y={y + 2} width="1" height="1" fill="var(--oil-6)" />
    </>
  )
  return (
    <svg
      viewBox="0 0 24 15"
      width="72"
      height="45"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={`cassette ${className ?? ''}`}
      data-state={state}
    >
      <rect x="0" y="0" width="24" height="15" fill="var(--oil-6)" />
      <rect x="1" y="1" width="22" height="13" fill="var(--oil-5)" />
      {/* label: title line + a status mark (lit when saved, rose on error) */}
      <rect x="3" y="1" width="18" height="3" fill="var(--oil-2)" />
      <rect x="5" y="2" width="9" height="1" fill="var(--oil-4)" />
      <rect x="16" y="2" width="3" height="1" fill={state === 'done' ? 'var(--oil-5)' : state === 'error' ? 'var(--oil-3)' : 'var(--oil-2)'} />
      {/* window, reels, tape */}
      <rect x="4" y="5" width="16" height="5" fill="var(--oil-6)" />
      {reel(5, 5)}
      {reel(14, 5)}
      <rect x="10" y="9" width="4" height="1" fill="var(--oil-3)" />
      {/* bottom guide with holes, screws */}
      <rect x="6" y="11" width="12" height="3" fill="var(--oil-4)" />
      <rect x="8" y="12" width="1" height="1" fill="var(--oil-6)" />
      <rect x="15" y="12" width="1" height="1" fill="var(--oil-6)" />
      <rect x="2" y="12" width="1" height="1" fill="var(--oil-4)" />
      <rect x="21" y="12" width="1" height="1" fill="var(--oil-4)" />
    </svg>
  )
}

interface Props {
  id: string
  open: boolean
  snapshot: BeatSnapshot
  edited: boolean
  onClose: () => void
  onAnnounce: (msg: string) => void
}

export function ExportPanel({ id, open, snapshot, edited, onClose, onAnnounce }: Props) {
  const [bars, setBars] = useState<ExportBars>(DEFAULT_EXPORT_BARS)
  const [rawJob, setJob] = useState<Job>({ state: 'idle' })
  const panelRef = useRef<HTMLElement>(null)
  /** Guards against a double click starting two renders before React re-renders. */
  const runningRef = useRef(false)
  const key = beatKey(snapshot, bars)
  // Once the beat (or length) changes, the SAVED / error message no longer applies.
  const job: Job = (rawJob.state === 'done' || rawJob.state === 'error') && rawJob.key !== key ? { state: 'idle' } : rawJob
  const busy = job.state === 'rendering'
  const kit = kitById(snapshot.kitId)
  const timing = exportTiming(snapshot.bpm, bars, EXPORT_SAMPLE_RATE)

  // Move focus into the panel when it opens (the selected length).
  useEffect(() => {
    if (!open) return
    const el = panelRef.current?.querySelector<HTMLElement>('[data-state=on]') ?? panelRef.current
    el?.focus()
  }, [open])

  const download = async () => {
    if (busy || runningRef.current) return
    runningRef.current = true
    const snap: BeatSnapshot = { ...snapshot } // captured now
    const snapKey = key
    setJob({ state: 'rendering', progress: 0 })
    onAnnounce(`Rendering ${bars} bars of ${kit.name} at ${snap.bpm} BPM`)
    try {
      const file = await exportBeatWav(snap, bars, (f) => setJob({ state: 'rendering', progress: f }))
      saveBlob(file.blob, file.filename)
      setJob({ state: 'done', filename: file.filename, key: snapKey })
      onAnnounce(`Downloaded ${file.filename}, ${formatDuration(file.timing.totalSec)}`)
    } catch (e) {
      console.error('[beatbit] export failed', e)
      const message = 'Could not create the WAV. Try again, or choose a shorter length.'
      setJob({ state: 'error', message, key: snapKey })
      onAnnounce(`Download failed. ${message}`)
    } finally {
      runningRef.current = false
    }
  }

  const pct = job.state === 'rendering' ? Math.round(job.progress * 100) : job.state === 'done' ? 100 : 0

  return (
    <section
      ref={panelRef}
      id={id}
      hidden={!open}
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      className="flex flex-col gap-6 border-t-2 border-dashed border-cell-edge pt-6 outline-none"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Cassette state={job.state} className="h-[30px] w-12 sm:h-[45px] sm:w-[72px]" />
          <h2 id={`${id}-title`} className="retro text-[10px] text-ink">
            DOWNLOAD BEAT
          </h2>
        </div>
        <Button variant="outline" className="h-9 px-3 text-[10px]" onClick={onClose} aria-label="Close download panel">
          CLOSE
        </Button>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <span id={`${id}-len`} className="retro w-16 text-[10px] text-ink-dim">
            LENGTH
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={`${id}-len`}
            value={String(bars)}
            disabled={busy}
            onValueChange={(v) => v && setBars(Number(v) as ExportBars)}
            className="flex-wrap gap-x-5 gap-y-5 px-1.5"
          >
            {EXPORT_BAR_OPTIONS.map((n) => (
              <ToggleGroupItem key={n} value={String(n)} variant="outline" aria-label={`${n} bars`} className="h-10 px-3 text-[10px]">
                {n} BARS
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="retro w-16 text-[10px] text-ink-dim">FORMAT</span>
          <span className="retro text-[10px] text-ink">WAV</span>
          <span className="text-xs text-ink-dim">16-bit PCM · stereo · 44.1 kHz</span>
        </div>

        <p className="text-xs leading-relaxed text-ink-dim">
          {kit.name}
          {edited ? ' (edited)' : ''} · {timing.bpm} BPM · {bars} bars · {formatDuration(timing.totalSec)} with a{' '}
          {timing.tailSec.toFixed(1)} s tail
        </p>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          {/* aria-disabled (not disabled) while rendering, so keyboard focus stays on the button. */}
          <Button
            className="h-11 w-full text-[11px] aria-disabled:cursor-progress sm:w-auto sm:min-w-48"
            onClick={download}
            aria-disabled={busy || undefined}
            aria-describedby={`${id}-status`}
          >
            {busy ? 'RENDERING…' : 'DOWNLOAD WAV'}
          </Button>
          <div id={`${id}-status`} className="flex min-w-40 flex-1 flex-col gap-2">
            {/* Browsers without OfflineAudioContext.suspend (Firefox) report no progress until done:
                they get the reel animation and a plain label instead of a bar stuck at 0%. */}
            {job.state === 'rendering' && (
              <>
                {pct > 0 && <Progress variant="retro" value={pct} className="h-3" aria-label="Rendering progress" />}
                <span className="retro text-[10px] text-ink-dim tabular-nums">
                  {pct > 0 ? `RENDERING ${String(pct).padStart(2, '0')}%` : 'RENDERING…'}
                </span>
              </>
            )}
            {job.state === 'done' && (
              <span className="text-xs break-all text-ink">
                <span className="retro text-[10px]">SAVED</span> {job.filename}
              </span>
            )}
            {job.state === 'error' && (
              <span role="alert" className="text-sm text-kick">
                {job.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
