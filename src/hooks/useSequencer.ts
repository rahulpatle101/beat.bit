// Wires sequence state (React) to the audio engine + scheduler (plain classes)
// and runs the single render loop that publishes step events at the moment they are heard.
// The current step is NOT React state: subscribers update the DOM/canvas directly.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AudioEngine, type AudioStatus } from '@/audio/engine'
import { Scheduler, stepDuration, type StepEvent } from '@/audio/scheduler'
import {
  clampBpm,
  clonePattern,
  emptyPattern,
  grooveById,
  isEmpty,
  samePattern,
  type GrooveId,
  type Pattern,
  type TrackId,
} from '@/data/patterns'
import { remix as rollRemix, type Change } from '@/data/remix'
import { PROFILES, generateMelody, midiFor, type Melody } from '@/data/melody'
import type { MelodySource } from '@/audio/scheduler'

interface State {
  pattern: Pattern
  bpm: number
  /** The curated groove the current pattern came from (drives the city mood). */
  grooveId: GrooveId
  /** V2.3 melody (scale degrees in the groove's key), its seed, and whether it plays. */
  melody: MelodyState
}

export interface MelodyState {
  notes: Melody
  seed: number
  on: boolean
}

/** The groove's curated default melody (keeps the current on/off). */
function defaultMelody(groove: GrooveId, drums: Pattern, on: boolean): MelodyState {
  const seed = PROFILES[groove].seed
  return { notes: generateMelody(groove, seed, drums), seed, on }
}

/** Resolve scale degrees to MIDI notes in the groove's key, for the scheduler. */
function melodySource(groove: GrooveId, m: MelodyState): MelodySource {
  return { on: m.on, notes: m.notes.map((d) => (d === null ? null : midiFor(groove, d))) }
}

type Action =
  | { type: 'toggle'; track: TrackId; step: number }
  | { type: 'clear' }
  | { type: 'set'; pattern: Pattern; bpm: number; grooveId: GrooveId; melody: MelodyState }
  | { type: 'melody'; melody: MelodyState }
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
      return {
        pattern: clonePattern(action.pattern),
        bpm: clampBpm(action.bpm),
        grooveId: action.grooveId,
        melody: action.melody,
      }
    case 'melody':
      return { ...state, melody: action.melody }
    case 'bpm':
      return { ...state, bpm: clampBpm(action.bpm) }
  }
}

/** Undo history entry: the state before a remix, clear, or groove change. */
interface Snapshot {
  pattern: Pattern
  bpm: number
  grooveId: GrooveId
  melody: MelodyState
  /** What replaced this state (for the undo announcement). */
  by: 'remix' | 'clear' | 'groove' | 'melody'
}
const HISTORY_LIMIT = 30

/** `frameTime` is the rAF timestamp of the frame publishing the step (same timebase as FrameListener). */
export type StepListener = (e: StepEvent, frameTime: number) => void
export type TransportListener = (playing: boolean) => void
/** Called once per animation frame, after that frame's step events (rAF timestamp, ms). */
export type FrameListener = (now: number) => void
/** UI cues for the scene's moments (no beat timing): blackout, ripple, lights-return. */
export type SceneCueName = 'cleared' | 'groove' | 'non-empty'
export type CueListener = (cue: SceneCueName) => void
/** An audition sound (step toggled on while stopped) was heard at `frameTime`. */
export type AuditionListener = (track: TrackId, stepMs: number, frameTime: number) => void
/** A remix was applied: the changed cells (for the grid's roll flash and the scene). */
export type RemixListener = (changes: Change[]) => void

