// Transport (DESIGN.md §6, §8.2 + V2.2): Play/Stop, tempo, curated grooves, Remix, Undo, Clear,
// and (V3.3) DOWNLOAD BEAT. Built from 8bitcn Button, Slider and Toggle Group.

import { useEffect, useRef, useState } from 'react'
import { ExportPanel } from '@/components/ExportPanel'
import { RemixSettings } from '@/components/RemixSettings'
import type { RemixSettings as RemixSettingsValue } from '@/hooks/useSequencer'
import { BAND_LABEL, bandOf, type Part } from '@/data/remixMusic'
import type { Bar } from '@/data/kits'
import { Button } from '@/components/ui/8bit/button'
import { Slider } from '@/components/ui/8bit/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/8bit/toggle-group'
import { KITS, type KitId } from '@/data/kits'
import { BPM_MAX, BPM_MIN, type Pattern } from '@/data/patterns'
import { cn } from '@/lib/utils'

interface Props {
  playing: boolean
  bpm: number
  /** The current grid (captured by DOWNLOAD BEAT). */
  pattern: Pattern
  kitId: KitId
  /** Kits the player can load (others show as locked). */
  unlocked: readonly KitId[]
  edited: boolean
  /** V3.4: the kit's main bars as currently played (captured by DOWNLOAD BEAT). */
  music: Bar[]
  /** Anything differs from the kit's original (enables RESTORE ORIGINAL). */
  modified: boolean
  remixSettings: RemixSettingsValue
  remixUnavailable: Partial<Record<Part, string>>
  lastSeed: number | null
  onRemixSettings: (s: RemixSettingsValue) => void
  onRestore: () => void
  canUndo: boolean
  /** Increments on every remix; `rollSize` is how many cells that roll changed. */
  rollKey: number
  rollSize: number
  onPlay: () => void
  onStop: () => void
  onBpm: (bpm: number) => void
  onKit: (id: KitId) => void
  onRemix: () => void
  onUndo: () => void
  onClear: () => void
  /** Polite live-region announcement. */
  onAnnounce: (msg: string) => void
}

function PixelIcon({ kind }: { kind: 'play' | 'stop' }) {
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges" className="size-3.5">
      {kind === 'play' ? (
        <>
          <rect x="1" y="0" width="2" height="7" fill="currentColor" />
          <rect x="3" y="1" width="2" height="5" fill="currentColor" />
          <rect x="5" y="2" width="1" height="3" fill="currentColor" />
          <rect x="6" y="3" width="1" height="1" fill="currentColor" />
        </>
      ) : (
        <rect x="1" y="1" width="5" height="5" fill="currentColor" />
      )}
    </svg>
  )
}

// Pip positions on a 9×9 pixel die (1–6).
const PIPS: Record<number, [number, number][]> = {
  1: [[4, 4]],
  2: [[2, 2], [6, 6]],
  3: [[2, 2], [4, 4], [6, 6]],
  4: [[2, 2], [6, 2], [2, 6], [6, 6]],
  5: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]],
  6: [[2, 2], [6, 2], [2, 4], [6, 4], [2, 6], [6, 6]],
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges" className="size-3.5">
      <rect x="3" y="0" width="1" height="4" fill="currentColor" />
      <rect x="1" y="2" width="1" height="1" fill="currentColor" />
      <rect x="5" y="2" width="1" height="1" fill="currentColor" />
      <rect x="2" y="3" width="1" height="1" fill="currentColor" />
      <rect x="4" y="3" width="1" height="1" fill="currentColor" />
      <rect x="0" y="6" width="7" height="1" fill="currentColor" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges" className="size-3">
      <rect x="2" y="0" width="3" height="1" fill="currentColor" />
      <rect x="1" y="1" width="1" height="2" fill="currentColor" />
      <rect x="5" y="1" width="1" height="2" fill="currentColor" />
      <rect x="0" y="3" width="7" height="4" fill="currentColor" />
    </svg>
  )
}

function Die({ face }: { face: number }) {
  return (
    <svg viewBox="0 0 9 9" aria-hidden="true" shapeRendering="crispEdges" className="size-4">
      <rect x="0" y="0" width="9" height="9" fill="currentColor" />
      {PIPS[face].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill="var(--void)" />
      ))}
    </svg>
  )
}

/** The die tumbles through 3 faces (~180 ms) and lands on the number of changes. */
function useRollingFace(rollKey: number, rollSize: number) {
  // The resting face is derived from the last roll; only the tumble frames are state.
  const target = Math.min(6, Math.max(1, rollSize))
  const [tumble, setTumble] = useState<number | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const faces = [1, 2, 3, 4, 5, 6].filter((f) => f !== target).sort(() => Math.random() - 0.5).slice(0, 3)
    let i = 0
    const id = setInterval(() => {
      if (i < faces.length) setTumble(faces[i++])
      else {
        setTumble(null)
        clearInterval(id)
      }
    }, 60)
    return () => clearInterval(id)
  }, [rollKey, target])
  return tumble ?? target
}

