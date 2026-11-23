// Wires sequence state (React) to the audio engine + scheduler (plain classes)
// and runs the single render loop that publishes step events at the moment they are heard.
// The current step is NOT React state: subscribers update the DOM/canvas directly.
//
// V3.0 slice: two playback modes share one engine, scheduler and render loop.
//  - SANDBOX: the editable grid drums (with the kit's composed accents) + the kit's looping
//    main section (bass, chords, leads, extra drums).
//  - ARRANGEMENT (Arcade): a fixed list of kit bars, intro → end, with chosen grid tracks muted
//    so the player can perform them; stops itself after the last bar.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AudioEngine, type AudioStatus } from '@/audio/engine'
import { playKitStep } from '@/audio/kitPlayer'
import { Scheduler, stepDuration, type StepEvent } from '@/audio/scheduler'
import { barPattern, barVel, kitById, kitGrid, section, type Bar, type KitId } from '@/data/kits'
import { clampBpm, clonePattern, emptyPattern, isEmpty, samePattern, type Pattern, type TrackId } from '@/data/patterns'
import { remix as rollRemix, type Change } from '@/data/remix'

interface State {
  pattern: Pattern
  bpm: number
  /** The kit the current pattern came from (drives backing layers and the city mood). */
  kitId: KitId
}

type Action =
  | { type: 'toggle'; track: TrackId; step: number }
  | { type: 'clear' }
  | { type: 'set'; pattern: Pattern; bpm: number; kitId: KitId }
  | { type: 'bpm'; bpm: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle': {
      const row = [...state.pattern[action.track]]
      row[action.step] = !row[action.step]
      return { ...state, pattern: { ...state.pattern, [action.track]: row } }
    }
    case 'clear':
      return { ...state, pattern: emptyPattern() }
    case 'set':
      return { pattern: clonePattern(action.pattern), bpm: clampBpm(action.bpm), kitId: action.kitId }
    case 'bpm':
      return { ...state, bpm: clampBpm(action.bpm) }
  }
}

/** Undo history entry: the state before a remix, clear, or kit change. */
interface Snapshot {
  pattern: Pattern
  bpm: number
  kitId: KitId
  /** What replaced this state (for the undo announcement). */
  by: 'remix' | 'clear' | 'kit'
}
const HISTORY_LIMIT = 30

/** Arrangement playback (Arcade). */
export interface ArrangementSpec {
  kitId: KitId
  bars: Bar[]
  /** Grid tracks the player performs (not played by the backing). */
  muted: ReadonlySet<TrackId>
  /** Called for every scheduled step (arcade cue registration), at its exact audio time. */
  onScheduled?: (bar: number, step: number, time: number, stepSec: number) => void
  /** Called once the last bar has been heard and its tail has rung out. */
  onEnd?: () => void
}

/** `frameTime` is the rAF timestamp of the frame publishing the step (same timebase as FrameListener). */
export type StepListener = (e: StepEvent, frameTime: number) => void
export type TransportListener = (playing: boolean) => void
/** Called once per animation frame, after that frame's step events (rAF timestamp, ms). */
export type FrameListener = (now: number) => void
/** UI cues for the scene's moments (no beat timing): blackout, ripple, lights-return. */
export type SceneCueName = 'cleared' | 'groove' | 'non-empty'
export type CueListener = (cue: SceneCueName) => void
/** An audition sound (or a player's arcade hit) was heard at `frameTime`. */
export type AuditionListener = (track: TrackId, stepMs: number, frameTime: number) => void
/** A remix was applied: the changed cells (for the grid's roll flash and the scene). */
export type RemixListener = (changes: Change[]) => void