export interface Sequencer {
  pattern: Pattern
  bpm: number
  grooveId: GrooveId
  /** V2.3 melody state (on/off, seed). */
  melodyOn: boolean
  melodySeed: number
  /** The pattern differs from the curated groove it came from. */
  edited: boolean
  canUndo: boolean
  playing: boolean
  audioStatus: AudioStatus
  /** Latest polite announcement for the live region. */
  announcement: string
  play: () => Promise<void>
  stop: (reason?: string) => void
  toggle: (track: TrackId, step: number) => void
  clear: () => void
  loadGroove: (id: GrooveId) => void
  remix: () => void
  undo: () => void
  /** V2.3: melody on/off. */
  toggleMelody: () => void
  /** V2.3: a new seeded melody for the current groove (undoable). */
  newMelody: () => void
  setBpm: (bpm: number) => void
  /** Called once per step, at the time the step is heard. */
  onStep: (fn: StepListener) => () => void
  /** Called whenever the transport starts or stops. */
  onTransport: (fn: TransportListener) => () => void
  /**
   * Called every animation frame from the single render loop, after step events are
   * published. Renderers draw here so the grid and scene never disagree by a frame.
   */
  onFrame: (fn: FrameListener) => () => void
  /** Clear / Groove / first note after empty. */
  onCue: (fn: CueListener) => () => void
  /** Audition sounds, published by the render loop when heard. */
  onAudition: (fn: AuditionListener) => () => void
  /** Remix rolls (UI response, not beat timing). */
  onRemix: (fn: RemixListener) => () => void
}

