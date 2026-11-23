// What Sandbox playback plays, as pure rules shared by the live scheduler (useSequencer) and
// DOWNLOAD BEAT's offline render, so an exported file plays exactly what the app plays.
//  - Grid drums: the editable pattern, at the kit's composed accent for that step, or 0.85 for
//    steps the player (or Remix) added.
//  - Kit layers (bass, chords, leads, open hat/crash/shaker/toms): the kit's MAIN section,
//    cycling from its first bar on every Play.

import { kitGrid, section, type Bar, type Kit } from '@/data/kits'
import type { TrackId } from '@/data/patterns'

/** Velocity for a grid step the kit didn't compose (added by the player or by Remix). */
export const ADDED_STEP_VEL = 0.85

export function sandboxDrumVel(kit: Kit, track: TrackId, step: number): number {
  return kitGrid(kit).accents[track][step] || ADDED_STEP_VEL
}

/**
 * The bar whose backing layers play under sandbox bar `bar` (0 = the first bar after Play).
 * `main` defaults to the kit's composed MAIN section; pass the current bars if they were changed
 * (e.g. by a music Remix), so live playback and export read the same thing.
 */
export function sandboxLayerBar(kit: Kit, bar: number, main: readonly Bar[] = section(kit, 'main')): Bar | undefined {
  return main.length ? main[bar % main.length] : undefined
}
