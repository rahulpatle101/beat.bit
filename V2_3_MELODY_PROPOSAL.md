# BEAT.BIT V2.3 — Chiptune Melody & Playful Randomization (Proposal)

**Status:** ✅ APPROVED on 2026-11-23 (all six §10 recommendations accepted). **V2.3a (synth + generator + review controls) implemented.** V2.3b (Pitch Grid editor, tower light) and V2.3c (Remix Dice v2) not started.
**Vision:** *Make a beat. Wake the city. Discover something unexpected.*
**Inputs:** CLAUDE.md · DESIGN.md (V1, V2.1, V2.2) · ART_DIRECTION.md (V1, V2.1, V2.2) · MARKET_RESEARCH.md · V2_ROADMAP.md · BUILD_STATUS.md
**Guardrails:**
- Preserve V2.1/V2.2 behavior.
- No AI API, backend, accounts, samples, or DAW features.
- Understandable to non-musicians.
- Accessibility, reduced motion, and audio sync are maintained.

> Note on roadmap numbering: V2_ROADMAP planned V2.3 as URL sharing. This brief re-scopes V2.3 to melody. Sharing moves later; the melody's seed is designed to be shareable when that happens.

Evidence tags as before: **[V]** verified this session · **[R]** reported/secondary · **[A]** assumption / my judgment · **[C]** computed.

---

## 1. Research: the simplest chiptune synth on our architecture

| Finding | Tag |
|---|---|
| `OscillatorNode.type` offers `sine`, `square`, `sawtooth`, `triangle`. Any other shape uses `setPeriodicWave()` (which sets the type to `custom`). | [V] MDN |
| `createPeriodicWave(real, imag)` builds a waveform from Fourier coefficients. There's **no pulse-width/duty parameter**, so a 25% or 12.5% pulse needs a PeriodicWave. Coefficients for duty *d*: `real[n] = (2 / (nπ))·sin(nπd)`, `imag[n] = 0` (cosine series; the phase offset doesn't matter for a lead). | [V] MDN (API) · [A] (the coefficient formula is the standard pulse Fourier series) |
| All four V1 drum voices already take a `BaseAudioContext` (shared by `AudioContext` and `OfflineAudioContext`), and so does `createNoiseBuffer`. | [V] code (`src/audio/voices.ts`) |
| `OfflineAudioContext.startRendering()` is Baseline widely available (since 2021) and resolves to an `AudioBuffer`. WAV encoding is ours to write. | [V] MDN |
| Chiptune leads: pulse 25% is the "classic" lead tone, square 50% is hollower, triangle is softer (traditionally bass). Very short attack, quick decay to a sustain, short release, and monophonic (one note at a time). | [A] (genre convention) |

**Chosen synth: "BIT LEAD"**, one monophonic voice:
- **Wave:** 25% pulse (PeriodicWave, 32 harmonics, created once per context and cached).
- **Envelope:** attack 3 ms → decay 70 ms to 55% sustain → note held for 85% of a step → 40 ms release. Short, plucky, no clicks.
- **Level:** peak gain ≈ 0.16, into the same bus and compressor as the drums, so it sits under the kit.
- **Pitch:** a 6-note minor-pentatonic scale (§4), converted to Hz with equal temperament.
- **Monophonic:** at most one note per step, each ending before the next starts. No chords, no ties in V2.3.
- **No new dependencies.** It's about 60 lines in `src/audio/lead.ts`.

---

## 2. Melody editor: two concepts

Both use the same data: **16 steps, each a rest or one of 6 pitches** (low → high). Both reuse the drum grid's 8bitcn cell language (pixel bevel, `--cell-edge`, square focus ring, playhead wash), and add a 5th track color:

| Token | Value | Contrast [C] |
|---|---|---|
| `--lead` (melody) | `#6fcf97` muted mint | 8.06:1 on an empty cell · dark glyph on mint 10.15:1 |

### Concept A — PITCH LANE (compact 16-step pitch sequencer)

One extra row under the drums. Each step is a cell showing a **pixel bar whose height is the pitch** (empty = rest).

