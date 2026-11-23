// Plays one step of a composed kit bar (MUSIC_DIRECTION.md §3): bass, chords, riff, leads,
// toms and the "extra" drums (open hat, crash, shaker). Shared by the live app and the offline
// preview renderer, so the app sounds like the approved previews by construction.
// The four grid drums (kick/snare/hat/clap) are NOT played here: in Sandbox they come from the
// editable grid, in Arcade partly from the player.

import type { Bar, Kit, Note } from '@/data/kits'
import { bass, chord, crash, lead, openHat, shaker, tom, type BassPreset, type ChordPreset, type LeadPreset, type Mix } from './instruments'
import { GAINS } from './synth/calibration'
import { isSynthId, presetById, type SynthId } from './synth/presets'
import { playPreset } from './synth/presetSynth'

export interface Voices {
  ctx: BaseAudioContext
  mix: Mix
  noise: AudioBuffer
}

const VEL: Record<string, number> = { x: 1, o: 0.65, '-': 0.35 }

/** Velocity of a drum-string character at a step (0 = rest). */
export function drumVel(pattern: string | undefined, step: number): number {
  return pattern ? VEL[pattern[step]] ?? 0 : 0
}

/** If the note at `index` follows the previous note legato within 3 semitones, glide from it. */
export function glideFrom(notes: Note[], index: number): number | undefined {
  const n = notes[index]
  const prev = notes[index - 1]
  if (!prev) return undefined
  return prev.step + prev.len === n.step && Math.abs(prev.midi - n.midi) <= 3 ? prev.midi : undefined
}

/** A kit role's sound: one of the original instrument voices, or a synth preset id (SOUND_DIRECTION.md). */
export type BassSound = BassPreset | SynthId
export type ChordSound = ChordPreset | SynthId
export type LeadSound = LeadPreset | SynthId

/** Play a synth preset at its loudness-matched gain (same call as the Sound Lab and its WAVs). */
function synth(v: Voices, out: AudioNode, id: SynthId, time: number, midis: number[], dur: number, vel: number, stepSec: number, glide?: number) {
  playPreset(v.ctx, out, presetById(id), time, midis, dur, { stepSec, velocity: vel, gain: GAINS[id], glideFrom: glide })
}

export function playBassNote(v: Voices, sound: BassSound, notes: Note[], i: number, time: number, stepSec: number) {
  const n = notes[i]
  if (isSynthId(sound)) synth(v, v.mix.bass, sound, time, [n.midi], n.len * stepSec, n.vel, stepSec, glideFrom(notes, i))
  else bass(v.ctx, v.mix.bass, time, n.midi, n.len * stepSec, n.vel, sound)
}

export function playChordHit(v: Voices, sound: ChordSound, midis: number[], time: number, dur: number, vel: number, stepSec: number) {
  if (isSynthId(sound)) synth(v, v.mix.chords, sound, time, midis, dur, vel, stepSec)
  else chord(v.ctx, v.mix.chords, time, midis, dur, vel, sound, stepSec)
}

export function playLeadNote(v: Voices, sound: LeadSound, notes: Note[], i: number, time: number, stepSec: number) {
  const n = notes[i]
  if (isSynthId(sound)) synth(v, v.mix.lead, sound, time, [n.midi], n.len * stepSec, n.vel, stepSec, glideFrom(notes, i))
  else lead(v.ctx, v.mix.lead, time, n.midi, n.len * stepSec, n.vel, sound, sound === 'warm' || sound === 'hero' ? glideFrom(notes, i) : undefined)
}

export function playKitStep(v: Voices, kit: Kit, bar: Bar, step: number, time: number, stepSec: number) {
  const { ctx, mix, noise } = v
  // Extra drums (not on the editable grid).
  const oh = drumVel(bar.drums.ohat, step)
  if (oh) openHat(ctx, mix.drums, time, oh, noise)
  const cr = drumVel(bar.drums.crash, step)
  if (cr) crash(ctx, mix.drums, time, cr, noise)
  const sh = drumVel(bar.drums.shaker, step)
  if (sh) shaker(ctx, mix.drums, time, sh, noise)
  for (const n of bar.toms ?? []) if (n.step === step) tom(ctx, mix.drums, time, n.midi, n.vel)

  bar.bass?.forEach((n, i) => n.step === step && playBassNote(v, kit.presets.bass, bar.bass!, i, time, stepSec))
  for (const c of bar.chords ?? []) if (c.step === step) playChordHit(v, kit.presets.chords, c.midis, time, c.len * stepSec, c.vel, stepSec)
  for (const c of bar.riff ?? [])
    if (c.step === step) chord(ctx, mix.chords, time, c.midis, c.len * stepSec, (bar.riffBright ?? 0.5) * c.vel, 'riff', stepSec)

  const leadLine = (notes: Note[] | undefined, sound: LeadSound) => notes?.forEach((n, i) => n.step === step && playLeadNote(v, sound, notes, i, time, stepSec))
  leadLine(bar.lead, kit.presets.lead)
  leadLine(bar.lead2, kit.presets.lead2 ?? kit.presets.lead)
}
