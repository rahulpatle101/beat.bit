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
import { sandboxDrumVel, sandboxLayerBar } from '@/audio/sandbox'
import { Scheduler, stepDuration, type StepEvent } from '@/audio/scheduler'
import { barPattern, barVel, kitById, kitGrid, section, type Bar, type KitId } from '@/data/kits'
import { TRACK_IDS, clampBpm, clonePattern, emptyPattern, isEmpty, samePattern, type Pattern, type TrackId } from '@/data/patterns'
import { remix as rollRemix, type Change } from '@/data/remix'
import {
  BAND_LABEL,
  DEFAULT_PARTS,
  DEFAULT_TEMPERATURE,
  bandOf,
  chordsRemixable,
  cloneBars,
  drumOptions,
  originComposition,
  partRng,
  remixMusic,
  type Part,
} from '@/data/remixMusic'

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

/** Undo history entry: the complete state before a remix, clear, restore, or kit change. */
interface Snapshot {
  pattern: Pattern
  /** The kit's main bars as they were (V3.4 music Remix). */
  music: Bar[]
  bpm: number
  kitId: KitId
  /** What replaced this state (for the undo announcement). */
  by: 'remix' | 'clear' | 'kit' | 'restore'
}

/** V3.4 Remix settings. */
export interface RemixSettings {
  temperature: number
  parts: Part[]
}

/** A change waiting for the next bar line while playing (drums + music switch together). */
interface Pending {
  pattern: Pattern
  music: Bar[]
  changes: Change[]
  /** True for a Remix roll (drives the die + the grid's roll flash); false for undo/restore. */
  roll: boolean
}
const HISTORY_LIMIT = 30

/** Arrangement playback (Arcade). */
export interface ArrangementSpec {
  kitId: KitId
  bars: Bar[]
  /** Steps the player performs (not played by the backing). Everything else plays as composed. */
  isPlayerStep: (bar: number, track: TrackId, step: number) => boolean
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
  /** V3.4: the kit's main bars as currently played (melody/bass/chords after Remix). */
  music: Bar[]
  /** Anything (grid or music) differs from the kit's original. Enables RESTORE ORIGINAL. */
  modified: boolean
  remixSettings: RemixSettings
  setRemixSettings: (s: RemixSettings) => void
  /** Parts the current kit can't remix safely, with the reason. */
  remixUnavailable: Partial<Record<Part, string>>
  /** Seed of the last remix roll (null before the first). */
  lastSeed: number | null
  /** Back to the kit's composed grid and music (undoable). */
  restoreOriginal: () => void
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
  const [music, setMusic] = useState<Bar[]>(() => originComposition(kitById('neon-drive')))
  const [remixSettings, setRemixSettingsState] = useState<RemixSettings>({ temperature: DEFAULT_TEMPERATURE, parts: DEFAULT_PARTS })
  const [lastSeed, setLastSeed] = useState<number | null>(null)

  // The scheduler reads the latest values through refs, so edits never restart playback.
  const patternRef = useRef(state.pattern)
  const bpmRef = useRef(state.bpm)
  const kitRef = useRef<KitId>(state.kitId)
  /** The main bars the scheduler plays (applied state). */
  const musicRef = useRef<Bar[]>(music)
  /** A remix/undo/restore waiting for the next bar line (while playing). */
  const pendingRef = useRef<Pending | null>(null)
  const remixSettingsRef = useRef(remixSettings)
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

  /** A bar-line change whose audio is already scheduled; shown when its downbeat is HEARD. */
  const visualRef = useRef<{ p: Pending; at: number } | null>(null)

  /** Publish a change to React + listeners (grid, die, roll flash). */
  const showNow = useCallback((p: Pending) => {
    dispatch({ type: 'set', pattern: p.pattern, bpm: bpmRef.current, kitId: kitRef.current })
    setMusic(p.music)
    if (p.roll) for (const fn of remixListeners.current) fn(p.changes)
  }, [])