```
DESKTOP                                                        MOBILE (2 blocks of 8)
 ▮ KICK   ■□□□ □□■□ ■□□□ □□□■                                   ▮ ■□□□ □□■□
 ▚ SNARE  □□□□ ■□□□ □□□□ ■□□□                                   ▚ □□□□ ■□□□
 ▴ HAT    ■□■□ ■□■□ ■□■□ ■□■■                                   ▴ ■□■□ ■□■□
 ✚ CLAP   □□□□ □□□□ □□□□ ■□□■                                   ✚ □□□□ □□□□
 ♪ MELODY ▃□▅▆ □▃□▂ ▃□▅▆ □▆▅▃   ← bar height = pitch            ♪ ▃□▅▆ □▃□▂
```
- **Edit:** tap = cycle the pitch up (rest → 1 → … → 6 → rest). Drag vertically = set the pitch. Keyboard ↑/↓ = pitch, Delete = rest.
- **Desktop:** very compact, and the drum layout is unchanged.
- **Mobile:** fits the existing 2×8 blocks with one more row. **But** vertical drag on a 34 px cell fights page scroll, and tap-to-cycle means up to 6 taps to reach a pitch.
- **Understanding:** "bar height = pitch" is learnable, but the melody's *shape* is hard to read and hard to aim at.
- **A11y:** each cell is a `slider`-like control (`aria-valuetext="E"`), which is simple to make accessible.

### Concept B — PITCH GRID (simplified, monophonic piano roll) ✅ recommended

A **DRUMS / MELODY** tab switch above the grid (8bitcn **Tabs** [A: verify source]). The MELODY view is a 6-row × 16-step grid in the same cell style, **one note per column**: tapping a cell puts that column's note there (moving it if one was already set), and tapping the lit cell clears it.

```
DESKTOP — MELODY tab                                           MOBILE — MELODY tab (2 blocks)
 [ DRUMS ][▶MELODY]                    [🎲 MELODY] seed #0421    [ DRUMS ][▶MELODY]
  high 6  □□□■ □□□□ □□□■ □□□□                                    6 □□□■ □□□□
       5  □□■□ □□□□ □□■□ □■□□                                    5 □□■□ □□□□
       4  □□□□ □□□□ □□□□ □□■□                                    4 □□□□ □□□□
       3  ■□□□ □■□□ ■□□□ □□□■                                    3 ■□□□ □■□□
       2  □□□□ □□□■ □□□□ □□□□                                    2 □□□□ □□□■
  low  1  □□□□ □□□□ □□□□ □□□□   ← contour reads like a line      1 □□□□ □□□□
          1    5    9    13                                       (steps 9–16 block below)
```
- **Edit:** tap where the note should be. That's direct, there's no cycling, and higher on screen means a higher note.
- **Desktop:** 6 rows of 40 px fit in roughly the drum grid's footprint, because the two views share one area via tabs. The city and transport stay visible.
- **Mobile:** the same 2×8 block layout as the drums. 12 rows of about 34 px is scrollable, and there's no drag (tap only), so scroll conflicts are avoided.
- **Understanding:** the melody's **shape is visible**. A non-musician sees "up, up, down" and can copy or draw a shape. That makes it the most discoverable of the two.
- **Keyboard:** the same roving grid model as the drums (←/→ step, ↑/↓ pitch row, Space places or clears). Names: "Melody, step 5, note E, on".
- **Cost:** a second view to build (about the size of the drum grid), and the melody isn't visible while the DRUMS tab is open. This is mitigated by a compact melody preview strip in the DRUMS view.

### Evaluation

| Criterion | A · Pitch Lane | B · Pitch Grid |
|---|---|---|
| Non-musician clarity ("what do I tap?") | 3 | **5** |
| Shows melodic shape | 2 | **5** |
| Mobile touch (no drag, no scroll conflict) | 2 | **4** |
| Vertical space | **5** | 3 (tabbed, so contained) |
| Fits 8bitcn grid language | 4 | **5** (identical cells) |
| Keyboard / screen reader | **5** | 4 |
| Build cost | **4** | 3 |
| **Total (35)** | 25 | **29** |

**Recommendation: B · Pitch Grid behind DRUMS / MELODY tabs**, plus a read-only melody preview strip (a 1-row mini contour) in the DRUMS view, so the melody is never invisible.

