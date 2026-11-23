// Arcade UI (GAME_DESIGN.md §1, §4A, §6, §10): start card, live HUD, pads, and results.
// Built from 8bitcn Card, Button, Badge and XP Bar.

import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import { Card, CardContent } from '@/components/ui/8bit/card'
import XpBar from '@/components/ui/8bit/xp-bar'
import { rankFor, multiplier, type Pad } from '@/data/arcade'
import type { ArcadeView } from '@/hooks/useArcade'
import { DISTRICTS } from '@/scene/city'
import { cn } from '@/lib/utils'

function Stars({ n, size = 'size-6' }: { n: number; size?: string }) {
  return (
    <span className="inline-flex gap-1.5" aria-label={`${n} of 3 stars`} role="img">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden="true" className={cn(size, i < n ? 'text-snare' : 'text-cell-edge')}>
          <rect x="3" y="0" width="1" height="2" fill="currentColor" />
          <rect x="0" y="2" width="7" height="1" fill="currentColor" />
          <rect x="1" y="3" width="5" height="1" fill="currentColor" />
          <rect x="2" y="4" width="3" height="1" fill="currentColor" />
          <rect x="1" y="5" width="2" height="2" fill="currentColor" />
          <rect x="4" y="5" width="2" height="2" fill="currentColor" />
        </svg>
      ))}
    </span>
  )
}

export function ArcadeStart({ view, onStart, onAssist }: { view: ArcadeView; onStart: () => void; onAssist: () => void }) {
  const best = view.progress.best[view.challenge.id]
  const first = !best
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-6 px-4 py-2 sm:px-6">
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <span className="retro text-[10px] text-snare">ARCADE · 30 s</span>
          <h2 className="retro text-sm text-ink">{view.challenge.name}</h2>
          <p className="text-sm text-ink-dim">
            {first ? 'The city is asleep. ' : ''}Play <strong className="text-kick">KICK</strong> (F) and{' '}
            <strong className="text-snare">SNARE</strong> (J) when the lamp reaches a glowing step.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {best && <Stars n={best.stars} size="size-4" />}
          <Button
            variant="outline"
            className="h-10"
            aria-pressed={view.progress.assist}
            onClick={onAssist}
            aria-describedby="assist-help"
          >
            ASSIST {view.progress.assist ? 'ON' : 'OFF'}
          </Button>
          <span id="assist-help" className="sr-only">
            Assist mode doubles the timing windows.
          </span>
          <Button size="lg" className={cn('h-12 text-sm', first && 'animate-none')} onClick={onStart}>
            ▶ {first ? 'WAKE THE CITY' : 'PLAY AGAIN'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ArcadeHud({ view, onQuit }: { view: ArcadeView; onQuit: () => void }) {
  const flash = view.flash
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-2 sm:px-6">
        <div className="retro flex flex-wrap items-baseline gap-x-8 gap-y-3 text-[10px] text-ink-dim">
          <span>
            SCORE <span className="text-base text-ink tabular-nums">{String(view.score).padStart(5, '0')}</span>
          </span>
          <span>
            COMBO <span className="text-sm text-ink tabular-nums">{view.combo}</span>
            {multiplier(view.combo) > 1 && <span className="text-snare"> ×{multiplier(view.combo)}</span>}
          </span>
          <span>
            ACC <span className="text-sm text-ink tabular-nums">{Math.round(view.accuracy * 100)}%</span>
          </span>
          <span>
            CITY <span className="text-sm text-ink tabular-nums">{view.districts}/{DISTRICTS}</span>
          </span>
        </div>
        <div className="flex items-center gap-6">
          {/* Judgement pop-up (visual only; not announced per note) */}
          <span
            key={flash?.id}
            aria-hidden="true"
            className={cn(
              'retro arcade-flash min-w-[9ch] text-right text-xs',
              flash?.kind === 'perfect' && 'text-snare',
              flash?.kind === 'great' && 'text-hat',
              flash?.kind === 'good' && 'text-ink',
              (flash?.kind === 'miss' || flash?.kind === 'stray') && 'text-ink-dim',
            )}
          >
            {flash?.text ?? ''}
          </span>
          <Button variant="outline" className="h-10" onClick={onQuit}>
            QUIT (ESC)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ArcadePads({ view, onHit }: { view: ArcadeView; onHit: (pad: Pad, ts: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-6 px-1.5">
      {view.challenge.pads.map((p) => (
        <Button
          key={p.pad}
          variant="outline"
          className={cn('h-20 text-sm', view.hint === p.pad && 'arcade-hint')}
          // Pointer presses judge on pointerdown (instant); keyboard uses F / J globally.
          onPointerDown={(e) => {
            e.preventDefault()
            onHit(p.pad, e.timeStamp)
          }}
          aria-label={`${p.label} pad, key ${p.key.toUpperCase()}`}
        >
          <span className={p.pad === 'kick' ? 'text-kick' : 'text-snare'}>{p.label}</span>
          <span className="text-ink-dim">{p.key.toUpperCase()}</span>
          {view.hint === p.pad && <span className="text-ink">NOW</span>}
        </Button>
      ))}
    </div>
  )
}

export function ArcadeResults({ view, onRetry, onSandbox }: { view: ArcadeView; onRetry: () => void; onSandbox: () => void }) {
  const r = view.results
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  if (!r) return null
  const rank = rankFor(view.progress.xp)
  return (
    <Card>
      <CardContent className="flex flex-col gap-6 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 ref={headingRef} tabIndex={-1} className="retro text-sm text-ink outline-none">
            {r.stars >= 1 ? 'THE CITY IS AWAKE!' : 'THE CITY SLEEPS…'}
          </h2>
          <Stars n={r.stars} />
        </div>
        <dl className="retro grid grid-cols-2 gap-x-8 gap-y-3 text-[10px] text-ink-dim sm:grid-cols-4">
          <div>
            <dt>SCORE</dt>
            <dd className="text-base text-ink tabular-nums">{r.score}</dd>
          </div>
          <div>
            <dt>ACCURACY</dt>
            <dd className="text-base text-ink tabular-nums">{Math.round(r.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>MAX COMBO</dt>
            <dd className="text-base text-ink tabular-nums">{r.maxCombo}</dd>
          </div>
          <div>
            <dt>HITS</dt>
            <dd className="text-[10px] text-ink">
              {r.counts.perfect}P · {r.counts.great}G · {r.counts.good}OK · {r.counts.miss}M · {r.counts.stray}×
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-3">
          <div className="retro flex flex-wrap items-center justify-between gap-3 text-[10px]">
            <span className="text-ink">
              +{r.xp} XP {r.newBest && <span className="text-snare">· NEW BEST</span>}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {rank.name}
            </Badge>
          </div>
          <XpBar value={Math.round(rank.progress * 100)} className="h-4" aria-label={`Rank progress: ${rank.toNext} XP to ${rank.next ?? 'max rank'}`} />
          {r.rankUp && <p className="retro text-[10px] text-snare">RANK UP! {rank.name}</p>}
        </div>
        {r.stars >= 1 && (
          <p className="text-sm text-ink-dim">
            Now make <span className="text-ink">NEON DRIVE</span> yours in the Sandbox: edit the grid, press REMIX, or try
            PIXEL QUEST.
          </p>
        )}
        <div className="flex flex-wrap gap-6">
          <Button size="lg" className="h-12 text-sm" onClick={onRetry}>
            ▶ RETRY
          </Button>
          <Button variant="outline" className="h-12" onClick={onSandbox}>
            SANDBOX
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
