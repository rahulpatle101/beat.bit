// Play/Stop, tempo, Groove, Clear (DESIGN.md §6, §8.2). Built from 8bitcn Button + Slider.

import { Button } from '@/components/ui/8bit/button'
import { Slider } from '@/components/ui/8bit/slider'
import { BPM_MAX, BPM_MIN } from '@/data/patterns'

interface Props {
  playing: boolean
  bpm: number
  onPlay: () => void
  onStop: () => void
  onBpm: (bpm: number) => void
  onGroove: () => void
  onClear: () => void
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

export function TransportControls({
  playing,
  bpm,
  onPlay,
  onStop,
  onBpm,
  onGroove,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
      <Button
        size="lg"
        variant={playing ? 'secondary' : 'default'}
        className="h-12 w-40 text-sm"
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
        <output
          aria-hidden="true"
          className="retro w-[3ch] text-right text-base text-ink tabular-nums"
        >
          {String(bpm).padStart(3, '0')}
        </output>
      </div>

      <div className="flex gap-6">
        <Button variant="outline" className="h-10" onClick={onGroove}>
          GROOVE
        </Button>
        <Button variant="outline" className="h-10" onClick={onClear}>
          CLEAR
        </Button>
      </div>
    </div>
  )
}
