// Arcade session (GAME_DESIGN.md §3–§6): runs a challenge on top of the sequencer's arrangement
// mode. Cue times come from the scheduler (exact audio-clock times); presses are converted to
// heard time from the input event's timeStamp; misses are swept every frame.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ASSIST,
  NORMAL,
  accuracy,
  liveAccuracy,
  isPlayerStep,
  loadProgress,
  newRun,
  playerSteps,
  press,
  rankFor,
  saveProgress,
  stars as starsFor,
  sweep,
  wakeTheCity,
  xpAward,
  type Challenge,
  type Cue,
  type Judgement,
  type Pad,
  type Progress,
  type RunState,
} from '@/data/arcade'
import { DISTRICTS } from '@/scene/city'
import type { Sequencer } from './useSequencer'

export type CueState = 'open' | Judgement | 'miss'

export interface ArcadeView {
  phase: 'idle' | 'running' | 'results'
  challenge: Challenge
  score: number
  combo: number
  accuracy: number
  districts: number
  /** Last judgement, for the pop-up (id changes on every judgement). */
  flash: { id: number; text: string; kind: Judgement | 'miss' | 'stray' } | null
  /** Bar currently heard (drives the grid display). */
  bar: number
  /** Cue states for the current bar, keyed `${pad}:${step}`. */
  cueStates: Map<string, CueState>
  /** Pad to hint ("NOW") on a first attempt. */
  hint: Pad | null
  results: null | {
    stars: 0 | 1 | 2 | 3
    score: number
    accuracy: number
    maxCombo: number
    counts: RunState['counts']
    xp: number
    newBest: boolean
    rank: ReturnType<typeof rankFor>
    rankUp: boolean
  }
  progress: Progress
}

