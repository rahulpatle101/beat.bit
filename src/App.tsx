import { Alert, AlertDescription, AlertTitle } from '@/components/ui/8bit/alert'
import { Badge } from '@/components/ui/8bit/badge'
import { Card, CardContent } from '@/components/ui/8bit/card'
import { Kbd } from '@/components/ui/8bit/kbd'
import { CityScene } from '@/components/CityScene'
import { SequencerGrid } from '@/components/SequencerGrid'
import { TransportControls } from '@/components/TransportControls'
import type { AudioStatus } from '@/audio/engine'
import { useSequencer } from '@/hooks/useSequencer'

const STATUS: Record<AudioStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  locked: { label: 'AUDIO OFF', variant: 'secondary' },
  running: { label: 'AUDIO ON', variant: 'default' },
  blocked: { label: 'AUDIO BLOCKED', variant: 'destructive' },
}

export default function App() {
  const seq = useSequencer()
  const status = STATUS[seq.audioStatus]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col gap-8 px-3.5 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="retro text-lg text-ink sm:text-xl">BEAT.BIT</h1>
          <span className="retro hidden text-[10px] text-ink-dim sm:inline">DAY 001 / 100</span>
        </div>
        <Badge variant={status.variant} className="text-[10px]">
          {status.label}
        </Badge>
      </header>

      <main className="flex flex-col gap-8">
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            {/* The canvas is decorative (aria-hidden). This static description tells screen
                reader users what the scene shows; individual animations aren't announced. */}
            <p className="sr-only">
              Signal City: a pixel city that performs your beat. A robot stomps on the kick, a
              resident cheers from a lit window on the snare, birds hop along a wire on the hi-hat,
              and a rooftop crowd raises its hands on the clap. Street lamps follow the playing
              step.
            </p>
            <CityScene
              playing={seq.playing}
              onStep={seq.onStep}
              onTransport={seq.onTransport}
              onFrame={seq.onFrame}
              onCue={seq.onCue}
              onAudition={seq.onAudition}
            />
          </CardContent>
        </Card>

        {seq.audioStatus === 'blocked' && (
          <Alert variant="destructive" font="normal">
            <AlertTitle className="retro text-[11px]">SOUND IS BLOCKED</AlertTitle>
            <AlertDescription>
              Your browser didn't allow audio to start. Press Stop, then Play again. On iPhone,
              check that the silent switch is off.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="px-4 py-2 sm:px-6">
            <TransportControls
              playing={seq.playing}
              bpm={seq.bpm}
              onPlay={seq.play}
              onStop={seq.stop}
              onBpm={seq.setBpm}
              onGroove={seq.loadGroove}
              onClear={seq.clear}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="seq-wrap px-3 py-4 sm:px-6">
            <SequencerGrid
              pattern={seq.pattern}
              onToggle={seq.toggle}
              onStep={seq.onStep}
              onTransport={seq.onTransport}
            />
          </CardContent>
        </Card>

        <p id="seq-help" className="text-sm text-ink-dim">
          <span className="hidden items-center gap-2 sm:inline-flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move ·<Kbd>SPACE</Kbd> toggle ·<Kbd>TAB</Kbd> controls
          </span>
          <span className="sm:hidden">Tap a square to add a sound. Press Play to hear it.</span>
        </p>
      </main>

      <footer className="mt-auto pt-6 text-xs text-ink-dim">
        Day 001 of 100 Days of Digital Craft · UI built with 8bitcn · Sounds synthesized live
        with the Web Audio API
      </footer>

      <p className="sr-only" role="status" aria-live="polite">
        {seq.announcement}
      </p>
    </div>
  )
}