export function TransportControls({
  playing,
  bpm,
  pattern,
  kitId,
  unlocked,
  edited,
  music,
  modified,
  remixSettings,
  remixUnavailable,
  lastSeed,
  onRemixSettings,
  onRestore,
  canUndo,
  rollKey,
  rollSize,
  onPlay,
  onStop,
  onBpm,
  onKit,
  onRemix,
  onUndo,
  onClear,
  onAnnounce,
}: Props) {
  const face = useRollingFace(rollKey, rollSize)
  const [exportOpen, setExportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const downloadRef = useRef<HTMLButtonElement>(null)
  const closeExport = () => {
    setExportOpen(false)
    downloadRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
        <Button
          size="lg"
          // Stop: outline variant with a solid fill. The 8bitcn `secondary` variant draws
          // translucent shadow strips that read as stray corner pixels (BUILD_STATUS D4).
          variant={playing ? 'outline' : 'default'}
          className={cn('h-12 w-40 text-sm', playing && 'bg-cell text-ink dark:bg-cell')}
          onClick={playing ? () => onStop() : onPlay}
        >
          <PixelIcon kind={playing ? 'stop' : 'play'} />
          {playing ? 'STOP' : 'PLAY'}
        </Button>

        <div className="flex min-w-60 flex-1 items-center gap-5">
          <span id="bpm-label" className="retro text-[10px] text-ink-dim">
            BPM
          </span>
          <Slider
            className="flex-1"
            min={BPM_MIN}
            max={BPM_MAX}
            step={1}
            value={[bpm]}
            onValueChange={([v]) => onBpm(v)}
            thumbProps={{
              'aria-label': 'Tempo',
              'aria-valuetext': `${bpm} beats per minute`,
            }}
          />
          <output aria-hidden="true" className="retro w-[3ch] text-right text-base text-ink tabular-nums">
            {String(bpm).padStart(3, '0')}
          </output>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-7">
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <span id="groove-label" className="retro text-[10px] text-ink-dim">
              KIT
            </span>
            {edited && (
              <span className="retro text-[10px] text-snare" aria-hidden="true">
                EDITED
              </span>
            )}
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby="groove-label"
            value={kitId}
            // Pressing the active kit again (Radix sends '') reloads it.
            onValueChange={(v) => onKit((v || kitId) as KitId)}
            className="flex-wrap gap-x-5 gap-y-5 px-1.5"
          >
            {KITS.map((k) => {
              const locked = !unlocked.includes(k.id)
              return (
                <ToggleGroupItem
                  key={k.id}
                  value={k.id}
                  variant="outline"
                  disabled={locked}
                  aria-label={locked ? `${k.name}, locked` : `${k.name}, ${k.bpm} BPM`}
                  className="h-10 px-3 text-[10px] disabled:opacity-45"
                >
                  {locked && <LockIcon />}
                  {k.name}
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-5">
          <Button variant="outline" className="h-10" onClick={onRemix} aria-describedby="remix-help">
            <Die face={face} />
            REMIX
          </Button>
          <Button
            variant="outline"
            className="h-10 px-3 text-[10px]"
            aria-expanded={settingsOpen}
            aria-controls="remix-settings"
            aria-label={`Remix settings: temperature ${remixSettings.temperature}, ${BAND_LABEL[bandOf(remixSettings.temperature)].toLowerCase()}`}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            {BAND_LABEL[bandOf(remixSettings.temperature)]} {settingsOpen ? '▴' : '▾'}
          </Button>
          <span id="remix-help" className="sr-only">
            Rolls a seeded variation of the drums, melody and bass (see Remix settings). While playing it
            lands on the next bar. Undo restores the previous version exactly.
          </span>
          <Button variant="outline" className="h-10" onClick={onUndo} disabled={!canUndo}>
            UNDO
          </Button>
          <Button variant="outline" className="h-10" onClick={onClear}>
            CLEAR
          </Button>
          <Button
            ref={downloadRef}
            variant="outline"
            className="h-10"
            aria-expanded={exportOpen}
            aria-controls="export-panel"
            onClick={() => setExportOpen((o) => !o)}
          >
            <DownloadIcon />
            DOWNLOAD
          </Button>
        </div>
      </div>

      <RemixSettings
        id="remix-settings"
        open={settingsOpen}
        temperature={remixSettings.temperature}
        parts={remixSettings.parts}
        unavailable={remixUnavailable}
        seed={lastSeed}
        modified={modified}
        onTemperature={(temperature) => onRemixSettings({ ...remixSettings, temperature })}
        onParts={(parts) => onRemixSettings({ ...remixSettings, parts })}
        onRestore={onRestore}
      />

      <ExportPanel
        id="export-panel"
        open={exportOpen}
        snapshot={{ kitId, bpm, pattern, mainBars: music }}
        edited={edited}
        onClose={closeExport}
        onAnnounce={onAnnounce}
      />

    </div>
  )
}