---

## 3. Data model and timing (technical approach)

```ts
type Degree = 0 | 1 | 2 | 3 | 4 | 5            // index into the 6-note scale
type Melody = (Degree | null)[]                // 16 steps; null = rest
interface MelodyState { notes: Melody; seed: number; on: boolean }
```
- **Separate from `Pattern`:** drum code, Remix Dice, and its tests are untouched.
- **The scheduler gets one more read:** `getMelody()` per step, alongside `getPattern()`. A note is triggered at the **same scheduled time** as the drums on that step, and `StepEvent` gains `note?: number`. Edits land on the next pass, as with drums.
- **The audio engine gets `triggerLead(midi, time, durSec)`.** It shares the bus, so **Stop's `cut()` silences the melody too**. Blocked/silent mode skips the lead just like drums.
- **Undo:** the existing history snapshots gain `melody`.
- **Grooves:** each groove gets a **curated default melody seed** (a generated phrase, chosen by ear), but **melody is OFF on first load**. First Play is unchanged from V2.2 (guardrail: preserve behavior). Turning MELODY on, or generating one, is the "discover something unexpected" moment.

---

## 4. Constrained melody generator

**Goal:** melodies that always sound "right" over our grooves, are short and repeatable, and reproduce from a seed.

**Scale: 6-note minor pentatonic** (no wrong notes are possible), with the root set per groove:

| Groove | Root | Scale (degrees 1–6) | Density (notes/bar) | Rhythmic bias |
|---|---|---|---|---|
| SIGNAL 104 | A | A3 C4 D4 E4 G4 A4 | 6–8 | Mixed 8ths/16ths |
| BOOM BAP 90 | D | D3 F3 G3 A3 C4 D4 | 4–6 | Sparse, offbeat, laid back |
| TECHNO 128 | F | F3 A♭3 B♭3 C4 E♭4 F4 | 6–8 | Offbeat 8ths (between kicks) |
| BOSS FIGHT 150 | E | E3 G3 A3 B3 D4 E4 | 8–11 | Driving 8ths, climbing |

**Phrase grammar (16 steps = 4 beats):** `A  A′  B  A″`
1. **Motif A (beat 1):** 2–3 notes on a rhythm template chosen from a small set per density class. Starts on degree 1, 3, or 5 (root, 3rd, or 5th).
2. **A′ (beat 2):** A's rhythm. The pitches are moved by ±1 scale degree, or the last note is changed (the "call").
3. **B (beat 3):** a contrasting answer. It inverts A's contour, or holds a higher note.
4. **A″ (beat 4):** A's rhythm, **ending on the root (degree 1 or 6)**, so the loop resolves.

**Constraints:**
- Intervals ≤ 3 scale degrees, except the octave (1↔6).
- At most 2 consecutive leaps.
- Note count stays within the groove's density band.
- No note on a step where **both** kick and snare hit (leaves room), unless the density band would otherwise be missed.

**Seeded:** `generateMelody(grooveId, seed) → Melody`, using our existing `mulberry32`. The same seed and groove always give the same melody. The seed is shown as `#0421` and is ready for future URL sharing.

**Testable properties:** in scale · density band · interval limits · ends on the root · A/A′/A″ share a rhythm · deterministic · differs across seeds · avoids kick+snare collisions.

---

## 5. How the melody changes the city (art direction amendment, proposed)

**Principle:** the melody gets **one place in the city**, not a fifth character. The four performers stay the stars.

**The tower plays the melody: the "elevator light".** The tower has exactly **6 rows × 4 columns** of windows below the BIT sign [V: geometry], which map one-to-one onto the **6 scale degrees**. Each melody note lights the **two centre windows of the matching row** in `--lead` mint for the note's duration, then fades in 2 pixel frames. A rising melody reads as a light climbing the tower's central shaft.