export interface Sequencer {
  pattern: Pattern
  bpm: number
  kitId: KitId
  /** The pattern differs from the kit's composed grid. */
  edited: boolean
  canUndo: boolean
  playing: boolean
  /** 'sandbox' or 'arrangement' (Arcade). */
  mode: 'sandbox' | 'arrangement'
  audioStatus: AudioStatus
  /** Latest polite announcement for the live region. */
  announcement: string
  play: () => Promise<void>
  stop: (reason?: string) => void
  toggle: (track: TrackId, step: number) => void
  clear: () => void
  loadKit: (id: KitId) => void
  remix: () => void
  undo: () => void
  setBpm: (bpm: number) => void
  announce: (msg: string) => void
  /** Arcade: play a fixed arrangement. Resolves false if audio couldn't start. */
  playArrangement: (spec: ArrangementSpec) => Promise<boolean>
  /** Arcade: a player hit. Sounds now and makes the performer react. */
  hitNow: (track: TrackId, vel?: number) => void
  /** Arcade: audio-clock time the listener was hearing at an input event's timeStamp. */
  heardTimeAt: (eventTimeStamp: number) => number
  /** Audio-clock time currently being heard (for MISS detection). */
  heardNow: () => number
  onStep: (fn: StepListener) => () => void
  onTransport: (fn: TransportListener) => () => void
  onFrame: (fn: FrameListener) => () => void
  onCue: (fn: CueListener) => () => void
  onAudition: (fn: AuditionListener) => () => void
  onRemix: (fn: RemixListener) => () => void
}

const TAIL_MS = 1600

