// Lookahead scheduler + note queue ("A Tale of Two Clocks", web.dev).
// A JS timer wakes every ~25 ms and schedules every step that falls in the next ~100 ms
// on the audio clock. Each scheduled step is queued so the render loop can show it at
// the moment it is heard. No React in here.

import { STEPS, TRACK_IDS, type Pattern, type TrackId } from '@/data/patterns'

export interface StepEvent {
  step: number
  /** Clock time (seconds) the step sounds at. */
  time: number
  /** Duration of one step at the tempo it was scheduled with. */
  duration: number
  tracks: TrackId[]
}

export interface SchedulerDeps {
  now: () => number
  trigger: (track: TrackId, time: number) => void
  getPattern: () => Pattern
  getBpm: () => number
  /** Seconds to schedule ahead. */
  lookahead?: number
  /** Timer interval in ms. */
  interval?: number
  /** Delay before step 1 when starting, in seconds. */
  startDelay?: number
}

/** Seconds per 16th-note step. */
export const stepDuration = (bpm: number) => 60 / bpm / 4

export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTime = 0
  private nextStep = 0
  private queue: StepEvent[] = []
  private readonly lookahead: number
  private readonly interval: number
  private readonly startDelay: number
  private readonly deps: SchedulerDeps

  constructor(deps: SchedulerDeps) {
    this.deps = deps
    this.lookahead = deps.lookahead ?? 0.1
    this.interval = deps.interval ?? 25
    this.startDelay = deps.startDelay ?? 0.05
  }

  get running(): boolean {
    return this.timer !== null
  }

  /** Idempotent: returns false (and does nothing) if already running. */
  start(): boolean {
    if (this.timer !== null) return false
    this.nextStep = 0
    this.nextTime = this.deps.now() + this.startDelay
    this.queue = []
    this.tick()
    this.timer = setInterval(() => this.tick(), this.interval)
    return true
  }

  /** Idempotent: returns false if already stopped. Clears all pending visual events. */
  stop(): boolean {
    if (this.timer === null) return false
    clearInterval(this.timer)
    this.timer = null
    this.queue = []
    return true
  }

  /** Schedule everything inside the lookahead window. Public for testing. */
  tick() {
    const now = this.deps.now()

    // If the timer was starved (e.g. a throttled tab), skip missed steps rather than
    // firing a burst of late notes. The loop stays phase-aligned to the grid.
    while (this.nextTime < now) this.advance()

    const horizon = now + this.lookahead
    while (this.nextTime < horizon) {
      this.scheduleStep(this.nextStep, this.nextTime)
      this.advance()
    }
  }

  private advance() {
    // Tempo is read per step, so BPM changes apply from the next step without a restart.
    this.nextTime += stepDuration(this.deps.getBpm())
    this.nextStep = (this.nextStep + 1) % STEPS
  }

  private scheduleStep(step: number, time: number) {
    // The pattern is read at schedule time, so edits land on the next pass.
    const pattern = this.deps.getPattern()
    const tracks = TRACK_IDS.filter((id) => pattern[id][step])
    for (const t of tracks) this.deps.trigger(t, time)
    this.queue.push({ step, time, duration: stepDuration(this.deps.getBpm()), tracks })
  }

  /** Remove and return every queued step whose time has arrived. */
  drain(until: number): StepEvent[] {
    let i = 0
    while (i < this.queue.length && this.queue[i].time <= until) i++
    return i === 0 ? [] : this.queue.splice(0, i)
  }
}
