// AudioContext lifecycle, master bus, and unlock / blocked state.
// The context is only created inside a user gesture (unlock), to respect autoplay rules.

import type { TrackId } from '@/data/patterns'
import { VOICES, createNoiseBuffer } from './voices'

export type AudioStatus = 'locked' | 'running' | 'blocked'

const UNLOCK_TIMEOUT_MS = 300

export class AudioEngine {
  private ctx: AudioContext | null = null
  private compressor: DynamicsCompressorNode | null = null
  /** Per-transport bus. Swapped out on cut() so already-scheduled notes go silent. */
  private bus: GainNode | null = null
  private noise: AudioBuffer | null = null
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
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -16
    compressor.knee.value = 8
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.15
    const master = ctx.createGain()
    master.gain.value = 0.85
    compressor.connect(master).connect(ctx.destination)

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
    return bus
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

  trigger(track: TrackId, time: number) {
    if (!this.ctx || !this.bus || !this.noise || this.ctx.state !== 'running') return
    VOICES[track](this.ctx, this.bus, Math.max(time, this.ctx.currentTime), this.noise)
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
    this.compressor = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {})
  }
}