| Aspect | Rule |
|---|---|
| Placement | Tower, centre columns (x = 74 and 78), rows y = 37 (low) → 17 (high) |
| Color | `--lead` mint, the only new color. Glow follows the V1 single-glow rule (none). |
| Timing | Onset on the heard step (same note queue). Hold = note length. 2-frame fade. |
| Hierarchy | Smaller than one apartment window per note and never brighter than the BIT sign. Performers unchanged. |
| Melody off | The tower shaft stays dark (V2.2 look unchanged) |
| Reduced motion | Same lights, with no fade frames (instant on/off). Not motion, just light. |
| Not added | No new performer, no sky change, no particles |

---

## 6. Remix Dice v2: drums and melody independently, with Chaos

**UI** (in the transport, next to REMIX):
- **DICE:** an 8bitcn Toggle Group `DRUMS | MELODY | BOTH`. The default is DRUMS (V2.2 behavior). MELODY is enabled once a melody exists.
- **CHAOS:** a 3-step 8bitcn Slider `NUDGE · GROOVE · WILD`, default GROOVE (= V2.2 rules). The value text is read out ("Chaos: groove").

| Chaos | Drums (V2.2 engine, re-parameterised) | Melody moves |
|---|---|---|
| **NUDGE** | 1–2 changes, drift ≤ 5, kick/snare/hat-density moves only | 1–2: move one note ±1 degree, or shift one note by one step |
| **GROOVE** *(default)* | 2–4 changes, drift ≤ 8 (**exactly V2.2**) | 2–3: the moves above + vary A′/A″ endings, add or remove a passing note |
| **WILD** | 4–6 changes, drift ≤ 12, all moves (anchors **still** kept) | Regenerate motif B, or a new seed from the same groove profile (always in scale, always resolving) |

**Rules carried over:**
- Anchors are kept and tracks are never emptied (drums).
- Melody remixes stay in scale and keep the final-root resolution.
- Every roll is audible, with at least 1 change on the chosen target.
- **One shared Undo history** (snapshots include melody).
- Feedback is the V2.2 roll ring on changed cells in the visible view, plus the die tumble.
- **BOTH:** the change budget is split, roughly 60% drums and 40% melody.

---

## 7. Future audio export: architecture (plan only; not implemented)

**Can the current engine be reused with `OfflineAudioContext`? Yes, for the sound, not the clock.**

| Part | Reusable offline? | Change needed |
|---|---|---|
| Drum voices (`voices.ts`) | ✅ Already `BaseAudioContext` [V] | None |
| Noise buffer | ✅ [V] | None |
| BIT LEAD (new) | ✅ If written against `BaseAudioContext`, with a **per-context** PeriodicWave cache | Build it that way in V2.3 (planned) |
| Master chain (compressor → gain → destination) | ⚠️ Built inside `AudioEngine.build()` (AudioContext only) | Extract `createMasterChain(ctx: BaseAudioContext)`, used by both the engine and the exporter |
| Scheduler (JS timer lookahead) | ❌ Real-time only | **Not used offline.** Add a pure `eventsFor(pattern, melody, bpm, bars) → {time, track/note}[]` sharing `stepDuration()`, so live and export timing are identical by construction |
| Engine lifecycle (unlock, statechange, `cut`, latency) | ❌ Live-only | Not needed offline |

**Export flow (future):**
1. Create a new `OfflineAudioContext({ numberOfChannels: 2, sampleRate: 44100, length: ⌈(bars·barSec + 1.0 tail)·44100⌉ })`.
2. Call `createMasterChain` and `createNoiseBuffer`.
3. For each event from `eventsFor(...)`, call `VOICES[track]` or `lead`.
4. Call `await startRendering()`.
5. **Encode the result as 16-bit PCM WAV** (about 40 lines) → `Blob` → download "BEAT.BIT – BOOM BAP #0421.wav".

**Defaults:** 4 bars plus a 1 s tail. Expect a few hundred ms of render time per 4 bars [A: verify]. Video/GIF export (canvas + audio via `MediaRecorder`) is a separate, later decision.

**V2.3 makes export cheap later by doing two things now:**
- write the lead synth against `BaseAudioContext` with a per-context cache;
- route through an extracted `createMasterChain`.

I'll prove both with an **offline render smoke test** in Chrome: render 1 bar and assert it isn't silent.

---

## 8. Acceptance criteria

