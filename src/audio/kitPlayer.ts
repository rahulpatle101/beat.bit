// Plays one step of a composed kit bar (MUSIC_DIRECTION.md §3): bass, chords, riff, leads,
// toms and the "extra" drums (open hat, crash, shaker). Shared by the live app and the offline
// preview renderer, so the app sounds like the approved previews by construction.
// The four grid drums (kick/snare/hat/clap) are NOT played here: in Sandbox they come from the
// editable grid, in Arcade partly from the player.

import type { Bar, Kit, Note } from '@/data/kits'
import { bass, chord, crash, lead, openHat, shaker, tom, type Mix } from './instruments'

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

  for (const n of bar.bass ?? []) if (n.step === step) bass(ctx, mix.bass, time, n.midi, n.len * stepSec, n.vel, kit.presets.bass)
  for (const c of bar.chords ?? []) if (c.step === step) chord(ctx, mix.chords, time, c.midis, c.len * stepSec, c.vel, kit.presets.chords, stepSec)
  for (const c of bar.riff ?? [])
    if (c.step === step) chord(ctx, mix.chords, time, c.midis, c.len * stepSec, (bar.riffBright ?? 0.5) * c.vel, 'riff', stepSec)

  const leadLine = (notes: Note[] | undefined, preset: Kit['presets']['lead']) => {
    if (!notes) return
    notes.forEach((n, i) => {
      if (n.step !== step) return
      const glide = preset === 'warm' || preset === 'hero' ? glideFrom(notes, i) : undefined
      lead(ctx, mix.lead, time, n.midi, n.len * stepSec, n.vel, preset, glide)
    })
  }
  leadLine(bar.lead, kit.presets.lead)
  leadLine(bar.lead2, kit.presets.lead2 ?? kit.presets.lead)
}
