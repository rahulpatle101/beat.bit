# BEAT.BIT — Sound Direction & Synth Preset Lab

**Status:** ✅ Listening verdict given (2026-11-24): **NEON DRIVE now ships the NIGHT DRIVE set: Neon Lead · Funk Bass · Dream Pad.** The other kits keep their original voices. No libraries were installed.
**Goal:** the same composed tune should sound clearly different through well-designed, loudness-matched synth presets.
**Lab:** `npm run dev`, then open `/dev/sound-lab.html` on the port Vite prints (the lab page is dev-only). In the lab, "ORIGINAL" plays NEON DRIVE's pre-change voices for A/B.

---

## 1. Reference evaluation

The three references, compared with our current native Web Audio engine:

| | **Current BEAT.BIT engine** (native Web Audio) | **retro-sound** (learosema) | **Tone.js** |
|---|---|---|---|
| What it is | Our own voices + lookahead scheduler + master chain | A tiny helper: `Sound(ctx, carrier).withFilter().withModulator().play(note, vol, t)`, plus `WhiteNoise` | A full framework: Transport, ~20 synths, ~30 effects, `Tone.Offline` |
| Sound-design range | Pulse with any duty (PeriodicWave), saw/square/tri/sine, noise, biquad filters with envelopes, vibrato, glide, delay + reverb sends, compressor + limiter. The lab adds unison, pitch envelopes, drive, arpeggios and keytracking. | One carrier + one modulator + one filter. No ADSR (gain ramps only), no pulse width, no unison, no effects | Very wide: Mono/FM/AM/Membrane/Metal/Noise synths, Fat/PWM/Pulse oscillators, BitCrusher, Chorus, PingPongDelay, Reverb, AutoFilter |
| Scheduling | Already sample-accurate: a 25 ms timer, 100 ms lookahead, one clock for audio and visuals | Uses `setTimeout` for `wait()`/dispose; no sequencer | Own Transport with lookahead. Adopting it means replacing or bridging our Scheduler (two clocks during migration) |
| Offline WAV | Works today: voices take a `BaseAudioContext`, so the same code renders in an `OfflineAudioContext` | Typed to `AudioContext` only; offline would need a fork | `Tone.Offline(cb, dur)`, but every node must be built inside Tone's offline context (a global context swap) |
| Integration effort | None (it is the engine) | Small, but it adds little we don't already have, and it has bugs: the filter ramp uses relative time, and the oscillator starts at construction | High: rewrite voices, the transport bridge, cut()/Stop semantics, tests and the arcade timing path |
| Performance | Lean: a few nodes per note, nodes freed on `onended` | Lean | Heavier per voice (wrapper nodes, signal graph), but fine on desktop |
| License | Ours | MIT | MIT |
| Bundle impact | 0 | ~2–3 KB (12 KB unpacked, 0 deps) | **+79.7 KB gzip** (UMD build 345.5 KB), which is **+65 %** on today's 122 KB gzip app. Tree-shaking ESM helps only partly (deps: tslib, standardized-audio-context) |
| Maturity | Verified by 60 tests + Chrome checks | 1.0.4, 6 stars, little activity | Mature, widely used, documented (the docs site is JS-rendered) |

**The Gist** ("8-Bit Music Synthesis with Web Audio API – Claude Skill") is a tutorial, not a library, and states no license.
- **Useful ideas:** NES-style channel roles (2 pulses, a triangle, noise) and duty-cycle variety.
- **Not adopted:**
  - `setTimeout` sequencing with no lookahead
  - instant gain steps with no attack, which click
  - no PeriodicWave pulse width
  - no filter or limiter
  - a new noise buffer per hit

Our engine already does all of these better. We took the channel-role idea only as inspiration.

### Recommendation: stay native, adopt a data-driven preset voice

The lab shows that our existing primitives can produce 12 distinct, clean, loudness-matched presets. It adds one ~200-line data-driven voice (`presetSynth.ts`) and **0 KB of dependencies**.

