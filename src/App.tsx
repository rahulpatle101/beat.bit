import { Alert, AlertDescription, AlertTitle } from '@/components/ui/8bit/alert'
import { Badge } from '@/components/ui/8bit/badge'
import { Card, CardContent } from '@/components/ui/8bit/card'
import { Kbd } from '@/components/ui/8bit/kbd'
import { CityScene } from '@/components/CityScene'
import { SequencerGrid } from '@/components/SequencerGrid'
import { TransportControls } from '@/components/TransportControls'
import { ArcadeHud, ArcadePads, ArcadeResults, ArcadeStart } from '@/components/ArcadePanel'
import { rankFor } from '@/data/arcade'
import { barPattern } from '@/data/kits'
import { DISTRICTS } from '@/scene/city'
import { useArcade } from '@/hooks/useArcade'
import { useEffect, useState } from 'react'
import type { AudioStatus } from '@/audio/engine'
import { KITS, kitById } from '@/data/kits'
import { FEATURES } from '@/config/features'
import { useSequencer } from '@/hooks/useSequencer'

const STATUS: Record<AudioStatus, { label: string; variant: 'secondary' | 'default' | 'destructive' }> = {
  locked: { label: 'AUDIO OFF', variant: 'secondary' },
  running: { label: 'AUDIO ON', variant: 'default' },
  blocked: { label: 'AUDIO BLOCKED', variant: 'destructive' },
}

export default function App() {
  const seq = useSequencer()
  // V3.1: the Arcade layer stays in the code but is hidden behind a disabled feature flag.
  // With the flag off nothing can start a challenge, so the hook stays idle (no listeners run).
  const arcade = useArcade(seq)
  const av = arcade.view
  const inChallenge = FEATURES.arcade && av.phase === 'running'
  const status = STATUS[seq.audioStatus]
  const rank = rankFor(av.progress.xp)
  const power = !FEATURES.arcade
    ? null
    : av.phase === 'running'
      ? av.districts
      : av.phase === 'results'
        ? av.results && av.results.stars >= 1
          ? DISTRICTS
          : av.districts
        : null
  const { onRemix } = seq

  // Remix die: rollKey changes on every roll; rollSize = how many cells it changed.
  const [roll, setRoll] = useState({ key: 0, size: 5 })
  useEffect(() => onRemix((changes) => setRoll((r) => ({ key: r.key + 1, size: changes.length }))), [onRemix])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1040px] flex-col gap-8 px-3.5 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-4">
            <h1 className="retro text-lg text-ink sm:text-xl">BEAT.BIT</h1>
            <span className="retro hidden text-[10px] text-ink-dim sm:inline">DAY 001 / 100</span>
          </div>
          <p className="text-sm text-ink-dim">A living music toy. Press play, remix, and watch the city move.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          {FEATURES.arcade && (
            <Badge variant="outline" className="text-[10px]" aria-label={`Rank ${rank.name}, ${av.progress.xp} XP`}>
              {rank.name}
            </Badge>
          )}
          <Badge variant={status.variant} className="text-[10px]">
            {status.label}
          </Badge>
        </div>
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
              mood={kitById(inChallenge ? av.challenge.kitId : seq.kitId).mood}
              power={power}
              onRemix={seq.onRemix}
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

        {FEATURES.arcade && av.phase === 'idle' && <ArcadeStart view={av} onStart={arcade.start} onAssist={arcade.toggleAssist} />}
        {FEATURES.arcade && av.phase === 'running' && <ArcadeHud view={av} onQuit={arcade.quit} />}
        {FEATURES.arcade && av.phase === 'results' && (
          <ArcadeResults view={av} onRetry={arcade.start} onSandbox={arcade.backToSandbox} />
        )}

        {!inChallenge && !(FEATURES.arcade && av.phase === 'results') && (
        <Card>
            <CardContent className="px-4 py-2 sm:px-6">
              <TransportControls
                playing={seq.playing}
                bpm={seq.bpm}
                kitId={seq.kitId}
                unlocked={KITS.map((k) => k.id)}
                edited={seq.edited}
                canUndo={seq.canUndo}
                rollKey={roll.key}
                rollSize={roll.size}
                onPlay={seq.play}
                onStop={seq.stop}
                onBpm={seq.setBpm}
                onKit={seq.loadKit}
                onRemix={seq.remix}
                onUndo={seq.undo}
                onClear={seq.clear}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="seq-wrap px-3 py-4 sm:px-6">
            <SequencerGrid
              pattern={inChallenge ? barPattern(av.challenge.bars[av.bar] ?? av.challenge.bars[0]) : seq.pattern}
              cues={inChallenge ? av.cueStates : undefined}
              onToggle={seq.toggle}
              onStep={seq.onStep}
              onTransport={seq.onTransport}
              onRemix={seq.onRemix}
            />
          </CardContent>
        </Card>

        {inChallenge && <ArcadePads view={av} onHit={arcade.hit} />}

        {inChallenge ? (
          <p id="seq-help" className="text-sm text-ink-dim">
            Hit <span className="text-kick">KICK</span> (F) and <span className="text-snare">SNARE</span> (J) when the lamp
            reaches a glowing step. Clean bars light up the city. Esc quits.
          </p>
        ) : (
        <p id="seq-help" className="text-sm text-ink-dim">
            <span className="hidden items-center gap-2 sm:inline-flex">
              <Kbd>←</Kbd>
              <Kbd>→</Kbd>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move ·<Kbd>SPACE</Kbd> toggle ·<Kbd>TAB</Kbd> controls · switch kits or REMIX
              and watch the city
            </span>
            <span className="sm:hidden">
              Press PLAY. Switch kits, tap squares, or REMIX, and watch the city respond.
            </span>
          </p>
        )}
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