export function useSequencer(): Sequencer {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const k = kitById('neon-drive')
    return { pattern: clonePattern(kitGrid(k).pattern), bpm: k.bpm, kitId: k.id }
  })
  const [playing, setPlaying] = useState(false)
  const [mode, setMode] = useState<'sandbox' | 'arrangement'>('sandbox')
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('locked')
  const [announcement, setAnnouncement] = useState('')

  // The scheduler reads the latest values through refs, so edits never restart playback.
  const patternRef = useRef(state.pattern)
  const bpmRef = useRef(state.bpm)
  const kitRef = useRef<KitId>(state.kitId)
  useEffect(() => {
    patternRef.current = state.pattern
  }, [state.pattern])
  useEffect(() => {
    bpmRef.current = state.bpm
    engineRef.current?.setTempo(stepDuration(state.bpm))
  }, [state.bpm])
  useEffect(() => {
    kitRef.current = state.kitId
  }, [state.kitId])

  /** Non-null while an arrangement (Arcade) is playing. */
  const arrangementRef = useRef<ArrangementSpec | null>(null)

  /** Undo history (newest last) + whether Undo is available (for the button). */
  const historyRef = useRef<Snapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  /** The pattern a run of consecutive remixes started from (identity + drift anchor). */
  const remixOriginRef = useRef<Pattern | null>(null)
  const remixListeners = useRef(new Set<RemixListener>())

  const engineRef = useRef<AudioEngine | null>(null)
  const schedulerRef = useRef<Scheduler | null>(null)
  /** Which clock the current run uses: the audio clock, or a silent fallback when audio is blocked. */
  const clockRef = useRef<() => number>(silentClock)
  /** Incremented on every play/stop so an in-flight async play() can't override a later stop(). */
  const intentRef = useRef(0)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepListeners = useRef(new Set<StepListener>())
  const transportListeners = useRef(new Set<TransportListener>())
  const frameListeners = useRef(new Set<FrameListener>())
  const cueListeners = useRef(new Set<CueListener>())
  const auditionListeners = useRef(new Set<AuditionListener>())
  /** Auditions / player hits scheduled on the audio clock, waiting to be heard. */
  const auditionQueue = useRef<{ track: TrackId; time: number; stepMs: number }[]>([])

  const announce = useCallback((msg: string) => {
    // Re-announce identical messages by toggling a zero-width suffix.
    setAnnouncement((prev) => (prev === msg ? msg + '​' : msg))
  }, [])

  const emitTransport = useCallback((on: boolean) => {
    auditionQueue.current = []
    for (const fn of transportListeners.current) fn(on)
  }, [])

  const emitCue = useCallback((cue: SceneCueName) => {
    for (const fn of cueListeners.current) fn(cue)
  }, [])

  const stopInternal = useCallback(
    (reason?: string) => {
      intentRef.current++
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      endTimerRef.current = null
      const sched = schedulerRef.current
      const wasRunning = sched?.stop() ?? false
      engineRef.current?.cut()
      arrangementRef.current = null
      setMode('sandbox')
      if (wasRunning) {
        setPlaying(false)
        emitTransport(false)
        announce(reason ?? 'Stopped')
      }
    },
    [announce, emitTransport],
  )

  // Engine, scheduler, render loop, and lifecycle. Created in an effect so React StrictMode's
  // mount/unmount/mount cycle disposes the first instance cleanly.
  useEffect(() => {
    const engine = new AudioEngine()
    const audible = () => clockRef.current !== silentClock
    const scheduler = new Scheduler({
      now: () => clockRef.current(),
      getPattern: (bar) => {
        const arr = arrangementRef.current
        return arr ? (arr.bars[bar] ? barPattern(arr.bars[bar], arr.muted) : emptyPattern()) : patternRef.current
      },
      // Only the audio clock may schedule sound. In silent mode the times come from
      // performance.now() and must never reach the AudioContext (BUILD_STATUS D3).
      trigger: (track, time, step, bar) => {
        if (!audible()) return
        const arr = arrangementRef.current
        const vel = arr ? barVel(arr.bars[bar], track, step) : kitGrid(kitById(kitRef.current)).accents[track][step] || 0.85
        engine.trigger(track, time, vel)
      },
      getBpm: () => bpmRef.current,
      // Kit layers (bass, chords, leads, extra drums) at each step's exact time.
      onStepScheduled: (bar, step, time, stepSec) => {
        const arr = arrangementRef.current
        const kit = kitById(arr?.kitId ?? kitRef.current)
        const main = section(kit, 'main')
        const layerBar = arr ? arr.bars[bar] : main[bar % main.length]
        const v = audible() ? engine.voices() : null
        if (v && layerBar) playKitStep(v, kit, layerBar, step, time, stepSec)
        arr?.onScheduled?.(bar, step, time, stepSec)
      },
      getBarCount: () => arrangementRef.current?.bars.length ?? null,
    })
    engineRef.current = engine
    schedulerRef.current = scheduler

    const unsubscribe = engine.subscribe((s) => {
      setAudioStatus(s)
      // Interrupted mid-playback (iOS call, device change): the audio clock freezes, so stop.
      if (s === 'blocked' && scheduler.running && clockRef.current !== silentClock) {
        stopInternal('Stopped: sound was interrupted')
      }
      // Late unlock (BUILD_STATUS D3): restart the loop on the audio clock (sandbox only).
      if (s === 'running' && scheduler.running && clockRef.current === silentClock && !arrangementRef.current) {
        scheduler.stop()
        emitTransport(false)
        clockRef.current = () => engine.now()
        scheduler.start()
        emitTransport(true)
        announce(`Sound started. Playing at ${bpmRef.current} BPM`)
      }
    })

    // The single render loop (BUILD_STATUS D8): publish the steps that are now audible,
    // then let every renderer draw the same frame.
    let raf = 0
    const loop = (now: number) => {
      if (scheduler.running) {
        const usingAudio = clockRef.current !== silentClock
        const heardAt = clockRef.current() - (usingAudio ? engine.outputLatency() : 0)
        const events = scheduler.drain(heardAt)
        for (const ev of events) {
          for (const fn of stepListeners.current) fn(ev, now)
          // Arrangement end: after the last step is heard, let the tail ring out, then stop.
          const arr = arrangementRef.current
          if (arr && ev.bar === arr.bars.length - 1 && ev.step === 15 && !endTimerRef.current) {
            endTimerRef.current = setTimeout(() => {
              endTimerRef.current = null
              const done = arrangementRef.current?.onEnd
              stopInternal('Challenge complete')
              done?.()
            }, TAIL_MS)
          }
        }
      }
      // Auditions / player hits: publish when the sound is actually heard.
      const pending = auditionQueue.current
      if (pending.length) {
        const heardAt = engine.now() - engine.outputLatency()
        while (pending.length && pending[0].time <= heardAt) {
          const a = pending.shift()!
          for (const fn of auditionListeners.current) fn(a.track, a.stepMs, now)
        }
      }
      for (const fn of frameListeners.current) fn(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onVisibility = () => {
      if (document.hidden && scheduler.running) stopInternal('Stopped: tab hidden')
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
      unsubscribe()
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      scheduler.stop()
      engine.dispose()
      engineRef.current = null
      schedulerRef.current = null
    }
  }, [stopInternal, emitTransport, announce])

  const play = useCallback(async () => {
    const engine = engineRef.current
    const scheduler = schedulerRef.current
    if (!engine || !scheduler || scheduler.running) return
    const intent = ++intentRef.current
    const ok = await engine.unlock()
    // A Stop (or another Play) happened while we waited: respect the latest intent.
    if (intent !== intentRef.current || scheduler.running) return
    clockRef.current = ok ? () => engine.now() : silentClock
    engine.setTempo(stepDuration(bpmRef.current))
    arrangementRef.current = null
    setMode('sandbox')
    if (scheduler.start()) {
      setPlaying(true)
      emitTransport(true)
      announce(
        ok
          ? `Playing ${kitById(kitRef.current).name} at ${bpmRef.current} BPM`
          : 'Sound is blocked. Playing silently. Stop, then press Play again to retry.',
      )
    }
  }, [announce, emitTransport])

  const playArrangement = useCallback(
    async (spec: ArrangementSpec) => {
      const engine = engineRef.current
      const scheduler = schedulerRef.current
      if (!engine || !scheduler) return false
      if (scheduler.running) stopInternal()
      const intent = ++intentRef.current
      const ok = await engine.unlock()
      if (intent !== intentRef.current) return false
      if (!ok) {
        announce('Sound is blocked. Arcade challenges need sound: tap again to retry.')
        return false
      }
      const kit = kitById(spec.kitId)
      bpmRef.current = kit.bpm
      dispatch({ type: 'bpm', bpm: kit.bpm })
      clockRef.current = () => engine.now()
      engine.setTempo(stepDuration(kit.bpm))
      arrangementRef.current = spec
      setMode('arrangement')
      if (!scheduler.start()) return false
      setPlaying(true)
      emitTransport(true)
      return true
    },
    [announce, emitTransport, stopInternal],
  )

  const hitNow = useCallback((track: TrackId, vel = 1) => {
    const engine = engineRef.current
    if (!engine || clockRef.current === silentClock) return
    const time = engine.now() + 0.002
    engine.trigger(track, time, vel)
    auditionQueue.current.push({ track, time, stepMs: stepDuration(bpmRef.current) * 1000 })
  }, [])

  const heardTimeAt = useCallback((ts: number) => engineRef.current?.heardTimeAt(ts) ?? 0, [])
  const heardNow = useCallback(() => {
    const e = engineRef.current
    return e ? e.now() - e.outputLatency() : 0
  }, [])

  const toggle = useCallback(
    (track: TrackId, step: number) => {
      if (arrangementRef.current) return // the grid is a cue display during Arcade
      const turningOn = !patternRef.current[track][step]
      const wasEmpty = isEmpty(patternRef.current)
      remixOriginRef.current = null // a manual edit starts a new remix identity
      dispatch({ type: 'toggle', track, step })
      // First note after an empty pattern: the scene's lights return (after a blackout).
      if (turningOn && wasEmpty) emitCue('non-empty')
      // Audition while stopped, on toggle-on only (DESIGN.md §7.1).
      const engine = engineRef.current
      if (turningOn && engine && !schedulerRef.current?.running) {
        void engine.unlock().then((ok) => {
          if (!ok || schedulerRef.current?.running) return
          const time = engine.now() + 0.005
          engine.trigger(track, time, kitGrid(kitById(kitRef.current)).accents[track][step] || 0.85)
          auditionQueue.current.push({ track, time, stepMs: stepDuration(bpmRef.current) * 1000 })
        })
      }
    },
    [emitCue],
  )

  /** Record the current state so Undo can restore it. */
  const pushHistory = useCallback((by: Snapshot['by']) => {
    const h = historyRef.current
    h.push({ pattern: clonePattern(patternRef.current), bpm: bpmRef.current, kitId: kitRef.current, by })
    if (h.length > HISTORY_LIMIT) h.shift()
    setCanUndo(true)
  }, [])

  /** Apply a whole-pattern change now (refs first, so the scheduler and rapid presses see it). */
  const setAll = useCallback((pattern: Pattern, bpm: number, kitId: KitId) => {
    patternRef.current = pattern
    bpmRef.current = clampBpm(bpm)
    kitRef.current = kitId
    engineRef.current?.setTempo(stepDuration(bpmRef.current))
    dispatch({ type: 'set', pattern, bpm, kitId })
  }, [])

  const clear = useCallback(() => {
    if (arrangementRef.current || isEmpty(patternRef.current)) return
    pushHistory('clear')
    remixOriginRef.current = null
    patternRef.current = emptyPattern()
    dispatch({ type: 'clear' })
    emitCue('cleared')
    announce('Pattern cleared. Undo available.')
  }, [announce, emitCue, pushHistory])

  const loadKit = useCallback(
    (id: KitId) => {
      if (arrangementRef.current) return
      const k = kitById(id)
      const grid = kitGrid(k).pattern
      const unchanged = kitRef.current === id && bpmRef.current === k.bpm && samePattern(patternRef.current, grid)
      if (!unchanged) pushHistory('kit')
      remixOriginRef.current = null
      setAll(clonePattern(grid), k.bpm, k.id)
      emitCue('groove')
      announce(`${k.name} loaded, ${k.bpm} BPM`)
    },
    [announce, emitCue, pushHistory, setAll],
  )

  const remix = useCallback(() => {
    if (arrangementRef.current) return
    const current = patternRef.current
    const origin = remixOriginRef.current ?? current
    const { pattern, changes } = rollRemix(current, origin)
    pushHistory('remix')
    remixOriginRef.current = isEmpty(current) ? pattern : origin
    setAll(pattern, bpmRef.current, kitRef.current)
    for (const fn of remixListeners.current) fn(changes)
    if (isEmpty(current)) emitCue('non-empty')
    announce(`Remixed: ${changes.length} changes. Undo available.`)
  }, [announce, emitCue, pushHistory, setAll])

  const undo = useCallback(() => {
    if (arrangementRef.current) return
    const snap = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!snap) return
    const wasEmpty = isEmpty(patternRef.current)
    remixOriginRef.current = null
    setAll(snap.pattern, snap.bpm, snap.kitId)
    if (wasEmpty && !isEmpty(snap.pattern)) emitCue('non-empty')
    const what = { remix: 'remix', clear: 'clear', kit: 'kit change' }[snap.by]
    announce(`Undid ${what}. ${kitById(snap.kitId).name}, ${snap.bpm} BPM`)
  }, [announce, emitCue, setAll])

  const setBpm = useCallback((bpm: number) => dispatch({ type: 'bpm', bpm }), [])

  const listen = <T,>(set: { current: Set<T> }) => (fn: T) => {
    set.current.add(fn)
    return () => {
      set.current.delete(fn)
    }
  }
  /* eslint-disable react-hooks/exhaustive-deps */
  const onStep = useCallback(listen(stepListeners), [])
  const onTransport = useCallback(listen(transportListeners), [])
  const onFrame = useCallback(listen(frameListeners), [])
  const onCue = useCallback(listen(cueListeners), [])
  const onAudition = useCallback(listen(auditionListeners), [])
  const onRemix = useCallback(listen(remixListeners), [])
  /* eslint-enable react-hooks/exhaustive-deps */

  const edited = !samePattern(kitGrid(kitById(state.kitId)).pattern, state.pattern)

  return {
    pattern: state.pattern,
    kitId: state.kitId,
    edited,
    canUndo,
    bpm: state.bpm,
    playing,
    mode,
    audioStatus,
    announcement,
    play,
    stop: stopInternal,
    toggle,
    clear,
    loadKit,
    remix,
    undo,
    setBpm,
    announce,
    playArrangement,
    hitNow,
    heardTimeAt,
    heardNow,
    onStep,
    onTransport,
    onFrame,
    onCue,
    onAudition,
    onRemix,
  }
}

/** Fallback clock used when audio is blocked, so visuals still run (DESIGN.md §7.4). */
const silentClock = () => performance.now() / 1000
