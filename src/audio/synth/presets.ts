// Synth presets (SOUND_DIRECTION.md §3): 12 original presets as pure data, auditioned in dev/sound-lab.html.
// A preset describes TIMBRE only; the composition (notes, rhythm) lives in the kit data. The same
// preset drives live playback and offline WAV export through presetSynth.ts.

export type Role = 'lead' | 'bass' | 'chords'
export type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine' | 'pulse'

export interface Osc {
  wave: Wave
  /** Pulse duty cycle (only for 'pulse'): 0.125 / 0.25 / 0.5. */
  duty?: number
  /** Octave offset from the played note. */
  octave?: number
  /** Fine detune (cents). */
  detune?: number
  /** Relative level within the preset (mixed before the amp envelope). */
  level: number
}

/** Envelope: attack/decay/release in seconds, sustain 0..1. */
export interface Env {
  a: number
  d: number
  s: number
  r: number
}

export type SynthId =
  | 'pulse8' | 'coin' | 'neon' | 'laser'
  | 'chipbass' | 'funkbass' | 'acid' | 'sub'
  | 'pixelchords' | 'keys' | 'dreampad' | 'arcadearp'

export interface Preset {
  id: SynthId
  name: string
  role: Role
  purpose: string
  character: string
  oscs: Osc[]
  /** Unison: copies of every oscillator spread across ±spread cents. */
  unison?: { voices: number; spread: number }
  /** White-noise layer level (transient "breath"/"pick"). */
  noise?: number
  amp: Env
  /** Fraction of the written note length the gate stays open (staccato < 1). */
  gate: number
  filter?: {
    type: BiquadFilterType
    cutoff: number
    q: number
    /** Envelope amount in Hz added on top of the cutoff. */
    envAmount: number
    env: Env
    /** 0 = fixed cutoff, 1 = cutoff follows pitch. */
    keytrack: number
    /** Slow LFO on cutoff (Hz rate, ± Hz depth). */
    lfo?: { rate: number; depth: number }
  }
  /** Pitch envelope: start `semitones` away and glide to the note over `time` seconds. */
  pitch?: { semitones: number; time: number }
  /** Delayed vibrato (cents). */
  vibrato?: { rate: number; depth: number; delay: number }
  /** Portamento between legato notes (seconds). */
  glide?: number
  /** Soft saturation 0..1 (tanh waveshaper), placed BEFORE the filter so the filter tames its harmonics. */
  drive?: number
  /** Final high-pass (Hz): keeps leads/chords out of the bass's range and removes drive DC/beating. */
  hp?: number
  /** Arpeggiate chords instead of playing them as a block. Rate in notes per step. */
  arp?: { perStep: number; pattern: 'up' | 'updown'; octaves: 1 | 2; gate: number }
  /** Design loudness target (≈LUFS, ungated, K-weighted, phrase through the master chain). */
  loudness: number
}

// Role loudness targets: lead sits forward, bass slightly under, chords behind both.
// Targets = the loudness of the current production voices (warm lead, funk bass, stab chords) on the
// same phrase through the same buses (measured: lead −19.2, bass −14.6, chords −24.8 LUFS).
export const TARGET: Record<Role, number> = { lead: -19, bass: -15, chords: -25 }

