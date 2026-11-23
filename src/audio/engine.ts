// AudioContext lifecycle, master bus, and unlock / blocked state.
// The context is only created inside a user gesture (unlock), to respect autoplay rules.

import type { TrackId } from '@/data/patterns'
import { createMasterChain } from './chain'
import { createMix, drum, setDelayTempo, type Mix } from './instruments'
import { playLead } from './lead'
import { createNoiseBuffer } from './voices'

export type AudioStatus = 'locked' | 'running' | 'blocked'

const UNLOCK_TIMEOUT_MS = 300

export class AudioEngine {
  private ctx: AudioContext | null = null
  /** Master chain input (shared builder with future offline export). */
  private compressor: AudioNode | null = null
  /** Per-transport bus. Swapped out on cut() so already-scheduled notes go silent. */
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null
  /** Role buses + FX for the current transport bus (rebuilt with the bus, so cut() silences FX tails too). */
  private mix: Mix | null = null
  private stepSec = 60 / 104 / 4
  private disposed = false
  private listeners = new Set<(s: AudioStatus) => void>()
  status: AudioStatus = 'locked'

  subscribe(fn: (s: AudioStatus) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setStatus(s: AudioStatus) {
    if (this.status === s) return
    this.status = s
    for (const fn of this.listeners) fn(s)
  }

  private build(): AudioContext {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const compressor = createMasterChain(ctx).input

    ctx.addEventListener('statechange', () => {
      if (this.disposed || this.ctx !== ctx) return
      // Safari reports 'interrupted' (e.g. a phone call); others go back to 'suspended'.
      if (ctx.state === 'running') this.setStatus('running')
      else if (this.status === 'running') this.setStatus('blocked')
    })

    this.ctx = ctx
    this.compressor = compressor
    this.noise = createNoiseBuffer(ctx)
    this.bus = this.newBus()
    return ctx
  }

  private newBus(): GainNode {
    const bus = this.ctx!.createGain()
    bus.connect(this.compressor!)
    this.mix = createMix(this.ctx!, bus, this.stepSec)
    return bus
  }

  /** Keep tempo-synced FX (the dotted-8th delay) in time. */
  setTempo(stepSec: number) {
    this.stepSec = stepSec
    if (this.ctx && this.mix) setDelayTempo(this.mix, stepSec, this.ctx.currentTime)
  }

  /**
   * Live voices for kit layers (bass, chords, leads, extra drums). Null when audio isn't running,
   * so callers simply skip scheduling (same rule as drum triggers).
   */
  voices(): { ctx: AudioContext; mix: Mix; noise: AudioBuffer } | null {
    if (!this.ctx || !this.mix || !this.noise || this.ctx.state !== 'running') return null
    return { ctx: this.ctx, mix: this.mix, noise: this.noise }
  }

  /** Must be called from a user gesture. Resolves true when audio is actually running. */
  async unlock(): Promise<boolean> {
    if (this.disposed) return false
    const ctx = this.ctx ?? this.build()
    if (ctx.state !== 'running') {
      try {
        await Promise.race([
          ctx.resume(),
          new Promise((resolve) => setTimeout(resolve, UNLOCK_TIMEOUT_MS)),
        ])
      } catch {
        // Fall through: reported as blocked below.
      }
    }
    // `state` changes asynchronously, so read it fresh rather than trusting the narrowed type.
    const ok = (ctx.state as AudioContextState) === 'running'
    this.setStatus(ok ? 'running' : 'blocked')
    return ok
  }

  get running(): boolean {
    return this.ctx?.state === 'running'
  }

  /** Audio clock in seconds (0 before the context exists). */
  now(): number {
    return this.ctx?.currentTime ?? 0
  }

  /** Output latency, for aligning visuals with what the listener hears. */
  outputLatency(): number {
    const ctx = this.ctx
    if (!ctx) return 0
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  }

  /**
   * Audio-clock time of what the listener was hearing at `eventTimeStamp` (performance.now()
   * timebase, e.g. KeyboardEvent.timeStamp). Uses getOutputTimestamp() (context time of the
   * sample at the output) when available; otherwise estimates from currentTime − output latency.
   * Arcade judging compares this with each cue's scheduled time (GAME_DESIGN §3.1).
   */
  heardTimeAt(eventTimeStamp: number): number {
    const ctx = this.ctx
    if (!ctx) return 0
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
      return ts.contextTime + (eventTimeStamp - ts.performanceTime) / 1000
    }
    return ctx.currentTime - (performance.now() - eventTimeStamp) / 1000 - this.outputLatency()
  }

  /** Drum hit with velocity (1 = the V1 level), on the drums bus. */
  trigger(track: TrackId, time: number, vel = 1) {
    if (!this.ctx || !this.mix || !this.noise || this.ctx.state !== 'running') return
    drum(this.ctx, this.mix.drums, track, Math.max(time, this.ctx.currentTime), vel, this.noise)
  }

  /** BIT LEAD note (melody). Same bus as the drums, so Stop's cut() silences it too. */
  triggerLead(midi: number, time: number, stepSec: number) {
    if (!this.ctx || !this.bus || this.ctx.state !== 'running') return
    playLead(this.ctx, this.mix?.lead ?? this.bus, Math.max(time, this.ctx.currentTime), midi, stepSec)
  }

  /** Silence everything scheduled or sounding, immediately (Stop). */
  cut() {
    const ctx = this.ctx
    const old = this.bus
    if (!ctx || !old) return
    const now = ctx.currentTime
    old.gain.cancelScheduledValues(now)
    old.gain.setValueAtTime(old.gain.value, now)
    old.gain.linearRampToValueAtTime(0, now + 0.012) // de-click
    setTimeout(() => old.disconnect(), 60)
    this.bus = this.newBus()
  }

  dispose() {
    this.disposed = true
    this.listeners.clear()
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    this.mix = null
    this.compressor = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {})
  }
}