Tone.js would add ~80 KB gzip and a second transport, and the migration would put our verified timing, Stop and export behaviour at risk. We'd get synth types we can already build.

Ideas borrowed rather than libraries installed:
- **From Tone.js:**
  - the MonoSynth topology (osc → filter envelope → amp envelope)
  - FatOscillator unison (detune spread, level-normalised by √N)
  - keytracked filter cutoff
- **From retro-sound:** carrier + modulator FM, as a later option for bells.

Revisit Tone.js only if we later need things like sample playback with time-stretch, MIDI, or a large effects rack.

---

## 2. Architecture: composition and timbre are independent

```text
Kit (composition data)        Preset (timbre data)            Voice (one function)
notes, chords, velocities  +  oscs, ADSR, filter, mods,   →   playPreset(ctx: BaseAudioContext, out, preset,
lengths, sections             unison, arp, loudness target     time, midis, dur, {stepSec, velocity, gain, glideFrom})
```

- **Presets hold no notes; kits hold no timbre.** A kit can name default preset ids. Swapping a preset never touches the score.
- **One code path for live playback and export.** `playStep()` (`src/dev/soundlab/render.ts`) is called both by:
  - the live lab: the production `AudioEngine` + `Scheduler`, used unmodified;
  - the offline WAV renderer: an `OfflineAudioContext` with the same `createMasterChain` + `createMix`.

  The WAVs are therefore exactly what live playback plays.
- **Loudness calibration** is a per-preset gain (`calibration.ts`), measured once offline and baked in. It isn't computed at runtime.
- **Preset changes are read at schedule time,** so a swap lands on the next step. There is no restart and no node rebuilding, and notes already scheduled finish with the timbre they started with.
- **Click-free by construction:**
  - every voice gain starts at 0;
  - attack is at least 2 ms and release at least 8 ms;
  - oscillators stop 10 ms after the envelope reaches 0;
  - nodes are disconnected on `onended`;
  - Stop uses the engine's existing bus swap (`cut()`), which ramps to 0 in 12 ms.

Files (all dev-only):

| File | Role |
|---|---|
| `src/dev/soundlab/presets.ts` | Preset schema + the 12 presets + role loudness targets |
| `src/dev/soundlab/presetSynth.ts` | The data-driven voice (`playPreset`) |
| `src/dev/soundlab/calibration.ts` | Baked loudness-match gains |
| `src/dev/soundlab/render.ts` | `playStep` (shared live/offline), offline render, BS.1770-style loudness, QA checks, combos, WAV export |
| `src/dev/soundlab/page.ts` + `lab.css` + `dev/sound-lab.html` | The isolated lab page |

---

## 3. The 12 presets

Notes on the numbers:
- **Loudness:** each preset is calibrated to the loudness of the **current production voice for its role** on the same phrase, through the same buses. Targets: lead −19 LUFS, bass −15 LUFS, chords −25 LUFS. This keeps the approved NEON DRIVE balance whichever preset is chosen.
- **Filter Q:** values are in Web Audio units, which means **dB** for lowpass/highpass.
- **"Gate":** the fraction of the written note length the gate stays open.

### LEAD