### Phase V2.3a — synth + generator (the only part implemented after approval)
- [ ] BIT LEAD plays 25%-pulse notes with the specified envelope. No clicks at note boundaries. Nodes are released (`onended` cleanup).
- [ ] Melody notes are scheduled by the existing scheduler at exactly the drum step times. **Unit test:** melody triggers carry the same `time` as drum triggers on that step. **Chrome:** note events align with the playhead (0-frame lag).
- [ ] Stop silences the melody immediately. Rapid Play/Stop ×21 leaves no hanging notes. Tempo changes apply from the next step.
- [ ] Generator unit tests pass for every groove × 500 seeds: in scale, density band, intervals, ending on the root, A/A′/A″ rhythm, deterministic, avoids kick+snare collisions.
- [ ] **Offline render smoke test:** 1 bar of drums + melody rendered via `OfflineAudioContext` in Chrome is non-silent, with peak below clipping. This proves the engine can be reused for export.
- [ ] Melody **off by default**: first load and first Play are identical to V2.2. All V2.1/V2.2 probes and regression suites pass unchanged.
- [ ] Minimal review controls work by keyboard with visible focus: **MELODY on/off** and **NEW MELODY** (seeded), each with live announcements.
- [ ] **You approve the generated melodies by ear** for all four grooves.

### Later phases (for reference)
- **V2.3b:** Pitch Grid editor + tabs + preview strip + tower "elevator light", with keyboard, reduced-motion, and mobile checks.
- **V2.3c:** Remix Dice v2 (target + Chaos).
- **Export:** a separate phase.

---

## 9. Implementation plan (after approval: V2.3a only)

| Step | Work | Verify |
|---|---|---|
| 1 | `src/audio/lead.ts`: 25% pulse PeriodicWave (per-context cache), `playLead(ctx, out, time, freq, dur)`. Extract `createMasterChain(ctx)` from the engine (no behavior change). | Unit: pulse coefficients. Chrome: drum regression unchanged |
| 2 | `src/data/melody.ts`: scales per groove, phrase grammar, `generateMelody(grooveId, seed)`, `mulberry32`-seeded. | Unit: 4 grooves × 500 seeds properties |
| 3 | Scheduler: `getMelody` dep, `StepEvent.note`, lead trigger. Engine `triggerLead`. Hook state `{notes, seed, on}` + Undo snapshot field. | Unit: melody/drum time equality. Chrome: playhead alignment, Stop/rapid toggling/tempo |
| 4 | Minimal controls in the transport: `MELODY` toggle + `NEW MELODY` button showing the seed `#0421` (8bitcn Button). **No editor and no city visual yet.** | Keyboard/focus, announcements, mobile layout |
| 5 | Offline render smoke test (in-page, Chrome). BUILD_STATUS update. Short demo recording. | §8 V2.3a criteria |

Estimate: about half a day. Then **stop for your review** (listening to the melodies is the key gate).

---

## 10. Decisions needed

1. **Editor:** B · Pitch Grid behind DRUMS/MELODY tabs (recommended), or A · Pitch Lane?
2. **Melody default:** OFF on first load, so V2.2 first-play is preserved (recommended)? Or ON with each groove's curated melody?
3. **Scale:** 6-note minor pentatonic with a per-groove root (recommended), or one shared key?
4. **City visual:** the tower "elevator light" in `--lead` mint (recommended)?
5. **Chaos control:** a 3-step slider NUDGE / GROOVE / WILD (recommended), or a 3-button toggle?
6. **V2.3a scope:** OK to include the two minimal review controls (MELODY on/off, NEW MELODY), so you can hear the synth and generator before the editor exists?

## Sources
- [MDN — OscillatorNode.type](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode/type)
- [MDN — OscillatorNode.setPeriodicWave()](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode/setPeriodicWave)
- [MDN — BaseAudioContext.createPeriodicWave()](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createWaveTable)
- [MDN — PeriodicWave](https://developer.mozilla.org/docs/Web/API/PeriodicWave)
- [MDN — OfflineAudioContext](https://developer.mozilla.org/docs/Web/API/OfflineAudioContext) · [startRendering()](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext/startRendering)
- [Web Platform features explorer — Offline audio context](https://web-platform-dx.github.io/web-features-explorer/features/offline-audio-context)