  /** Make a pattern + music the playing state now (refs first, then React, then listeners). */
  const applyNow = useCallback(
    (p: Pending) => {
      visualRef.current = null
      patternRef.current = p.pattern
      musicRef.current = p.music
      showNow(p)
    },
    [showNow],
  )

  /** The latest intended state (a pending change counts as already made). */
  const latest = useCallback((): { pattern: Pattern; music: Bar[] } => pendingRef.current ?? { pattern: patternRef.current, music: musicRef.current }, [])
  // (patternRef/musicRef already hold a change that is only waiting to be shown.)

  /** While playing, hold the change for the next bar line; otherwise apply it now. Returns true if deferred. */
  const commit = useCallback(
    (p: Pending): boolean => {
      if (schedulerRef.current?.running && !arrangementRef.current) {
        pendingRef.current = p
        return true
      }
      pendingRef.current = null
      applyNow(p)
      return false
    },
    [applyNow],
  )

  const stopInternal = useCallback(
    (reason?: string) => {
      intentRef.current++
      // A change waiting for the bar line lands immediately when playback stops.
      const pend = pendingRef.current ?? visualRef.current?.p ?? null
      pendingRef.current = null
      if (pend) applyNow(pend)
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
    [announce, emitTransport, applyNow],
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
        if (!arr) return patternRef.current
        if (!arr.bars[bar]) return emptyPattern()
        const p = barPattern(arr.bars[bar])
        for (const t of TRACK_IDS) for (let s = 0; s < 16; s++) if (p[t][s] && arr.isPlayerStep(bar, t, s)) p[t][s] = false
        return p
      },
      // Only the audio clock may schedule sound. In silent mode the times come from
      // performance.now() and must never reach the AudioContext (BUILD_STATUS D3).
      trigger: (track, time, step, bar) => {
        if (!audible()) return
        const arr = arrangementRef.current
        const vel = arr ? barVel(arr.bars[bar], track, step) : sandboxDrumVel(kitById(kitRef.current), track, step)
        engine.trigger(track, time, vel)
      },
      getBpm: () => bpmRef.current,
      // Kit layers (bass, chords, leads, extra drums) at each step's exact time.
      onStepScheduled: (bar, step, time, stepSec) => {
        const arr = arrangementRef.current
        const kit = kitById(arr?.kitId ?? kitRef.current)
        const layerBar = arr ? arr.bars[bar] : sandboxLayerBar(kit, bar, musicRef.current)
        const v = audible() ? engine.voices() : null
        if (v && layerBar) playKitStep(v, kit, layerBar, step, time, stepSec)
        arr?.onScheduled?.(bar, step, time, stepSec)
        // V3.4: a pending remix/undo lands on the bar line: everything from the next step 1 on
        // (drums, melody, bass, chords) reads the new state together. Notes already scheduled
        // finish on their own envelopes, so nothing is cut or left hanging.
        if (!arr && step === 15 && pendingRef.current) {
          const p = pendingRef.current
          pendingRef.current = null
          // Audio: from the next step on (refs). Visuals: when that downbeat is heard (render loop).
          patternRef.current = p.pattern
          musicRef.current = p.music
          visualRef.current = { p, at: time + stepSec }
        }
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
        const vis = visualRef.current
        if (vis && heardAt >= vis.at) {
          visualRef.current = null
          showNow(vis.p)
        }
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
  }, [stopInternal, emitTransport, announce, showNow])

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
      // A remix waiting for the bar line keeps this edit too.
      const flip = (pt: Pattern): Pattern => {
        const row = [...pt[track]]
        row[step] = !row[step]
        return { ...pt, [track]: row }
      }
      const pend = pendingRef.current
      if (pend) pendingRef.current = { ...pend, pattern: flip(pend.pattern) }
      const vis = visualRef.current
      if (vis) {
        // Already playing, not yet shown: edit the playing pattern and the one about to be shown.
        patternRef.current = flip(patternRef.current)
        visualRef.current = { ...vis, p: { ...vis.p, pattern: patternRef.current } }
      }
      // First note after an empty pattern: the scene's lights return (after a blackout).
      if (turningOn && wasEmpty) emitCue('non-empty')
      // Audition while stopped, on toggle-on only (DESIGN.md §7.1).
      const engine = engineRef.current
      if (turningOn && engine && !schedulerRef.current?.running) {
        void engine.unlock().then((ok) => {
          if (!ok || schedulerRef.current?.running) return
          const time = engine.now() + 0.005
          engine.trigger(track, time, sandboxDrumVel(kitById(kitRef.current), track, step))
          auditionQueue.current.push({ track, time, stepMs: stepDuration(bpmRef.current) * 1000 })
        })
      }
    },
    [emitCue],
  )

  /** Record the current state so Undo can restore it. */
  const pushHistory = useCallback((by: Snapshot['by']) => {
    const h = historyRef.current
    const cur = latest()
    h.push({ pattern: clonePattern(cur.pattern), music: cloneBars(cur.music), bpm: bpmRef.current, kitId: kitRef.current, by })
    if (h.length > HISTORY_LIMIT) h.shift()
    setCanUndo(true)
  }, [latest])

  /** Apply a whole-pattern change now (refs first, so the scheduler and rapid presses see it). */
  const setAll = useCallback((pattern: Pattern, bpm: number, kitId: KitId, bars: Bar[]) => {
    pendingRef.current = null
    patternRef.current = pattern
    musicRef.current = bars
    bpmRef.current = clampBpm(bpm)
    kitRef.current = kitId
    engineRef.current?.setTempo(stepDuration(bpmRef.current))
    dispatch({ type: 'set', pattern, bpm, kitId })
    setMusic(bars)
  }, [])

  const clear = useCallback(() => {
    if (arrangementRef.current || isEmpty(latest().pattern)) return
    pushHistory('clear')
    remixOriginRef.current = null
    // Clear empties the drum grid only (melody/bass keep playing); it applies immediately.
    const keepMusic = latest().music
    pendingRef.current = null
    patternRef.current = emptyPattern()
    musicRef.current = keepMusic
    setMusic(keepMusic)
    dispatch({ type: 'clear' })
    emitCue('cleared')
    announce('Pattern cleared. Undo available.')
  }, [announce, emitCue, pushHistory, latest])

  const loadKit = useCallback(
    (id: KitId) => {
      if (arrangementRef.current) return
      const k = kitById(id)
      const grid = kitGrid(k).pattern
      const cur = latest()
      const unchanged = kitRef.current === id && bpmRef.current === k.bpm && samePattern(cur.pattern, grid) && sameBars(cur.music, originComposition(k))
      if (!unchanged) pushHistory('kit')
      remixOriginRef.current = null
      setAll(clonePattern(grid), k.bpm, k.id, originComposition(k))
      emitCue('groove')
      announce(`${k.name} loaded, ${k.bpm} BPM`)
    },
    [announce, emitCue, pushHistory, setAll, latest],
  )

  const remix = useCallback(() => {
    if (arrangementRef.current) return
    const { temperature, parts } = remixSettingsRef.current
    const kit = kitById(kitRef.current)
    const cur = latest()
    // One seed per roll; every part derives its own stream from it (same seed → same result).
    const seed = (Math.random() * 2 ** 32) >>> 0
    let pattern = cur.pattern
    let changes: Change[] = []
    if (parts.includes('drums')) {
      // Drum identity: the pattern this run of remixes started from (keeps manual edits).
      const origin = remixOriginRef.current ?? cur.pattern
      const r = rollRemix(cur.pattern, origin, partRng(seed, 'drums'), drumOptions(temperature))
      pattern = r.pattern
      changes = r.changes
      remixOriginRef.current = isEmpty(cur.pattern) ? pattern : origin
    }
    const res = remixMusic({ kit, origin: originComposition(kit), current: cur.music, kick: pattern.kick, seed, temperature, parts })
    pushHistory('remix')
    const deferred = commit({ pattern, music: res.bars, changes, roll: true })
    setLastSeed(seed)
    if (isEmpty(cur.pattern) && !isEmpty(pattern)) emitCue('non-empty')
    const summary = [
      parts.includes('drums') && `drums ${changes.length}`,
      parts.includes('melody') && `melody ${res.changed.melody}`,
      parts.includes('bass') && `bass ${res.changed.bass}`,
      parts.includes('chords') && chordsRemixable(originComposition(kit)) && `chords ${res.changed.chords}`,
    ]
      .filter(Boolean)
      .join(', ')
    announce(`Remixed, ${BAND_LABEL[bandOf(temperature)].toLowerCase()}: ${summary}.${deferred ? ' Lands on the next bar.' : ''} Undo available.`)
  }, [announce, emitCue, pushHistory, commit, latest])

  const restoreOriginal = useCallback(() => {
    if (arrangementRef.current) return
    const kit = kitById(kitRef.current)
    const grid = clonePattern(kitGrid(kit).pattern)
    const cur = latest()
    if (samePattern(cur.pattern, grid) && sameBars(cur.music, originComposition(kit))) return
    pushHistory('restore')
    remixOriginRef.current = null
    const deferred = commit({ pattern: grid, music: originComposition(kit), changes: [], roll: false })
    if (isEmpty(cur.pattern)) emitCue('non-empty')
    announce(`${kit.name} restored to the original.${deferred ? ' Lands on the next bar.' : ''} Undo available.`)
  }, [announce, emitCue, pushHistory, commit, latest])

  const undo = useCallback(() => {
    if (arrangementRef.current) return
    const snap = historyRef.current.pop()
    setCanUndo(historyRef.current.length > 0)
    if (!snap) return
    const wasEmpty = isEmpty(latest().pattern)
    remixOriginRef.current = null
    let deferred = false
    if (snap.kitId === kitRef.current && snap.bpm === bpmRef.current) {
      // Same kit and tempo: the exact previous pattern + music, on the next bar line while playing.
      deferred = commit({ pattern: clonePattern(snap.pattern), music: cloneBars(snap.music), changes: [], roll: false })
    } else setAll(clonePattern(snap.pattern), snap.bpm, snap.kitId, cloneBars(snap.music))
    if (wasEmpty && !isEmpty(snap.pattern)) emitCue('non-empty')
    const what = { remix: 'remix', clear: 'clear', kit: 'kit change', restore: 'restore' }[snap.by]
    announce(`Undid ${what}. ${kitById(snap.kitId).name}, ${snap.bpm} BPM${deferred ? '. Lands on the next bar.' : ''}`)
  }, [announce, emitCue, setAll, commit, latest])

  const setRemixSettings = useCallback((s: RemixSettings) => {
    remixSettingsRef.current = s
    setRemixSettingsState(s)
  }, [])

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

  const kitNow = kitById(state.kitId)
  const edited = !samePattern(kitGrid(kitNow).pattern, state.pattern)
  const modified = edited || !sameBars(music, originComposition(kitNow))
  const remixUnavailable: Partial<Record<Part, string>> = chordsRemixable(section(kitNow, 'main'))
    ? {}
    : { chords: `${kitNow.name} sustains its chords; only stab chords are remixed` }

  return {
    pattern: state.pattern,
    kitId: state.kitId,
    edited,
    music,
    modified,
    remixSettings,
    setRemixSettings,
    remixUnavailable,
    lastSeed,
    restoreOriginal,
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

/** Structural equality for composition bars (small arrays; JSON is exact for this data). */
const sameBars = (a: Bar[], b: Bar[]) => JSON.stringify(a) === JSON.stringify(b)

/** Fallback clock used when audio is blocked, so visuals still run (DESIGN.md §7.4). */
const silentClock = () => performance.now() / 1000
