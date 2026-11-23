// DEV-ONLY composed preview kits for MUSIC_DIRECTION.md. Every melody here is original.
// Notation:
//   drums: 16-char strings per instrument per bar: 'x' = 1.0, 'o' = 0.65, '-' = 0.35, '.' = rest
//   lines: "step NOTE len [vel]" comma-separated (steps 0–15, len in 16ths), e.g. "0 E2 2, 3 E3 1 .7"
//   chords: "step N1.N2.N3 len [vel]"

import type { BassPreset, ChordPreset, LeadPreset } from './synths'

export type DrumKey = 'kick' | 'snare' | 'hat' | 'clap' | 'ohat' | 'crash' | 'shaker'
export interface Note {
  step: number
  midi: number
  len: number
  vel: number
}
export interface ChordHit {
  step: number
  midis: number[]
  len: number
  vel: number
}
export interface Bar {
  drums: Partial<Record<DrumKey, string>>
  toms?: Note[]
  bass?: Note[]
  chords?: ChordHit[]
  lead?: Note[]
  lead2?: Note[] // doubling / counter line
  riff?: ChordHit[] // hypnotic riff voice (single notes as 1-note chords)
  /** 0..1 filter brightness for the riff (sweeps in builds). */
  riffBright?: number
}
export interface Section {
  name: 'intro' | 'main' | 'variation' | 'drop' | 'end'
  bars: Bar[]
}
export interface Kit {
  id: string
  name: string
  bpm: number
  key: string
  harmony: string
  presets: { bass: BassPreset; chords: ChordPreset; lead: LeadPreset; lead2?: LeadPreset }
  sections: Section[]
}

// ---------- notation ----------

const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
export function nn(s: string): number {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(s.trim())
  if (!m) throw new Error(`bad note ${s}`)
  return (Number(m[2]) + 1) * 12 + PC[m[1]]
}
export function line(s: string, transpose = 0): Note[] {
  if (!s.trim()) return []
  return s.split(',').map((tok) => {
    const [step, note, len, vel] = tok.trim().split(/\s+/)
    return { step: Number(step), midi: nn(note) + transpose, len: Number(len), vel: vel ? Number(vel) : 1 }
  })
}
export function hits(s: string): ChordHit[] {
  if (!s.trim()) return []
  return s.split(',').map((tok) => {
    const [step, notes, len, vel] = tok.trim().split(/\s+/)
    return { step: Number(step), midis: notes.split('.').map(nn), len: Number(len), vel: vel ? Number(vel) : 1 }
  })
}
const bar = (b: Bar): Bar => b
const rep = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i))

// =====================================================================================
// 1. NEON DRIVE — synth-funk · 112 BPM · E Dorian
//    Main vamp: | Em9 | A13 |   Variation: | Cmaj7 | D6/9 | Em9 | A13 |
// =====================================================================================
const ND = {
  Em9: 'G3.B3.D4.F#4',
  A13: 'G3.C#4.F#4',
  Cmaj7: 'G3.B3.E4',
  D69: 'F#3.A3.B3.E4',
}
const ndBassEm = line('0 E2 2, 3 E3 1 .7, 6 E2 1 .8, 7 G2 1, 8 A2 1, 10 B2 2, 13 D3 1 .7, 14 B2 1 .8, 15 G#2 1 .7')
const ndBassA = line('0 A2 2, 3 A3 1 .7, 6 A2 1 .8, 7 C#3 1, 8 E3 1, 10 G3 1 .8, 11 E3 1 .6, 13 C#3 1 .8, 14 B2 1, 15 D#2 1 .7')
// Same A bar, but the last note approaches C (into the variation) instead of E.
const ndBassAtoC = line('0 A2 2, 3 A3 1 .7, 6 A2 1 .8, 7 C#3 1, 8 E3 1, 10 G3 1 .8, 11 E3 1 .6, 13 C#3 1 .8, 14 B2 1, 15 B1 1 .7')
const ndBassC = line('0 C2 2, 3 C3 1 .7, 6 C2 1 .8, 7 E2 1, 8 G2 2, 11 C3 1 .7, 14 B1 1 .8, 15 C#2 1 .7')
const ndBassD = line('0 D2 2, 3 D3 1 .7, 6 D2 1 .8, 7 F#2 1, 8 A2 2, 11 D3 1 .7, 14 C#3 1 .8, 15 D#2 1 .7')
const ndStab = (c: string, alt = false) => hits(alt ? `2 ${c} 1, 7 ${c} 1 .8, 10 ${c} 1, 12 ${c} 2 .8` : `2 ${c} 1, 7 ${c} 1 .8, 10 ${c} 1, 14 ${c} 1 .8`)
// Hook: "B D E~ D B~ A B~~" / answer "C# E F#~ E C#~ B A~~"
const ndHook1 = line('2 B4 1, 3 D5 1, 4 E5 2, 7 D5 1 .8, 8 B4 2, 10 A4 1 .8, 11 B4 3')
const ndHook2 = line('2 C#5 1, 3 E5 1, 4 F#5 2, 7 E5 1 .8, 8 C#5 2, 10 B4 1 .8, 11 A4 3')
const ndHook4 = line('2 C#5 1, 3 E5 1, 4 F#5 2, 7 E5 1 .8, 8 D5 1, 9 C#5 1, 10 B4 1, 11 D5 1, 12 E5 4')
const ndDrumsA = { kick: 'x......o..x.....', snare: '....x..-....x.-.', hat: 'x-o-x-o-x-o-x-o-', clap: '............o...' }
const ndDrumsB = { kick: 'x..o......x..o..', snare: '....x.......x..-', hat: 'x-o-x-o-x-o-x-o-', clap: '............o...' }
const ndDrop = (k: 0 | 1) => ({
  kick: k ? 'x..o..x...x..o..' : 'x...x..ox...x...',
  snare: '....x..-....x.-.',
  hat: 'x-o-x-o-x-o-x-o-',
  ohat: '..o...o...o...o.',
  clap: '....o.......x...',
})