export function useArcade(seq: Sequencer) {
  const [challenge, setChallenge] = useState<Challenge>(wakeTheCity)
  const challengeRef = useRef<Challenge>(challenge)
  const runRef = useRef<RunState | null>(null)
  const playerRef = useRef<Set<string>>(new Set())
  const firstAttemptRef = useRef(true)
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const progressRef = useRef(progress)
  const [view, setView] = useState<Omit<ArcadeView, 'progress' | 'challenge'>>({
    phase: 'idle',
    score: 0,
    combo: 0,
    accuracy: 0,
    districts: 0,
    flash: null,
    bar: 0,
    cueStates: new Map(),
    hint: null,
    results: null,
  })
  const flashId = useRef(0)
  const barRef = useRef(0)

  const windows = () => (progressRef.current.assist ? ASSIST : NORMAL)

  /** Recompute the per-bar cue states for the grid. */
  const cueStatesFor = useCallback((bar: number): Map<string, CueState> => {
    const run = runRef.current
    const m = new Map<string, CueState>()
    if (!run) return m
    for (const c of run.cues) if (c.bar === bar) m.set(`${c.pad}:${c.step}`, run.judged.get(c.id) ?? 'open')
    return m
  }, [])

  const refresh = useCallback(
    (extra: Partial<Omit<ArcadeView, 'progress' | 'challenge'>> = {}) => {
      const run = runRef.current
      if (!run) return
      setView((v) => ({
        ...v,
        score: run.score,
        combo: run.combo,
        accuracy: liveAccuracy(run),
        cueStates: cueStatesFor(barRef.current),
        ...extra,
      }))
    },
    [cueStatesFor],
  )

  const finish = useCallback(() => {
    const run = runRef.current
    if (!run) return
    sweep(run, Infinity, windows())
    const acc = accuracy(run)
    const st = starsFor(acc)
    const prev = progressRef.current
    const best = prev.best[challengeRef.current.id]
    const xp = xpAward(st, best?.stars ?? 0)
    const before = rankFor(prev.xp)
    const next: Progress = {
      ...prev,
      xp: prev.xp + xp,
      best: {
        ...prev.best,
        [challengeRef.current.id]:
          !best || run.score > best.score ? { stars: Math.max(st, best?.stars ?? 0), score: run.score, accuracy: acc } : { ...best, stars: Math.max(st, best.stars) },
      },
    }
    progressRef.current = next
    setProgress(next)
    saveProgress(next)
    const rank = rankFor(next.xp)
    firstAttemptRef.current = false
    setView((v) => ({
      ...v,
      phase: 'results',
      hint: null,
      districts: st >= 1 ? DISTRICTS : v.districts,
      results: {
        stars: st,
        score: run.score,
        accuracy: acc,
        maxCombo: run.maxCombo,
        counts: { ...run.counts },
        xp,
        newBest: !best || run.score > best.score,
        rank,
        rankUp: rank.index > before.index,
      },
    }))
    seq.announce(
      `${st >= 1 ? 'The city is awake!' : 'The city is still asleep.'} ${st} of 3 stars. Score ${run.score}, accuracy ${Math.round(acc * 100)} percent, ${xp} XP. Rank ${rank.name}.`,
    )
    // seq is stable enough for this callback; windows() reads a ref.
  }, [seq])

  const start = useCallback(async () => {
    const ch = wakeTheCity()
    challengeRef.current = ch
    setChallenge(ch)
    playerRef.current = playerSteps(ch)
    const run = newRun(ch.cues.map((c) => ({ ...c, time: 0 })))
    runRef.current = run
    barRef.current = 0
    setView({
      phase: 'running',
      score: 0,
      combo: 0,
      accuracy: 0,
      districts: 0,
      flash: null,
      bar: 0,
      cueStates: cueStatesFor(0),
      hint: null,
      results: null,
    })
    const ok = await seq.playArrangement({
      kitId: ch.kitId,
      bars: ch.bars,
      isPlayerStep: (bar, track, step) => isPlayerStep(playerRef.current, bar, track, step),
      // Exact cue times: on the first scheduled step, place every cue on the audio clock.
      onScheduled: (bar, step, time, stepSec) => {
        if (bar !== 0 || step !== 0 || runRef.current !== run) return
        const t0 = time
        for (const c of run.cues as Cue[]) c.time = t0 + (c.bar * 16 + c.step) * stepSec
      },
      onEnd: () => finish(),
    })
    if (!ok) {
      runRef.current = null
      setView((v) => ({ ...v, phase: 'idle' }))
      return
    }
    seq.announce(`${ch.name}. Press F for kick and J for snare on the glowing steps. Escape quits.`)
  }, [seq, finish, cueStatesFor])

  const quit = useCallback(() => {
    if (view.phase !== 'running') return
    runRef.current = null
    seq.stop('Challenge stopped')
    setView((v) => ({ ...v, phase: 'idle', hint: null }))
  }, [seq, view.phase])

  const backToSandbox = useCallback(() => {
    setView((v) => ({ ...v, phase: 'idle', results: null, districts: 0 }))
  }, [])

  const toggleAssist = useCallback(() => {
    const next = { ...progressRef.current, assist: !progressRef.current.assist }
    progressRef.current = next
    setProgress(next)
    saveProgress(next)
    seq.announce(next.assist ? 'Assist mode on: wider timing windows' : 'Assist mode off')
  }, [seq])

  /** A pad press at `eventTimeStamp` (performance.now() timebase). */
  const hit = useCallback(
    (pad: Pad, eventTimeStamp: number) => {
      const run = runRef.current
      if (!run || view.phase !== 'running') return
      const heard = seq.heardTimeAt(eventTimeStamp)
      const r = press(run, pad, heard, windows())
      if (r.kind === 'ignored') return
      if (r.kind === 'hit') seq.hitNow(pad, r.judgement === 'perfect' ? 1 : r.judgement === 'great' ? 0.9 : 0.75)
      flashId.current++
      refresh({
        flash:
          r.kind === 'hit'
            ? { id: flashId.current, text: r.judgement.toUpperCase(), kind: r.judgement }
            : { id: flashId.current, text: '×', kind: 'stray' },
      })
    },
    [seq, view.phase, refresh],
  )

  // Keyboard: F / J (no auto-repeat), Escape quits.
  useEffect(() => {
    if (view.phase !== 'running') return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        e.preventDefault()
        quit()
        return
      }
      if (e.repeat) return
      const pad = challengeRef.current.pads.find((p) => p.key === e.key.toLowerCase())?.pad
      if (!pad) return
      e.preventDefault()
      hit(pad, e.timeStamp)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view.phase, hit, quit])

  // Per frame: sweep misses and update hints. Per heard step: track bars and districts.
  useEffect(() => {
    if (view.phase !== 'running') return
    const offFrame = seq.onFrame(() => {
      const run = runRef.current
      if (!run || !(run.cues[0]?.time > 0)) return
      const now = seq.heardNow()
      const missed = sweep(run, now, windows())
      let hint: Pad | null = null
      if (firstAttemptRef.current) {
        const next = run.cues.find((c) => !run.judged.has(c.id))
        if (next && next.id < challengeRef.current.hinted && now >= next.time - 0.3) hint = next.pad
      }
      if (missed.length) {
        flashId.current++
        refresh({ hint, flash: { id: flashId.current, text: 'MISS', kind: 'miss' } })
      } else
        setView((v) => (v.hint === hint ? v : { ...v, hint }))
    })
    const offStep = seq.onStep((ev) => {
      if (ev.bar === barRef.current) return
      const run = runRef.current
      const finished = barRef.current
      barRef.current = ev.bar
      // A bar with cues and no miss/stray lights the next district.
      const hadCues = run?.cues.some((c) => c.bar === finished)
      setView((v) => ({
        ...v,
        bar: ev.bar,
        cueStates: cueStatesFor(ev.bar),
        districts: run && hadCues && !run.dirtyBars.has(finished) ? Math.min(DISTRICTS, v.districts + 1) : v.districts,
      }))
    })
    return () => {
      offFrame()
      offStep()
    }
  }, [view.phase, seq, refresh, cueStatesFor])

  // DEV-only automation handle (stripped from production builds): lets the Chrome verification
  // scripts read exact cue times and convert event timestamps exactly as the judge does.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __arcade?: unknown }
    w.__arcade = {
      cues: () => runRef.current?.cues ?? [],
      heardAt: (ts: number) => seq.heardTimeAt(ts),
      heardNow: () => seq.heardNow(),
    }
    return () => {
      delete w.__arcade
    }
  }, [seq])

  return {
    view: { ...view, challenge, progress } as ArcadeView,
    start,
    quit,
    hit,
    backToSandbox,
    toggleAssist,
  }
}