| Preset | Synthesis | ADSR (A / D / S / R) | Filter & modulation | Musical purpose | Character |
|---|---|---|---|---|---|
| **8-Bit Pulse** | 25 % pulse (PeriodicWave, 48 harmonics) | 3 ms / 60 ms / 0.75 / 40 ms, gate 0.9 | LP 4.2 kHz (12 dB/oct, keytrack 0.25); HP 90 Hz; delayed vibrato 5.8 Hz ±16¢ after 160 ms | Honest console melody: clarity above everything | Hollow-bright, nostalgic, raw but not piercing |
| **Coin Lead** | 12.5 % pulse + 50 % square +1 oct (×0.22) | 2 ms / 160 ms / 0.35 / 60 ms, gate 0.75 | Pitch envelope from a 4th below → note in 22 ms; LP 3.8 kHz with a +1.8 kHz / 60 ms "ping"; HP 90 Hz | Playful, sparkly hooks: every note "pings" like a pickup | Thin, glassy, bouncy, staccato |
| **Neon Lead** | 2 saws ±8¢ + square −1 oct (×0.22) | 8 ms / 120 ms / 0.8 / 120 ms, gate 0.95 | LP 1.5 kHz, Q 1.2 dB, env +1.6 kHz (d 250 ms, s 0.35), keytrack 0.5; glide 40 ms on legato; vibrato 5.2 Hz ±11¢ after 200 ms; HP 90 Hz | Warm synth-funk/synthwave lead that sings over chords | Smooth, thick, vocal, not buzzy |
| **Laser Lead** | Saw + 25 % pulse (+5¢) | 2 ms / 100 ms / 0.65 / 70 ms, gate 0.85 | Pitch dive from +24 st in 55 ms; drive 0.25 **into** a resonant LP 1.5 kHz, Q 5 dB, env +2.8 kHz (d 140 ms); vibrato after 250 ms; HP 90 Hz | Drops and boss themes: every note "zaps" in | Aggressive, arcade-action, tamed by the post-drive filter |

### BASS

| Preset | Synthesis | ADSR | Filter & modulation | Musical purpose | Character |
|---|---|---|---|---|---|
| **Chip Bass** | Triangle + 50 % square +1 oct (×0.12) | 2 ms / 50 ms / 0.85 / 25 ms, gate 0.85 | LP 3.2 kHz (static) | Bouncy console bass for chiptune/pop grooves | Round, clean, "NES triangle", with an octave edge for small speakers |
| **Funk Bass** | Saw + square (−6¢) + a 30 ms noise "pick" | 3 ms / 120 ms / 0.6 / 40 ms, gate 0.9 | Resonant LP 300 Hz, Q 7 dB, env +1.3 kHz (a 8 ms, d 130 ms, s 0.1), keytrack 0.3 | The pocket of NEON DRIVE: slap-flavoured synth-funk | Pops on each note, then sits round |
| **Acid Bass** | Single saw | 3 ms / 150 ms / 0.7 / 50 ms, gate 0.92 | Drive 0.45 → LP 220 Hz, Q 13 dB, env +2.3 kHz (d 170 ms, s 0.12); glide 60 ms on legato | Tech-house, builds, hypnotic loops | Squelchy and vocal, without screech |
| **Sub Bass** | Sine + sine +1 oct (×0.22) + triangle (×0.18) | 6 ms / 100 ms / 0.9 / 60 ms, gate 0.9 | LP 420 Hz, keytrack 0.3 | Deep, clean low end under busy leads | Felt more than heard. The 2nd harmonic keeps it audible on laptops |

### CHORDS

All chord presets use HP 140 Hz to stay out of the bass. Block chords are level-compensated by 1/√(notes).

| Preset | Synthesis | ADSR | Filter & modulation | Musical purpose | Character |
|---|---|---|---|---|---|
| **Pixel Chords** | 50 % square | 2 ms / 140 ms / 0.28 / 50 ms, gate 0.7 | LP 3.6 kHz (static), no detune | Crisp staccato console stabs | Pure, "pixel-sharp", bouncy |
| **Retro Keys** | Sine + triangle +1 oct (×0.45) + sine +2 oct (+4¢, ×0.12) | 4 ms / 600 ms / 0.35 / 250 ms, gate 0.95 | LP 1.4 kHz with a fast +2.6 kHz "tine" envelope (d 220 ms), keytrack 0.4 | Electric-piano warmth for funk and lo-fi | Bell-like attack, mellow body |
| **Dream Pad** | (Saw ×0.5 + triangle ×0.35) × 5-voice unison ±14¢ | 300 ms / 400 ms / 0.85 / 800 ms, gate 1.0 | LP 1.1 kHz, slow env (+300 Hz, a 400 ms), LFO 0.25 Hz ±280 Hz ("breathing") | Intros, breakdowns, night moods | Wide, lush, soft-edged |
| **Arcade Arp** | 25 % pulse | 2 ms / 40 ms / 0.7 / 20 ms per tick | Chord tones up-down over 2 octaves at 32nd notes (2 per step), tick gate 0.85; LP 5.2 kHz | Chords as arpeggios, the classic "more notes than channels" trick | Shimmering, busy, unmistakably 8-bit |

