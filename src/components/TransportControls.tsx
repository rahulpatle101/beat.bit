// Transport (DESIGN.md §6, §8.2 + V2.2): Play/Stop, tempo, curated grooves, Remix, Undo, Clear.
// Built from 8bitcn Button, Slider and Toggle Group.

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/8bit/button'
import { Slider } from '@/components/ui/8bit/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/8bit/toggle-group'
import { BPM_MAX, BPM_MIN, GROOVES, type GrooveId } from '@/data/patterns'
import { cn } from '@/lib/utils'

interface Props {
  playing: boolean
  bpm: number
  grooveId: GrooveId
  edited: boolean
  canUndo: boolean
  /** Increments on every remix; `rollSize` is how many cells that roll changed. */
  rollKey: number
  rollSize: number
  onPlay: () => void
  onStop: () => void
  onBpm: (bpm: number) => void
  onGroove: (id: GrooveId) => void
  onRemix: () => void
  onUndo: () => void
  onClear: () => void
  /** V2.3a review controls (temporary until the melody editor). */
  melodyOn: boolean
  melodySeed: number
  onToggleMelody: () => void
  onNewMelody: () => void
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

function NoteIcon() {
  return (
    <svg viewBox="0 0 7 7" aria-hidden="true" shapeRendering="crispEdges" className="size-3.5">
      <rect x="4" y="0" width="1" height="5" fill="currentColor" />
      <rect x="5" y="0" width="2" height="1" fill="currentColor" />
      <rect x="1" y="4" width="4" height="3" fill="currentColor" />
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
  grooveId,
  edited,
  canUndo,
  rollKey,
  rollSize,
  onPlay,
  onStop,
  onBpm,
  onGroove,
  onRemix,
  onUndo,
  onClear,
  melodyOn,
  melodySeed,
  onToggleMelody,
  onNewMelody,
}: Props) {
  const face = useRollingFace(rollKey, rollSize)

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
              GROOVE
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
            value={grooveId}
            // Pressing the active groove again (Radix sends '') reloads it.
            onValueChange={(v) => onGroove((v || grooveId) as GrooveId)}
            className="flex-wrap gap-x-5 gap-y-5 px-1.5"
          >
            {GROOVES.map((g) => (
              <ToggleGroupItem
                key={g.id}
                value={g.id}
                variant="outline"
                aria-label={`${g.name}, ${g.bpm} BPM`}
                className="h-10 px-3 text-[10px]"
              >
                {g.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-5">
          <Button variant="outline" className="h-10" onClick={onRemix} aria-describedby="remix-help">
            <Die face={face} />
            REMIX
          </Button>
          <span id="remix-help" className="sr-only">
            Rolls a small variation of the current beat. Undo restores the previous pattern.
          </span>
          <Button variant="outline" className="h-10" onClick={onUndo} disabled={!canUndo}>
            UNDO
          </Button>
          <Button variant="outline" className="h-10" onClick={onClear}>
            CLEAR
          </Button>
        </div>
      </div>

      {/* V2.3a: melody review controls (the Pitch Grid editor comes in V2.3b). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-5">
        <span id="melody-label" className="retro text-[10px] text-ink-dim">
          MELODY
        </span>
        <Button
          variant={melodyOn ? 'default' : 'outline'}
          className={cn('h-10', melodyOn && 'bg-lead text-void dark:bg-lead')}
          aria-pressed={melodyOn}
          aria-labelledby="melody-label"
          onClick={onToggleMelody}
        >
          <NoteIcon />
          {melodyOn ? 'ON' : 'OFF'}
        </Button>
        <Button variant="outline" className="h-10" onClick={onNewMelody} aria-describedby="melody-seed">
          <Die face={((melodySeed % 6) + 1) as number} />
          NEW MELODY
        </Button>
        <span id="melody-seed" className="retro text-[10px] text-ink-dim">
          #{String(melodySeed).padStart(4, '0')}
        </span>
      </div>
    </div>
  )
}