export const PRESETS: Preset[] = [
  // ---------------------------------- LEAD ----------------------------------
  {
    id: 'pulse8',
    name: '8-Bit Pulse',
    role: 'lead',
    purpose: 'The honest console lead: melody clarity above everything.',
    character: 'Hollow-bright 25% pulse, near-instant attack, delayed vibrato on held notes. Only a gentle 12 dB/oct roll-off above ~5 kHz: raw and nostalgic, not piercing.',
    oscs: [{ wave: 'pulse', duty: 0.25, level: 1 }],
    amp: { a: 0.003, d: 0.06, s: 0.75, r: 0.04 },
    gate: 0.9,
    filter: { type: 'lowpass', cutoff: 4200, q: 0, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.05 }, keytrack: 0.25 },
    hp: 90,
    vibrato: { rate: 5.8, depth: 16, delay: 0.16 },
    loudness: TARGET.lead,
  },
  {
    id: 'coin',
    name: 'Coin Lead',
    role: 'lead',
    purpose: 'Playful, sparkly hooks: every note "pings" like a pickup.',
    character: '12.5% pulse + 50% square an octave up. Each note leaps up from a fourth below in 22 ms, then a short plucky decay.',
    oscs: [
      { wave: 'pulse', duty: 0.125, level: 0.8 },
      { wave: 'square', octave: 1, level: 0.22 },
    ],
    amp: { a: 0.002, d: 0.16, s: 0.35, r: 0.06 },
    gate: 0.75,
    pitch: { semitones: -5, time: 0.022 },
    filter: { type: 'lowpass', cutoff: 3800, q: 0, envAmount: 1800, env: { a: 0.001, d: 0.06, s: 0, r: 0.05 }, keytrack: 0.25 },
    hp: 90,
    loudness: TARGET.lead,
  },
  {
    id: 'neon',
    name: 'Neon Lead',
    role: 'lead',
    purpose: 'Warm synth-funk/synthwave lead that sings over chords.',
    character: 'Two detuned saws + a quiet square sub, lowpass with a gentle envelope, 40 ms glide on legato, delayed vibrato. Smooth, not buzzy.',
    oscs: [
      { wave: 'sawtooth', detune: -8, level: 0.55 },
      { wave: 'sawtooth', detune: 8, level: 0.55 },
      { wave: 'square', octave: -1, level: 0.22 },
    ],
    amp: { a: 0.008, d: 0.12, s: 0.8, r: 0.12 },
    gate: 0.95,
    filter: { type: 'lowpass', cutoff: 1500, q: 1.2, envAmount: 1600, env: { a: 0.01, d: 0.25, s: 0.35, r: 0.15 }, keytrack: 0.5 },
    vibrato: { rate: 5.2, depth: 11, delay: 0.2 },
    glide: 0.04,
    hp: 90,
    loudness: TARGET.lead,
  },
  {
    id: 'laser',
    name: 'Laser Lead',
    role: 'lead',
    purpose: 'Arcade-action lead for drops and boss themes: every note "zaps" in.',
    character: 'Saw + 25% pulse, a two-octave downward pitch dive in 55 ms, light drive into a resonant lowpass sweep. Aggressive but tamed.',
    oscs: [
      { wave: 'sawtooth', level: 0.6 },
      { wave: 'pulse', duty: 0.25, detune: 5, level: 0.45 },
    ],
    amp: { a: 0.002, d: 0.1, s: 0.65, r: 0.07 },
    gate: 0.85,
    pitch: { semitones: 24, time: 0.055 },
    filter: { type: 'lowpass', cutoff: 1500, q: 5, envAmount: 2800, env: { a: 0.002, d: 0.14, s: 0.15, r: 0.08 }, keytrack: 0.35 },
    drive: 0.25,
    hp: 90,
    vibrato: { rate: 6.5, depth: 9, delay: 0.25 },
    loudness: TARGET.lead,
  },
  // ---------------------------------- BASS ----------------------------------
  {
    id: 'chipbass',
    name: 'Chip Bass',
    role: 'bass',
    purpose: 'Bouncy console bass for chiptune and pop grooves.',
    character: 'Pure triangle body + a quiet 50% square an octave up, so it still speaks on laptop speakers. Tight gate, no filter sweep.',
    oscs: [
      { wave: 'triangle', level: 1 },
      { wave: 'square', octave: 1, level: 0.12 },
    ],
    amp: { a: 0.002, d: 0.05, s: 0.85, r: 0.025 },
    gate: 0.85,
    filter: { type: 'lowpass', cutoff: 3200, q: 0.7, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.05 }, keytrack: 0 },
    loudness: TARGET.bass,
  },
  {
    id: 'funkbass',
    name: 'Funk Bass',
    role: 'bass',
    purpose: 'Slap-flavoured synth-funk bass: the pocket of NEON DRIVE.',
    character: 'Saw + square through a resonant lowpass that "pops" open on every note, a small noise pick, quick decay to a round sustain.',
    oscs: [
      { wave: 'sawtooth', level: 0.6 },
      { wave: 'square', detune: -6, level: 0.5 },
    ],
    noise: 0.05,
    amp: { a: 0.003, d: 0.12, s: 0.6, r: 0.04 },
    gate: 0.9,
    filter: { type: 'lowpass', cutoff: 300, q: 7, envAmount: 1300, env: { a: 0.008, d: 0.13, s: 0.1, r: 0.05 }, keytrack: 0.3 },
    loudness: TARGET.bass,
  },
  {
    id: 'acid',
    name: 'Acid Bass',
    role: 'bass',
    purpose: 'Squelchy, hypnotic bass for tech-house and builds.',
    character: 'Single saw into a high-resonance lowpass with a strong envelope, saturation, and glide between legato notes. Squelch without screech.',
    oscs: [{ wave: 'sawtooth', level: 1 }],
    amp: { a: 0.003, d: 0.15, s: 0.7, r: 0.05 },
    gate: 0.92,
    filter: { type: 'lowpass', cutoff: 220, q: 13, envAmount: 2300, env: { a: 0.004, d: 0.17, s: 0.12, r: 0.06 }, keytrack: 0.35 },
    drive: 0.45,
    glide: 0.06,
    loudness: TARGET.bass,
  },
  {
    id: 'sub',
    name: 'Sub Bass',
    role: 'bass',
    purpose: 'Deep, clean low end under busy leads (headphones/club feel).',
    character: 'Sine fundamental + a soft 2nd harmonic (so it is audible on small speakers), lowpassed, almost no attack transient.',
    oscs: [
      { wave: 'sine', level: 1 },
      { wave: 'sine', octave: 1, level: 0.22 },
      { wave: 'triangle', level: 0.18 },
    ],
    amp: { a: 0.006, d: 0.1, s: 0.9, r: 0.06 },
    gate: 0.9,
    filter: { type: 'lowpass', cutoff: 420, q: 0.7, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.05 }, keytrack: 0.3 },
    loudness: TARGET.bass,
  },
  // --------------------------------- CHORDS ---------------------------------
  {
    id: 'pixelchords',
    name: 'Pixel Chords',
    role: 'chords',
    purpose: 'Crisp, staccato console chords for bouncy grooves.',
    character: '50% square stabs with a fast decay and a gentle lowpass. No detune, so chords stay pure and "pixel-sharp".',
    oscs: [{ wave: 'pulse', duty: 0.5, level: 1 }],
    amp: { a: 0.002, d: 0.14, s: 0.28, r: 0.05 },
    gate: 0.7,
    filter: { type: 'lowpass', cutoff: 3600, q: 0.8, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.05 }, keytrack: 0 },
    hp: 140,
    loudness: TARGET.chords,
  },
  {
    id: 'keys',
    name: 'Retro Keys',
    role: 'chords',
    purpose: 'Electric-piano warmth for funk and lo-fi chords.',
    character: 'Sine body + a bright triangle "tine" an octave up that decays fast, soft lowpass. Bell-like attack, mellow sustain.',
    oscs: [
      { wave: 'sine', level: 1 },
      { wave: 'triangle', octave: 1, level: 0.45 },
      { wave: 'sine', octave: 2, detune: 4, level: 0.12 },
    ],
    amp: { a: 0.004, d: 0.6, s: 0.35, r: 0.25 },
    gate: 0.95,
    filter: { type: 'lowpass', cutoff: 1400, q: 0.7, envAmount: 2600, env: { a: 0.002, d: 0.22, s: 0.05, r: 0.2 }, keytrack: 0.4 },
    hp: 140,
    loudness: TARGET.chords,
  },
  {
    id: 'dreampad',
    name: 'Dream Pad',
    role: 'chords',
    purpose: 'Wide, soft bed for breakdowns, intros and night moods.',
    character: 'Unison saws + triangles (5 voices, ±14 cents), slow 0.3 s attack, long release, and a slowly breathing filter. Lush, never sharp.',
    oscs: [
      { wave: 'sawtooth', level: 0.5 },
      { wave: 'triangle', level: 0.35 },
    ],
    unison: { voices: 5, spread: 14 },
    amp: { a: 0.3, d: 0.4, s: 0.85, r: 0.8 },
    gate: 1,
    filter: { type: 'lowpass', cutoff: 1100, q: 0.9, envAmount: 300, env: { a: 0.4, d: 0.6, s: 0.6, r: 0.6 }, keytrack: 0.2, lfo: { rate: 0.25, depth: 280 } },
    hp: 140,
    loudness: TARGET.chords,
  },
  {
    id: 'arcadearp',
    name: 'Arcade Arp',
    role: 'chords',
    purpose: 'Chords as fast arpeggios: the classic "more notes than channels" console trick.',
    character: '25% pulse cycling chord tones up/down across two octaves at 32nd notes, short gate, a little brightness roll-off.',
    oscs: [{ wave: 'pulse', duty: 0.25, level: 1 }],
    amp: { a: 0.002, d: 0.04, s: 0.7, r: 0.02 },
    gate: 0.9,
    filter: { type: 'lowpass', cutoff: 5200, q: 0.7, envAmount: 0, env: { a: 0.001, d: 0.1, s: 1, r: 0.05 }, keytrack: 0 },
    arp: { perStep: 2, pattern: 'updown', octaves: 2, gate: 0.85 },
    hp: 140,
    loudness: TARGET.chords,
  },
]

export const presetById = (id: string) => PRESETS.find((p) => p.id === id)!
export const isSynthId = (id: string): id is SynthId => PRESETS.some((p) => p.id === id)
export const byRole = (role: Role) => PRESETS.filter((p) => p.role === role)