---

## 4. Sound-quality results (measured)

### Per preset

All presets were measured on the audition phrase: NEON DRIVE main section, 4 bars, 112 BPM, E Dorian.
- Loudness: BS.1770-style (K-weighting, 400 ms blocks, −70/−10 gates), cross-checked with ffmpeg `ebur128` (agrees within 0.2 LU).
- Spectral ratios: energy share of the dry voice in that band.

| Preset | Gain | LUFS (ffmpeg) | Sample peak | Edge jump × | HF > 6 kHz | 150 Hz–2 kHz | < 120 Hz | Tail | QA |
|---|---|---|---|---|---|---|---|---|---|
| 8-Bit Pulse | 0.291 | −18.9 | 0.356 | 0.94 | −22.9 dB | −1.0 | −50.0 | silent | PASS |
| Coin Lead | 0.652 | −18.7 | 0.446 | 0.79 | −19.1 dB | −2.3 | −38.8 | silent | PASS |
| Neon Lead | 0.321 | −18.8 | 0.422 | 0.97 | −29.4 dB | −1.0 | −35.0 | silent | PASS |
| Laser Lead | 0.210 | −18.8 | 0.355 | 0.72 | −21.8 dB | −3.5 | −40.0 | silent | PASS |
| Chip Bass | 0.977 | −14.9 | 0.441 | 0.74 | −49.9 dB | −7.7 | −5.3 | silent | PASS |
| Funk Bass | 0.871 | −15.0 | 0.553 | 0.81 | −59.9 dB | −4.4 | −6.7 | silent | PASS |
| Acid Bass | 0.705 | −14.9 | 0.586 | 0.77 | −49.2 dB | −4.4 | −6.8 | silent | PASS |
| Sub Bass | 0.541 | −14.8 | 0.448 | 0.96 | −95.8 dB | −7.6 | −5.5 | silent | PASS |
| Pixel Chords | 0.245 | −24.8 | 0.410 | 0.09 | −31.8 dB | −1.2 | −23.0 | silent | PASS |
| Retro Keys | 0.231 | −24.9 | 0.337 | 0.80 | −57.4 dB | −0.9 | −23.2 | silent | PASS |
| Dream Pad | 0.307 | −25.0 | 0.222 | 0.85 | −49.8 dB | −1.1 | −23.0 | silent | PASS |
| Arcade Arp | 0.334 | −24.9 | 0.307 | 0.95 | −25.6 dB | −1.2 | −23.9 | silent | PASS |
| *Production refs* | | lead −19.3 · bass −15.6 · chords −25.1 | | | lead −34.3 · bass −59.9 · chords −39.2 | bass −4.5 | | | |

