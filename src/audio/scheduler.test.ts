import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SIGNAL, clonePattern, emptyPattern, type Pattern, type TrackId } from '@/data/patterns'
import { Scheduler, stepDuration } from './scheduler'

function setup(opts: { pattern?: Pattern; bpm?: number } = {}) {
  let clock = 0
  let bpm = opts.bpm ?? 120
  let pattern = opts.pattern ?? clonePattern(SIGNAL.pattern)
  const hits: { track: TrackId; time: number }[] = []
  const s = new Scheduler({
    now: () => clock,
    trigger: (track, time) => hits.push({ track, time }),
    getPattern: () => pattern,
    getBpm: () => bpm,
    startDelay: 0,
  })
  return {
    s,
    hits,
    advance(seconds: number) {
      // Move the clock in 25 ms increments, firing the interval timer as we go.
      const n = Math.round(seconds / 0.025)
      for (let i = 0; i < n; i++) {
        clock += 0.025
        vi.advanceTimersByTime(25)
      }
    },
    jump(seconds: number) {
      clock += seconds
    },
    setBpm: (b: number) => (bpm = b),
    setPattern: (p: Pattern) => (pattern = p),
    now: () => clock,
  }
}

describe('Scheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('computes 16th-note step duration', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125)
    expect(stepDuration(60)).toBeCloseTo(0.25)
  })

  it('schedules a full bar in time at the given BPM', () => {
    const t = setup({ bpm: 120 })
    t.s.start()
    t.advance(2) // one bar at 120 BPM = 2 s
    const kicks = t.hits.filter((h) => h.track === 'kick').map((h) => h.time)
    // SIGNAL kick on steps 1, 7, 9, 14 (0-indexed 0, 6, 8, 13)
    expect(kicks.slice(0, 4).map((x) => +x.toFixed(4))).toEqual([0, 0.75, 1, 1.625])
    t.s.stop()
  })

  it('start is idempotent: repeated Play never layers loops', () => {
    const t = setup({ bpm: 120 })
    expect(t.s.start()).toBe(true)
    for (let i = 0; i < 20; i++) expect(t.s.start()).toBe(false)
    t.advance(2)
    const kickTimes = t.hits.filter((h) => h.track === 'kick').map((h) => h.time)
    expect(new Set(kickTimes).size).toBe(kickTimes.length) // no duplicates
    t.s.stop()
  })

  it('rapid start/stop leaves exactly one loop or none', () => {
    const t = setup({ bpm: 120 })
    for (let i = 0; i < 20; i++) {
      t.s.start()
      t.advance(0.05)
      t.s.stop()
    }
    expect(t.s.running).toBe(false)
    const before = t.hits.length
    t.advance(1)
    expect(t.hits.length).toBe(before) // nothing scheduled after Stop

    t.s.start()
    t.hits.length = 0
    t.advance(2)
    const kicks = t.hits.filter((h) => h.track === 'kick')
    expect(kicks.length).toBeGreaterThanOrEqual(4)
    expect(new Set(kicks.map((k) => k.time)).size).toBe(kicks.length)
    t.s.stop()
  })

  it('applies tempo changes from the next step without restarting', () => {
    const hatsOnly = emptyPattern()
    hatsOnly.hat = Array(16).fill(true)
    const t = setup({ bpm: 120, pattern: hatsOnly })
    t.s.start()
    t.advance(0.5)
    t.setBpm(60)
    t.hits.length = 0
    t.advance(2)
    const times = t.hits.map((h) => h.time)
    const gaps = times.slice(1).map((x, i) => +(x - times[i]).toFixed(4))
    // After the change every gap is a 60 BPM step (0.25 s); no doubled or skipped steps.
    expect(gaps.every((g) => g === 0.25)).toBe(true)
    t.s.stop()
  })

  it('reads pattern edits at schedule time (edits land on the next pass)', () => {
    const t = setup({ bpm: 120, pattern: emptyPattern() })
    t.s.start()
    t.advance(0.5)
    const p = emptyPattern()
    p.clap[0] = true
    t.setPattern(p)
    t.advance(2)
    expect(t.hits.filter((h) => h.track === 'clap').length).toBe(1)
    t.s.stop()
  })

  it('queues step events and drains them by time', () => {
    const t = setup({ bpm: 120 })
    t.s.start()
    t.advance(0.3)
    const evs = t.s.drain(t.now())
    expect(evs.map((e) => e.step)).toEqual([0, 1, 2])
    expect(evs[0].tracks).toContain('kick')
    expect(t.s.drain(t.now())).toEqual([])
    t.s.stop()
    expect(t.s.drain(Infinity)).toEqual([]) // Stop clears pending visuals
  })

  it('skips missed steps instead of bursting after a stall', () => {
    const t = setup({ bpm: 120 })
    t.s.start()
    t.advance(0.1)
    const before = t.hits.length
    t.jump(5) // timer starved for 5 s
    vi.advanceTimersByTime(25)
    const late = t.hits.slice(before).filter((h) => h.time < t.now())
    expect(late.length).toBe(0)
    t.s.stop()
  })

  it('V2.3: melody notes are scheduled at exactly the drum step times, and only when on', () => {
    let clock = 0
    const drums: { t: TrackId; time: number }[] = []
    const lead: { midi: number; time: number; dur: number }[] = []
    let on = true
    const notes: (number | null)[] = Array(16).fill(null)
    notes[0] = 57
    notes[4] = 60
    notes[13] = 64
    const s = new Scheduler({
      now: () => clock,
      trigger: (t, time) => drums.push({ t, time }),
      getPattern: () => SIGNAL.pattern,
      getBpm: () => 120,
      getMelody: () => ({ on, notes }),
      triggerNote: (midi, time, dur) => lead.push({ midi, time, dur }),
      startDelay: 0,
    })
    s.start()
    for (let i = 0; i < 80; i++) {
      clock += 0.025
      vi.advanceTimersByTime(25)
    }
    // One bar at 120 BPM = 2 s: notes on steps 1, 5, 14.
    const bar1 = lead.filter((n) => n.time < 2)
    expect(bar1.map((n) => n.midi)).toEqual([57, 60, 64])
    expect(bar1.map((n) => +n.time.toFixed(4))).toEqual([0, 0.5, 1.625])
    // Same timestamps as the drums on those steps (kick on 1 and 14, snare on 5 in SIGNAL).
    for (const n of bar1) expect(drums.some((d) => Math.abs(d.time - n.time) < 1e-9)).toBe(true)
    expect(bar1.every((n) => n.dur === 0.125)).toBe(true)
    // Step events carry the note for the render loop.
    const evs = s.drain(clock)
    expect(evs.filter((e) => e.note !== undefined).map((e) => e.step).slice(0, 3)).toEqual([0, 4, 13])
    // Turning the melody off stops new notes; drums continue.
    on = false
    const before = lead.length
    const drumsBefore = drums.length
    for (let i = 0; i < 80; i++) {
      clock += 0.025
      vi.advanceTimersByTime(25)
    }
    expect(lead.length).toBe(before)
    expect(drums.length).toBeGreaterThan(drumsBefore)
    s.stop()
  })
})