export function useSequencer(): Sequencer {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const g = grooveById('signal')
    // Melody is OFF on first load, so first Play is identical to V2.2.
    return { pattern: clonePattern(g.pattern), bpm: g.bpm, grooveId: g.id, melody: defaultMelody(g.id, g.pattern, false) }
  })
  const [playing, setPlaying] = useState(false)
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('locked')
  const [announcement, setAnnouncement] = useState('')

  // The scheduler reads the latest values through refs, so edits never restart playback.
  const patternRef = useRef(state.pattern)
  const bpmRef = useRef(state.bpm)
  useEffect(() => {
    patternRef.current = state.pattern
  }, [state.pattern])
  useEffect(() => {
    bpmRef.current = state.bpm
  }, [state.bpm])
  const grooveRef = useRef<GrooveId>(state.grooveId)
  useEffect(() => {
    grooveRef.current = state.grooveId
  }, [state.grooveId])

  // V2.3: the scheduler reads the melody (resolved to MIDI) through a ref, like the pattern.
  const melodyStateRef = useRef<MelodyState>(state.melody)
  const melodyRef = useRef<MelodySource>(melodySource(state.grooveId, state.melody))
  useEffect(() => {
    melodyStateRef.current = state.melody
    melodyRef.current = melodySource(state.grooveId, state.melody)
  }, [state.melody, state.grooveId])

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
  const stepListeners = useRef(new Set<StepListener>())
  const transportListeners = useRef(new Set<TransportListener>())
  const frameListeners = useRef(new Set<FrameListener>())
  const cueListeners = useRef(new Set<CueListener>())
  const auditionListeners = useRef(new Set<AuditionListener>())
  /** Auditions scheduled on the audio clock, waiting to be heard. */
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
      const sched = schedulerRef.current
      const wasRunning = sched?.stop() ?? false
      engineRef.current?.cut()
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
    const scheduler = new Scheduler({
      now: () => clockRef.current(),
      // Only the audio clock may schedule sound. In silent mode the times come from
      // performance.now() and must never reach the AudioContext (BUILD_STATUS D3).
      trigger: (track, time) => {
        if (clockRef.current !== silentClock) engine.trigger(track, time)
      },
      getPattern: () => patternRef.current,
      getBpm: () => bpmRef.current,
      getMelody: () => melodyRef.current,
      // Like drums: only the audio clock may schedule sound (silent mode skips the lead).
      triggerNote: (midi, time, stepSec) => {
        if (clockRef.current !== silentClock) engine.triggerLead(midi, time, stepSec)
      },
    })
    engineRef.current = engine
    schedulerRef.current = scheduler

    const unsubscribe = engine.subscribe((s) => {
      setAudioStatus(s)
      // Interrupted mid-playback (iOS call, device change): the audio clock freezes, so stop.
      if (s === 'blocked' && scheduler.running && clockRef.current !== silentClock) {
        stopInternal('Stopped: sound was interrupted')
      }
      // Late unlock (BUILD_STATUS D3): the context started running after we fell back to
      // silent mode. Restart the loop on the audio clock so sound and visuals share one clock.
      if (s === 'running' && scheduler.running && clockRef.current === silentClock) {
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
        for (const ev of events) for (const fn of stepListeners.current) fn(ev, now)
      }
      // Auditions: publish when the audition sound is actually heard.
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
    if (scheduler.start()) {
      setPlaying(true)
      emitTransport(true)
      announce(
        ok
          ? `Playing at ${bpmRef.current} BPM`
          : 'Sound is blocked. Playing silently. Stop, then press Play again to retry.',
      )
    }
  }, [announce, emitTransport])

  const toggle = useCallback(
    (track: TrackId, step: number) => {
      const turningOn = !patternRef.current[track][step]
      const wasEmpty = isEmpty(patternRef.current)
      remixOriginRef.current = null // a manual edit starts a new remix identity
      dispatch({ type: 'toggle', track, step })
      // First note after an empty pattern: the scene's lights return (after a blackout).
      if (turningOn && wasEmpty) emitCue('non-empty')
      // Audition while stopped, on toggle-on only (DESIGN.md §7.1). Toggling is a user
      // gesture, so it may also unlock audio.
      const engine = engineRef.current
      if (turningOn && engine && !schedulerRef.current?.running) {
        // Audition performs (V2.1): the performer reacts when the audition sound is heard.
        void engine.unlock().then((ok) => {
          if (!ok || schedulerRef.current?.running) return
          const time = engine.now() + 0.005
          engine.trigger(track, time)
          auditionQueue.current.push({ track, time, stepMs: stepDuration(bpmRef.current) * 1000 })
        })
      }
    },
    [emitCue],
  )

  /** Record the current state so Undo can restore it. */
  const pushHistory = useCallback((by: Snapshot['by']) => {
    const h = historyRef.current
    h.push({
      pattern: clonePattern(patternRef.current),
      bpm: bpmRef.current,
      grooveId: grooveRef.current,
      melody: melodyStateRef.current,
      by,
    })
    if (h.length > HISTORY_LIMIT) h.shift()
    setCanUndo(true)
  }, [])

  /** Apply a whole-pattern change now (refs first, so the scheduler and rapid presses see it). */
  const setAll = useCallback((pattern: Pattern, bpm: number, grooveId: GrooveId, melody?: MelodyState) => {
    const m = melody ?? melodyStateRef.current
    patternRef.current = pattern
    bpmRef.current = clampBpm(bpm)
    grooveRef.current = grooveId
    melodyStateRef.current = m
    melodyRef.current = melodySource(grooveId, m)
    dispatch({ type: 'set', pattern, bpm, grooveId, melody: m })
  }, [])

  const clear = useCallback(() => {
    if (isEmpty(patternRef.current)) return
    pushHistory('clear')
    remixOriginRef.current = null
    patternRef.current = emptyPattern()
    dispatch({ type: 'clear' })
    emitCue('cleared')
    announce('Pattern cleared. Undo available.')
  }, [announce, emitCue, pushHistory])

  const loadGroove = useCallback(
    (id: GrooveId) => {
      const g = grooveById(id)
      const unchanged =
        grooveRef.current === id &&
        bpmRef.current === g.bpm &&
        samePattern(patternRef.current, g.pattern) &&
        melodyStateRef.current.seed === PROFILES[id].seed
      if (!unchanged) pushHistory('groove')
      remixOriginRef.current = null
      setAll(clonePattern(g.pattern), g.bpm, g.id, defaultMelody(g.id, g.pattern, melodyStateRef.current.on))
      emitCue('groove')
      announce(`${g.name} loaded, ${g.bpm} BPM`)
    },
    [announce, emitCue, pushHistory, setAll],
  )

  const remix = useCallback(() => {
    const current = patternRef.current
    const origin = remixOriginRef.current ?? current
    const { pattern, changes } = rollRemix(current, origin)
    pushHistory('remix')
    remixOriginRef.current = isEmpty(current) ? pattern : origin
    setAll(pattern, bpmRef.current, grooveRef.current)
    for (const fn of remixListeners.current) fn(changes)
    if (isEmpty(current)) emitCue('non-empty')
    announce(`Remixed: ${changes.length} changes. Undo available.`)
  }, [announce, emitCue, pushHistory, setAll])

  const undo = useCallback(() => {
    const snap = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!snap) return
    const wasEmpty = isEmpty(patternRef.current)
    remixOriginRef.current = null
    setAll(snap.pattern, snap.bpm, snap.grooveId, snap.melody)
    if (wasEmpty && !isEmpty(snap.pattern)) emitCue('non-empty')
    const what = { remix: 'remix', clear: 'clear', groove: 'groove change', melody: 'new melody' }[snap.by]
    announce(`Undid ${what}. ${grooveById(snap.grooveId).name}, ${snap.bpm} BPM`)
  }, [announce, emitCue, setAll])

  const setBpm = useCallback((bpm: number) => dispatch({ type: 'bpm', bpm }), [])

  const onStep = useCallback((fn: StepListener) => {
    stepListeners.current.add(fn)
    return () => {
      stepListeners.current.delete(fn)
    }
  }, [])

  const onTransport = useCallback((fn: TransportListener) => {
    transportListeners.current.add(fn)
    return () => {
      transportListeners.current.delete(fn)
    }
  }, [])

  const onFrame = useCallback((fn: FrameListener) => {
    frameListeners.current.add(fn)
    return () => {
      frameListeners.current.delete(fn)
    }
  }, [])

  const onCue = useCallback((fn: CueListener) => {
    cueListeners.current.add(fn)
    return () => {
      cueListeners.current.delete(fn)
    }
  }, [])

  const onAudition = useCallback((fn: AuditionListener) => {
    auditionListeners.current.add(fn)
    return () => {
      auditionListeners.current.delete(fn)
    }
  }, [])

  const toggleMelody = useCallback(() => {
    const m = { ...melodyStateRef.current, on: !melodyStateRef.current.on }
    melodyStateRef.current = m
    melodyRef.current = melodySource(grooveRef.current, m)
    dispatch({ type: 'melody', melody: m })
    announce(m.on ? `Melody on, #${String(m.seed).padStart(4, '0')}` : 'Melody off')
  }, [announce])

  const newMelody = useCallback(() => {
    pushHistory('melody')
    const prev = melodyStateRef.current
    let seed = prev.seed
    while (seed === prev.seed) seed = 1 + Math.floor(Math.random() * 9999)
    const m: MelodyState = { notes: generateMelody(grooveRef.current, seed, patternRef.current), seed, on: true }
    melodyStateRef.current = m
    melodyRef.current = melodySource(grooveRef.current, m)
    dispatch({ type: 'melody', melody: m })
    announce(`New melody #${String(seed).padStart(4, '0')}. Undo available.`)
  }, [announce, pushHistory])

  const onRemix = useCallback((fn: RemixListener) => {
    remixListeners.current.add(fn)
    return () => {
      remixListeners.current.delete(fn)
    }
  }, [])

  const groove = grooveById(state.grooveId)
  const edited = !samePattern(groove.pattern, state.pattern)

  return {
    pattern: state.pattern,
    grooveId: state.grooveId,
    edited,
    canUndo,
    melodyOn: state.melody.on,
    melodySeed: state.melody.seed,
    bpm: state.bpm,
    playing,
    audioStatus,
    announcement,
    play,
    stop: stopInternal,
    toggle,
    clear,
    loadGroove,
    remix,
    undo,
    toggleMelody,
    newMelody,
    setBpm,
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