How to read the checks:
- **No clipping:** 0 clipped samples. Every solo peak is ≤ 0.59, and the full mixes peak ≤ 0.874, sample-domain.
- **No stuck notes:** the dry render is fully silent (< −100 dB) 2.2 s after the last note.
- **No clicks or pops:** "Edge jump ×" compares the largest sample-to-sample jump within ±0.4 ms of every note-on and note-off with the waveform's own jumps nearby. Above 1.25 would be a click; the worst is 0.97. After each note's release the output is exactly 0, so no oscillator is truncated mid-cycle.
- **No excessive harshness:** limits on energy above 6 kHz are lead ≤ −14 dB, chords ≤ −18 dB, bass ≤ −24 dB. The first pass failed: raw pulse leads measured −9.6 to −11.5 dB. A gentle keytracked LP fixed this, with drive moved *before* the filter. The pulse leads remain brighter than the production "warm" lead by design (they are the chiptune options).
- **Balanced bass/lead:** every preset matches its role target within ±0.2 LU, so a swap never changes the mix balance.
- **Laptop speakers:** every bass has ≥ −7.7 dB of its energy in 150 Hz–2 kHz, the range small speakers actually reproduce. The production funk bass measures −4.5. Leads and chords keep < 120 Hz content ≤ −23 dB (a 90/140 Hz high-pass), so they don't muddy the bass on headphones.
- **CPU (offline render time for the 11 s phrase, dry):** most presets take 73–118 ms (production voices: 53–78 ms), Retro Keys 195 ms, and **Dream Pad 576 ms** (10 oscillators per note × 4-note chords). On a desktop that's about 5 % of one core in real time. On low-end phones, consider 3 unison voices.

### Live timing during preset changes

The live checks ran in Chrome, through the production `AudioEngine` + `Scheduler`:

| Check | Result |
|---|---|
| A/B flipped 29 times at random 150–400 ms intervals while playing (61 steps) | Step-interval error **0 ms**, **0** missing steps, **0** late schedules, minimum lookahead 76.9 ms |
| Output after Stop | **0.0000** RMS |
| Output after 10 rapid Play/Stop cycles | **0.0000** RMS (no stuck or layered notes) |

### Full-kit combinations

The whole NEON DRIVE arrangement (intro → end, 34.6 s): drums and the riff layer are unchanged, while lead, bass and chords are swapped.

| Render | Integrated (ffmpeg) | True peak | Stems lead / bass / chords / drums (LUFS) |
|---|---|---|---|
| Production reference (warm / funk / stab) | −14.3 | −1.0 dBTP | −18.9 / −15.7 / −26.9 / −18.0 |
| **CONSOLE**: 8-Bit Pulse · Chip Bass · Arcade Arp | −13.9 | −0.8 dBTP | −18.4 / −14.8 / −23.2 / −17.9 |
| **NIGHT DRIVE**: Neon Lead · Funk Bass · Dream Pad | −13.9 | **−0.1 dBTP** | −17.9 / −15.1 / −24.4 / −17.9 |

Two findings for the implementation phase:
1. **Chords run hotter over the full arrangement.** They're matched on the hook phrase but sit +2.5 to +3.7 LU over the full piece, because the arp and pad keep sounding through the long intro/variation chords where the production stab decays. If listening agrees, fix it with a per-preset "sustain trim" or by calibrating on the full arrangement.
2. **True peak is −0.1 dBTP on NIGHT DRIVE.** The master limiter works on samples, so intersample peaks can pass it. For WAV/MP3 export, lower the limiter ceiling to about −1.5 dBFS or add 2× oversampled peak detection. This is a production change, left for approval.

---

## 5. Listening review

All files are 44.1 kHz/16-bit stereo, rendered through the real mix and master chain. They are in the scratchpad (regenerate with the lab: `lab.presetWav(id, lab.GAINS)` / `lab.comboWav(id, lab.GAINS)`):

`/private/tmp/claude-501/-Users-rahulpatle-Documents-101Dev-100-Days-of-Digital-Craft-day-001-8bitcn-experiment-beat-bit/f8782503-0cd1-4214-a79b-e7e85a40cc64/scratchpad/lab/wav/`

- **Solo phrases, 11 s each, same notes:**
  - `01-pulse8.wav` … `04-laser.wav` (leads)
  - `05-chipbass.wav` … `08-sub.wav` (bass)
  - `09-pixelchords.wav` … `12-arcadearp.wav` (chords)
