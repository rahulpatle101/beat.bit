import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/scene/geometry'
import {
  ASSIST,
  NORMAL,
  accuracy,
  judge,
  liveAccuracy,
  loadProgress,
  maxScore,
  newRun,
  press,
  rankFor,
  stars,
  sweep,
  wakeTheCity,
  xpAward,
  type Cue,
} from './arcade'

const ms = (n: number) => n / 1000
/** Wake the City cues with times at 112 BPM, starting at t = 1 s. */
function timedCues(): Cue[] {
  const c = wakeTheCity()
  const step = 60 / 112 / 4
  return c.cues.map((q) => ({ ...q, time: 1 + (q.bar * 16 + q.step) * step }))
}

describe('judging windows (GAME_DESIGN §3.1)', () => {
  it('Normal: 0/±30 → PERFECT, ±60 → GREAT, ±100 → GOOD, ±150 → MISS', () => {
    expect(judge(0, NORMAL)).toBe('perfect')
    expect(judge(ms(30), NORMAL)).toBe('perfect')
    expect(judge(ms(-30), NORMAL)).toBe('perfect')
    expect(judge(ms(60), NORMAL)).toBe('great')
    expect(judge(ms(-100), NORMAL)).toBe('good')
    expect(judge(ms(150), NORMAL)).toBeNull()
  })
  it('Assist doubles every window', () => {
    expect(judge(ms(60), ASSIST)).toBe('perfect')
    expect(judge(ms(200), ASSIST)).toBe('good')
    expect(ASSIST.good).toBeCloseTo(NORMAL.good * 2)
  })
})

describe('Wake the City chart', () => {
  it('player plays accented kick/snare on 8ths; kick only in the intro; ~60 cues', () => {
    const c = wakeTheCity()
    expect(c.bars).toHaveLength(15)
    expect(c.cues.length).toBeGreaterThan(50)
    expect(c.cues.length).toBeLessThan(70)
    expect(c.cues.every((q) => q.step % 2 === 0)).toBe(true)
    expect(c.cues.filter((q) => q.bar < 2).every((q) => q.pad === 'kick')).toBe(true)
    expect(c.cues.slice(0, 4).map((q) => `${q.bar}:${q.step}`)).toEqual(['0:0', '0:8', '1:0', '1:8'])
  })
})

describe('scoring and anti-spam (GAME_DESIGN §3.2–3.3)', () => {
  it('a perfect run scores ★★★ at the max score bound', () => {
    const cues = timedCues()
    const s = newRun(cues)
    for (const q of cues) press(s, q.pad, q.time, NORMAL)
    expect(s.counts.perfect).toBe(cues.length)
    expect(accuracy(s)).toBe(1)
    expect(stars(accuracy(s))).toBe(3)
    expect(s.score).toBe(maxScore(cues.length))
    expect(s.maxCombo).toBe(cues.length)
  })

  it('±50 ms timing → all GREAT: accuracy 0.7 = ★ (clears; ★★ needs 0.75)', () => {
    const cues = timedCues()
    const s = newRun(cues)
    cues.forEach((q, i) => press(s, q.pad, q.time + (i % 2 ? ms(50) : ms(-50)), NORMAL))
    expect(s.counts.great).toBe(cues.length)
    expect(accuracy(s)).toBeCloseTo(0.7)
    expect(stars(accuracy(s))).toBe(1)
  })

  it('mashing both pads (8 presses per beat) cannot earn a star', () => {
    const cues = timedCues()
    const s = newRun(cues)
    const rnd = mulberry32(5)
    const end = cues[cues.length - 1].time + 0.5
    for (let t = 0.8; t < end; t += 60 / 112 / 8) {
      press(s, 'kick', t + rnd() * 0.01, NORMAL)
      press(s, 'snare', t + 0.004 + rnd() * 0.01, NORMAL)
    }
    sweep(s, end + 1, NORMAL)
    expect(s.counts.stray).toBeGreaterThan(cues.length)
    expect(accuracy(s)).toBeLessThan(0.25)
    expect(stars(accuracy(s))).toBe(0)
  })

  it('debounce: presses < 40 ms apart on one pad count once; one press per cue', () => {
    const cues = timedCues()
    const s = newRun(cues)
    const q = cues[0]
    expect(press(s, q.pad, q.time, NORMAL).kind).toBe('hit')
    expect(press(s, q.pad, q.time + ms(20), NORMAL).kind).toBe('ignored')
    expect(press(s, q.pad, q.time + ms(60), NORMAL).kind).toBe('stray') // cue already consumed
    expect(s.combo).toBe(0)
  })

  it('missed cues are swept after the GOOD window and break the combo', () => {
    const cues = timedCues()
    const s = newRun(cues)
    press(s, cues[0].pad, cues[0].time, NORMAL)
    expect(sweep(s, cues[1].time + ms(100), NORMAL)).toHaveLength(0)
    expect(sweep(s, cues[1].time + ms(120), NORMAL).map((c) => c.id)).toEqual([cues[1].id])
    expect(s.combo).toBe(0)
    expect(s.dirtyBars.has(cues[1].bar)).toBe(true)
  })

  it('live accuracy counts only judged cues; final accuracy counts every cue', () => {
    const cues = timedCues()
    const s = newRun(cues)
    for (const q of cues.slice(0, 12)) press(s, q.pad, q.time, NORMAL)
    expect(liveAccuracy(s)).toBe(1)
    expect(accuracy(s)).toBeCloseTo(12 / cues.length)
  })

  it('strays cost 10 points (floor 0)', () => {
    const s = newRun(timedCues())
    press(s, 'snare', 0.1, NORMAL)
    expect(s.score).toBe(0)
    expect(s.counts.stray).toBe(1)
  })
})

describe('progression (GAME_DESIGN §5)', () => {
  it('ranks and XP', () => {
    expect(rankFor(0).name).toBe('ROOKIE')
    expect(rankFor(300).name).toBe('BEATMAKER')
    expect(rankFor(150).progress).toBeCloseTo(0.5)
    expect(xpAward(3, 0)).toBe(200)
    expect(xpAward(2, 3)).toBe(30) // replay below best tier → 20%
    expect(xpAward(0, 0)).toBe(0)
  })
  it('loads a fresh profile from empty or corrupt storage', () => {
    expect(loadProgress({ getItem: () => null })).toEqual({ v: 1, xp: 0, best: {}, assist: false })
    expect(loadProgress({ getItem: () => '{bad json' }).xp).toBe(0)
  })
})