export const NEON_DRIVE: Kit = {
  id: 'neon-drive',
  name: 'NEON DRIVE',
  bpm: 112,
  key: 'E Dorian',
  harmony: 'i9 – IV13 vamp (Em9 | A13); variation bVI – bVII – i – IV (Cmaj7 | D6/9 | Em9 | A13)',
  presets: { bass: 'funk', chords: 'stab', lead: 'warm', lead2: 'pulse25' },
  sections: [
    {
      name: 'intro',
      bars: [
        bar({ drums: { kick: 'x.......x.......', hat: 'x-o-x-o-x-o-x-o-' }, chords: hits(`0 ${ND.Em9} 16 .6`) }),
        bar({ drums: { kick: 'x.......x.......', hat: 'x-o-x-o-x-o-x-o-', snare: '............x-xx' }, chords: hits(`0 ${ND.A13} 16 .6`), bass: ndBassA }),
      ],
    },
    {
      name: 'main',
      bars: [
        bar({ drums: ndDrumsA, bass: ndBassEm, chords: ndStab(ND.Em9), lead: ndHook1 }),
        bar({ drums: ndDrumsB, bass: ndBassA, chords: ndStab(ND.A13, true), lead: ndHook2 }),
        bar({ drums: ndDrumsA, bass: ndBassEm, chords: ndStab(ND.Em9), lead: ndHook1 }),
        bar({ drums: { ...ndDrumsB, snare: '....x.......xxxx' }, bass: ndBassAtoC, chords: ndStab(ND.A13, true), lead: ndHook4 }),
      ],
    },
    {
      name: 'variation',
      bars: [
        bar({ drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' }, bass: ndBassC, chords: hits(`0 ${ND.Cmaj7} 16 .7`), lead: line('0 G4 2, 3 E4 1 .8, 4 G4 1, 6 A4 2, 10 B4 4') }),
        bar({ drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' }, bass: ndBassD, chords: hits(`0 ${ND.D69} 16 .7`), lead: line('0 A4 2, 3 F#4 1 .8, 4 A4 1, 6 B4 2, 10 D5 4') }),
        bar({ drums: { kick: 'x.......x..o....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' }, bass: ndBassEm, chords: hits(`0 ${ND.Em9} 16 .7`), lead: line('0 E5 1, 2 D5 1, 3 B4 1 .8, 4 D5 2, 7 B4 1 .8, 8 A4 1, 9 G4 1 .8, 10 E4 4') }),
        bar({ drums: { kick: 'x.......x.......', snare: '....x.......xxxx', hat: 'x.o.x.o.x.o.x.o.', crash: '' }, bass: ndBassA, chords: hits(`0 ${ND.A13} 16 .7`), lead: line('0 C#5 2, 3 B4 1 .8, 4 A4 2, 7 G4 1 .8, 8 F#4 2, 10 E4 1 .8, 12 F#4 1, 13 G4 1, 14 G#4 1 .8, 15 A4 1') }),
      ],
    },
    {
      name: 'drop',
      bars: [
        bar({ drums: { ...ndDrop(0), crash: 'x...............' }, bass: ndBassEm, chords: ndStab(ND.Em9), lead: ndHook1, lead2: line('2 B4 1, 3 D5 1, 4 E5 2, 7 D5 1 .8, 8 B4 2, 10 A4 1 .8, 11 B4 3', -12) }),
        bar({ drums: ndDrop(1), bass: ndBassA, chords: ndStab(ND.A13, true), lead: ndHook2, lead2: line('2 C#5 1, 3 E5 1, 4 F#5 2, 7 E5 1 .8, 8 C#5 2, 10 B4 1 .8, 11 A4 3', -12) }),
        bar({ drums: ndDrop(0), bass: ndBassEm, chords: ndStab(ND.Em9), lead: ndHook1, lead2: line('2 B4 1, 3 D5 1, 4 E5 2, 7 D5 1 .8, 8 B4 2, 10 A4 1 .8, 11 B4 3', -12) }),
        bar({ drums: { ...ndDrop(1), snare: '....x.......xxxx' }, bass: ndBassA, chords: ndStab(ND.A13, true), lead: ndHook4, lead2: line('2 C#5 1, 3 E5 1, 4 F#5 2, 7 E5 1 .8, 8 D5 1, 9 C#5 1, 10 B4 1, 11 D5 1, 12 E5 4', -12) }),
      ],
    },
    {
      name: 'end',
      bars: [bar({ drums: { kick: 'x...............', crash: 'x...............' }, bass: line('0 E2 10'), chords: hits(`0 ${ND.Em9} 12 .8`), lead: line('0 E5 10') })],
    },
  ],
}

// =====================================================================================
// 2. PIXEL QUEST — chiptune adventure · 132 BPM · C major
//    Main: | C | Am | F | G |  (call: pulse 25% / response: pulse 12.5%)
//    Variation: | Am | F | Dm7 | G7 |   Drop: main with doubled arps + busier drums
// =====================================================================================
const pqBounce = (root: string) => {
  const r = nn(root)
  return [0, 12, 0, 12, 7, 12, 0, 7].map((iv, i) => ({ step: i * 2, midi: r + iv, len: 1, vel: i % 2 ? 0.75 : 1 }))
}
const PQ = { C: 'C4.E4.G4', Am: 'A3.C4.E4', F: 'F3.A3.C4', G: 'G3.B3.D4', Dm7: 'D4.F4.A4.C5', G7: 'G3.B3.D4.F4' }
const pqCall1 = line('0 E4 1, 2 G4 1, 4 C5 2, 7 B4 1 .8, 8 C5 1, 10 E5 2, 13 D5 1 .8, 14 C5 2')
const pqResp2 = line('2 C5 1, 3 D5 1, 4 E5 2, 7 D5 1 .8, 8 C5 2, 11 A4 1 .8, 12 B4 1, 14 A4 2')
const pqCall3 = line('0 F4 1, 2 A4 1, 4 C5 2, 7 A4 1 .8, 8 C5 1, 10 F5 2, 13 E5 1 .8, 14 D5 2')
const pqResp4 = line('2 B4 1, 3 C5 1, 4 D5 2, 7 G4 1 .8, 8 B4 1, 9 D5 1, 10 G5 2, 13 F5 1 .8, 14 D5 2')
const pqDrums = { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' }
const pqDrumsFill = { kick: 'x.......x.x.....', snare: '....x.......xoxx', hat: 'x.o.x.o.x.o.....' }
const pqDrop = { kick: 'x...x...x.x.x...', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....o.......o...' }

export const PIXEL_QUEST: Kit = {
  id: 'pixel-quest',
  name: 'PIXEL QUEST',
  bpm: 132,
  key: 'C major',
  harmony: 'I – vi – IV – V (C | Am | F | G); variation vi – IV – ii7 – V7',
  presets: { bass: 'chip', chords: 'chipArp', lead: 'pulse25', lead2: 'pulse12' },
  sections: [
    {
      name: 'intro',
      bars: [
        bar({ drums: { hat: 'x.o.x.o.x.o.x.o.' }, chords: hits(`0 ${PQ.C} 16 .8`) }),
        bar({ drums: { hat: 'x.o.x.o.x.o.x.o.', snare: '............xoxx' }, chords: hits(`0 ${PQ.G} 16 .8`), bass: pqBounce('G2') }),
      ],
    },
    {
      name: 'main',
      bars: [
        bar({ drums: pqDrums, bass: pqBounce('C3'), chords: hits(`0 ${PQ.C} 16 .7`), lead: pqCall1 }),
        bar({ drums: pqDrums, bass: pqBounce('A2'), chords: hits(`0 ${PQ.Am} 16 .7`), lead2: pqResp2 }),
        bar({ drums: pqDrums, bass: pqBounce('F2'), chords: hits(`0 ${PQ.F} 16 .7`), lead: pqCall3 }),
        bar({ drums: pqDrumsFill, bass: pqBounce('G2'), chords: hits(`0 ${PQ.G} 16 .7`), lead2: pqResp4 }),
      ],
    },
    {
      name: 'variation',
      bars: [
        bar({ drums: { kick: 'x.......x.......', hat: 'x...x...x...x...', snare: '....x.......x...' }, bass: pqBounce('A2'), chords: hits(`0 ${PQ.Am} 16 .6`), lead: line('0 A4 1, 1 C5 1, 2 E5 1, 4 D5 1, 6 C5 2, 8 B4 1, 10 A4 2, 12 E4 2') }),
        bar({ drums: { kick: 'x.......x.......', hat: 'x...x...x...x...', snare: '....x.......x...' }, bass: pqBounce('F2'), chords: hits(`0 ${PQ.F} 16 .6`), lead: line('0 F4 1, 1 A4 1, 2 C5 1, 4 D5 1, 6 C5 2, 8 A4 1, 10 F4 2, 12 A4 2') }),
        bar({ drums: { kick: 'x.......x.......', hat: 'x...x...x...x...', snare: '....x.......x...' }, bass: pqBounce('D3'), chords: hits(`0 ${PQ.Dm7} 16 .6`), lead2: line('0 D5 1, 2 F5 1, 4 E5 1, 6 D5 1, 8 C5 2, 11 A4 1, 12 C5 2, 14 D5 1') }),
        bar({ drums: { kick: 'x.......x.......', hat: 'x...x...x.......', snare: '....x.......xxxx' }, bass: pqBounce('G2'), chords: hits(`0 ${PQ.G7} 16 .6`), lead2: line('0 B4 1, 2 D5 1, 4 F5 2, 7 E5 1, 8 D5 1, 10 B4 1, 12 G4 1, 13 A4 1, 14 B4 1, 15 D5 1') }),
      ],
    },
    {
      name: 'drop',
      bars: [
        bar({ drums: { ...pqDrop, crash: 'x...............' }, bass: pqBounce('C3'), chords: hits(`0 ${PQ.C} 16 .9`), lead: pqCall1, lead2: line('0 E4 1, 2 G4 1, 4 C5 2, 7 B4 1 .8, 8 C5 1, 10 E5 2, 13 D5 1 .8, 14 C5 2', -12) }),
        bar({ drums: pqDrop, bass: pqBounce('A2'), chords: hits(`0 ${PQ.Am} 16 .9`), lead2: pqResp2, lead: line('2 C5 1, 3 D5 1, 4 E5 2, 7 D5 1 .8, 8 C5 2, 11 A4 1 .8, 12 B4 1, 14 A4 2', -12) }),
        bar({ drums: pqDrop, bass: pqBounce('F2'), chords: hits(`0 ${PQ.F} 16 .9`), lead: pqCall3, lead2: line('0 F4 1, 2 A4 1, 4 C5 2, 7 A4 1 .8, 8 C5 1, 10 F5 2, 13 E5 1 .8, 14 D5 2', -12) }),
        bar({ drums: { ...pqDrop, snare: '....x.......xoxx' }, bass: pqBounce('G2'), chords: hits(`0 ${PQ.G} 16 .9`), lead2: pqResp4, lead: line('2 B4 1, 3 C5 1, 4 D5 2, 7 G4 1 .8, 8 B4 1, 9 D5 1, 10 G5 2, 13 F5 1 .8, 14 D5 2', -12) }),
      ],
    },
    {
      name: 'end',
      bars: [bar({ drums: { kick: 'x...............', crash: 'x...............' }, bass: line('0 C3 8'), chords: hits(`0 ${PQ.C} 8 .9`), lead: line('0 C5 1, 1 E5 1, 2 G5 1, 3 C6 6') })],
    },
  ],
}

// =====================================================================================
// 3. NIGHT SHIFT — tech house · 124 BPM · F minor
//    Main: Fm7 vamp with a hypnotic 1-bar riff. Breakdown/build: riff filter rises, snare roll.
//    Drop: | Fm7 | Fm7 | Dbmaj7 | Eb6 | with the hook.
// =====================================================================================
const NS = { Fm7: 'Ab3.C4.Eb4.F4', Db: 'Ab3.C4.F4', Eb: 'G3.Bb3.C4.Eb4' }
// Offbeat rolling bass, written per chord so every note stays in F minor.
const NS_BASS: Record<string, string> = {
  F2: '2 F2 1, 3 F2 1 .6, 6 F2 1, 7 Ab2 1 .6, 10 F2 1, 11 F2 1 .6, 14 Eb2 1, 15 F2 1 .6',
  Db2: '2 Db2 1, 3 Db2 1 .6, 6 Db2 1, 7 F2 1 .6, 10 Db2 1, 11 Db2 1 .6, 14 C2 1, 15 Db2 1 .6',
  Eb2: '2 Eb2 1, 3 Eb2 1 .6, 6 Eb2 1, 7 G2 1 .6, 10 Eb2 1, 11 Eb2 1 .6, 14 Db2 1, 15 Eb2 1 .6',
}
const nsBass = (root: 'F2' | 'Db2' | 'Eb2' = 'F2') => line(NS_BASS[root])
const nsRiff = hits('0 F4 1, 3 Ab4 1 .7, 6 C5 1, 8 F4 1 .8, 10 Eb5 1, 11 C5 1 .7, 14 Ab4 1 .8')
const nsKick = 'x...x...x...x...'
const nsGroove = { kick: nsKick, ohat: '..x...x...x...x.', hat: '-.-.-.-.-.-.-.-.', clap: '....x.......x...' }
const nsHookA = line('0 C5 2, 3 Ab4 1 .8, 4 Bb4 1, 6 C5 2, 10 Eb5 1, 11 C5 1 .8, 12 Bb4 2, 14 Ab4 2')
const nsHookB = line('0 F4 3, 4 G4 1 .8, 6 Ab4 2, 10 Bb4 1, 11 Ab4 1 .8, 12 G4 2, 14 F4 2')

export const NIGHT_SHIFT: Kit = {
  id: 'night-shift',
  name: 'NIGHT SHIFT',
  bpm: 124,
  key: 'F minor',
  harmony: 'i7 vamp (Fm7); drop i7 – i7 – VImaj7 – VII6 (Fm7 | Fm7 | Dbmaj7 | Eb6)',
  presets: { bass: 'house', chords: 'pad', lead: 'hero' },
  sections: [
    {
      name: 'intro',
      bars: [
        bar({ drums: { kick: nsKick, hat: '-.-.-.-.-.-.-.-.' } }),
        bar({ drums: { kick: nsKick, ohat: '..x...x...x...x.', hat: '-.-.-.-.-.-.-.-.' }, riff: nsRiff, riffBright: 0.15 }),
      ],
    },
    {
      name: 'main',
      bars: rep(4, (i) =>
        bar({ drums: nsGroove, bass: nsBass(), riff: nsRiff, riffBright: 0.3 + i * 0.05, chords: i === 0 ? hits(`0 ${NS.Fm7} 64 .5`) : undefined }),
      ),
    },
    {
      // Breakdown → build: kick out, pad + riff opening up, snare roll accelerates.
      name: 'variation',
      bars: [
        bar({ drums: { hat: '-.-.-.-.-.-.-.-.' }, chords: hits(`0 ${NS.Fm7} 32 .9`), riff: nsRiff, riffBright: 0.45 }),
        bar({ drums: { hat: '-.-.-.-.-.-.-.-.', snare: 'o.......o.......' }, riff: nsRiff, riffBright: 0.6 }),
        bar({ drums: { snare: 'o...o...o...o...' }, chords: hits(`0 ${NS.Db} 16 .8`), riff: nsRiff, riffBright: 0.75, lead: line('0 C5 8, 8 Eb5 8') }),
        bar({ drums: { snare: 'o.o.o.o.xoxoxxxx' }, chords: hits(`0 ${NS.Eb} 16 .8`), riff: nsRiff, riffBright: 0.95, lead: line('0 F5 12', ) }),
      ],
    },
    {
      name: 'drop',
      bars: [
        bar({ drums: { ...nsGroove, crash: 'x...............' }, bass: nsBass(), riff: nsRiff, riffBright: 0.55, chords: hits(`0 ${NS.Fm7} 16 .6`), lead: nsHookA }),
        bar({ drums: nsGroove, bass: nsBass(), riff: nsRiff, riffBright: 0.55, chords: hits(`0 ${NS.Fm7} 16 .6`), lead: nsHookB }),
        bar({ drums: nsGroove, bass: nsBass('Db2'), riff: hits('0 F4 1, 3 Ab4 1 .7, 6 C5 1, 8 F4 1 .8, 10 Db5 1, 11 C5 1 .7, 14 Ab4 1 .8'), riffBright: 0.6, chords: hits(`0 ${NS.Db} 16 .6`), lead: nsHookA }),
        bar({ drums: { ...nsGroove, snare: '............xxxx' }, bass: nsBass('Eb2'), riff: hits('0 G4 1, 3 Bb4 1 .7, 6 Eb5 1, 8 G4 1 .8, 10 C5 1, 11 Bb4 1 .7, 14 G4 1 .8'), riffBright: 0.65, chords: hits(`0 ${NS.Eb} 16 .6`), lead: line('0 Eb5 3, 4 F5 1 .8, 6 G5 2, 10 F5 1, 11 Eb5 1 .8, 12 C5 4') }),
      ],
    },
    {
      name: 'end',
      bars: [bar({ drums: { kick: 'x...............', crash: 'x...............' }, bass: line('0 F2 8'), chords: hits(`0 ${NS.Fm7} 12 .8`), lead: line('0 F5 10') })],
    },
  ],
}

// =====================================================================================
// 4. BOSS RUSH — battle theme · 150 BPM · D harmonic minor
//    Main: | Dm | Bb | Gm | A7 | (i – VI – iv – V7, leading tone C# resolves to D)
//    Variation: dominant build | Gm | Gm | A7 | A7 | with tom fills. Drop: double-time drums.
// =====================================================================================
const BR = { Dm: 'F3.A3.D4', Bb: 'F3.Bb3.D4', Gm: 'G3.Bb3.D4', A7: 'G3.C#4.E4' }
const gallop = (root: string, octaveOnThree = true) => {
  const r = nn(root)
  return [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].map((s) => ({
    step: s,
    midi: r + (octaveOnThree && s === 8 ? 12 : 0),
    len: s % 4 === 0 ? 2 : 1,
    vel: s % 4 === 0 ? 1 : 0.7,
  }))
}
const brStabs = (c: string) => hits(`0 ${c} 3, 6 ${c} 2 .8, 8 ${c} 3, 14 ${c} 2 .8`)
const brHook = [
  line('0 D5 2, 2 A4 1 .8, 3 D5 1, 4 F5 2, 6 E5 1 .8, 7 D5 1, 8 C#5 2, 10 D5 1, 11 E5 1 .8, 12 A4 4'),
  line('0 Bb4 2, 2 F4 1 .8, 3 Bb4 1, 4 D5 2, 6 C5 1 .8, 7 Bb4 1, 8 A4 2, 10 Bb4 1, 11 C5 1 .8, 12 D5 4'),
  line('0 Bb4 2, 2 G4 1 .8, 3 Bb4 1, 4 D5 2, 6 C5 1 .8, 7 Bb4 1, 8 A4 1, 9 Bb4 1, 10 G4 2, 12 D5 2, 14 E5 2'),
  line('0 C#5 2, 2 E5 1 .8, 3 G5 1, 4 F5 1, 5 E5 1 .8, 6 D5 1, 7 C#5 1, 8 E5 2, 10 A4 2, 12 C#5 1, 13 D5 1 .8, 14 E5 1, 15 C#5 1 .8'),
]
const brDrums = { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }
const brDrop = { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....o.......o...' }
const tomFill = line('12 D3 1, 13 B2 1 .9, 14 A2 1 .9, 15 F2 1')

export const BOSS_RUSH: Kit = {
  id: 'boss-rush',
  name: 'BOSS RUSH',
  bpm: 150,
  key: 'D harmonic minor',
  harmony: 'i – VI – iv – V7 (Dm | Bb | Gm | A7); dominant build iv – iv – V7 – V7; resolves to i',
  presets: { bass: 'drive', chords: 'stab', lead: 'hero', lead2: 'pulse25' },
  sections: [
    {
      name: 'intro',
      bars: [
        bar({ drums: { kick: 'x...x...x...x...' }, bass: gallop('D2', false), chords: hits(`0 ${BR.Dm} 16 .7`) }),
        bar({ drums: { kick: 'x...x...x...x...', snare: '........o.o.xxxx' }, bass: gallop('D2', false), chords: hits(`0 ${BR.A7} 16 .7`), toms: tomFill }),
      ],
    },
    {
      name: 'main',
      bars: [
        bar({ drums: { ...brDrums, crash: 'x...............' }, bass: gallop('D2'), chords: brStabs(BR.Dm), lead: brHook[0] }),
        bar({ drums: brDrums, bass: gallop('Bb1'), chords: brStabs(BR.Bb), lead: brHook[1] }),
        bar({ drums: brDrums, bass: gallop('G1'), chords: brStabs(BR.Gm), lead: brHook[2] }),
        bar({ drums: { ...brDrums, snare: '....x.......x...' }, bass: gallop('A1'), chords: brStabs(BR.A7), lead: brHook[3], toms: tomFill }),
      ],
    },
    {
      name: 'variation',
      bars: [
        bar({ drums: { kick: 'x.......x.......', snare: '........x.......', hat: 'x...x...x...x...' }, bass: line('0 G1 8, 8 G1 8'), chords: hits(`0 ${BR.Gm} 16 .9`), lead2: line('0 D5 8, 8 Bb4 8') }),
        bar({ drums: { kick: 'x.......x.......', snare: '........x.......', hat: 'x...x...x...x...' }, bass: line('0 G1 8, 8 G1 8'), chords: hits(`0 ${BR.Gm} 16 .9`), lead2: line('0 C5 4, 4 D5 4, 8 Eb5 8') }),
        bar({ drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, bass: gallop('A1', false), chords: hits(`0 ${BR.A7} 16 .9`), lead2: line('0 E5 8, 8 C#5 8') }),
        bar({ drums: { kick: 'x...x...x...x...', snare: 'o.o.o.o.xxxxxxxx', hat: 'x.x.x.x.........' }, bass: gallop('A1', false), chords: hits(`0 ${BR.A7} 16 .9`), lead: line('0 E5 2, 2 F5 2, 4 G5 2, 6 F5 2, 8 E5 4, 12 C#5 4'), toms: line('8 D3 1, 10 B2 1, 12 A2 1, 14 F2 1') }),
      ],
    },
    {
      name: 'drop',
      bars: [
        bar({ drums: { ...brDrop, crash: 'x...............' }, bass: gallop('D2'), chords: brStabs(BR.Dm), lead: brHook[0], lead2: brHook[0].map((n) => ({ ...n, midi: n.midi - 12, vel: n.vel * 0.7 })) }),
        bar({ drums: brDrop, bass: gallop('Bb1'), chords: brStabs(BR.Bb), lead: brHook[1], lead2: brHook[1].map((n) => ({ ...n, midi: n.midi - 12, vel: n.vel * 0.7 })) }),
        bar({ drums: brDrop, bass: gallop('G1'), chords: brStabs(BR.Gm), lead: brHook[2], lead2: brHook[2].map((n) => ({ ...n, midi: n.midi - 12, vel: n.vel * 0.7 })) }),
        bar({ drums: { ...brDrop, snare: '....x.......xxxx' }, bass: gallop('A1'), chords: brStabs(BR.A7), lead: brHook[3], lead2: brHook[3].map((n) => ({ ...n, midi: n.midi - 12, vel: n.vel * 0.7 })), toms: tomFill }),
      ],
    },
    {
      name: 'end',
      bars: [bar({ drums: { kick: 'x...............', crash: 'x...............' }, bass: line('0 D2 10'), chords: hits(`0 ${BR.Dm} 12 1`), lead: line('0 D5 10'), lead2: line('0 A4 10 .7') })],
    },
  ],
}

export const KITS: Kit[] = [NEON_DRIVE, PIXEL_QUEST, NIGHT_SHIFT, BOSS_RUSH]