- **Full kits, 34.6 s each:** `combo-console.wav`, `combo-nightdrive.wav`, plus `combo-production-reference.wav` (today's sound).

What to listen for:
1. Within each role, are the four clearly different, and does each match its "character" line?
2. Do any feel quieter or louder than their siblings? They are matched by meter, but your ears decide.
3. Are any too harsh at your normal volume? Laser and Coin are the most likely.
4. On **laptop speakers**: can you still follow Sub Bass and Chip Bass?
5. Does CONSOLE or NIGHT DRIVE feel like "the same song, a different world"?

The lab page does the same live: A/B sets, solo per role, a loudness-match toggle, drums on/off, and per-set WAV download.

---

## 6. Shipped (V3.2b)

**What changed:**
- The preset voice moved to `src/audio/synth/` (`presets.ts`, `presetSynth.ts`, `calibration.ts`).
- `kitPlayer.ts` gained `playBassNote` / `playChordHit` / `playLeadNote`. A kit role names either an original voice or a synth preset id, and the composition is untouched.
- NEON DRIVE: `{ bass: 'funkbass', chords: 'dreampad', lead: 'neon', lead2: 'neon' }`. Previously funk / stab / warm / pulse25.
- The lab now calls the same kit-player functions as the app.

**Verified:**
- [B] The app's own renderer gives the full NEON DRIVE piece at −13.9 LUFS, identical to `combo-nightdrive.wav`. No clipping; tail −90.6 dB.
- [B] Live app check: first sound 297 ms after Play; all 4 kits switch; Remix/Undo/Clear exact; output silent after Stop.
- [T] 60/60 tests.
- Bundle 391.67 KB (125.75 KB gzip), up 3.7 KB gzip for the synth and 12 presets.

**Still open:**
- Dream Pad CPU on a real phone.
- True-peak headroom before any WAV/MP3 export ships.
- The chords-over-arrangement trim. It only matters for full-arrangement playback; Sandbox loops the main hook you auditioned.

## 7. Further implementation plan

| Step | Work | Touches |
|---|---|---|
| **S1. Promote the voice** | Move `presetSynth.ts` + the schema into `src/audio/`. Re-express the 4 current production voices (warm, funk, stab, pulse25…) as presets in the same schema, so there is **one** voice engine. Before switching anything, verify the re-expressed voices against today's WAVs (null-ish test: loudness within 0.3 LU, same spectral profile). | audio engine (internal) |
| **S2. Kits reference preset ids** | `kit.presets` become preset ids, plus per-kit default sounds. Composition data is unchanged. | `kits.ts` (types only) |
| **S3. Product choice of sounds** | Your decision: (a) a single **SOUND** toggle with 3 curated packs (Original / Console / Night Drive), recommended because it's one tap, fits a "living toy", and the city mood can follow it; (b) per-role pickers, more of a power-user feature. | main UI (new control) |
| **S4. Quality guards** | Unit tests for presets: attack ≥ 2 ms, release ≥ 8 ms, gain ≤ 1, a role on every preset, a calibration gain present. A CDP script re-runs `qaAll()` and fails on any non-PASS. | tests |
| **S5. Export-ready master** | True-peak headroom (limiter ceiling or oversampled detection) and the chord sustain trim. Then WAV export reuses `renderBars` unchanged. | master chain |
| **S6. Mobile CPU** | Measure Dream Pad on a real phone; if needed, use 3 unison voices when `hardwareConcurrency ≤ 4`. | presets |

Each step is small and testable on its own. S1 and S2 change no audible behaviour, so they can be verified as "sounds identical".

### Decisions needed

1. ~~Listening verdict~~: NIGHT DRIVE set chosen for NEON DRIVE.
2. **Engine:** approve staying native (no Tone.js, no retro-sound). This is in effect now.
3. **Product shape (S3):** curated sound packs (recommended) or per-role pickers.
4. **Chords over the full arrangement:** trim per preset, or accept the slightly fuller sound.
