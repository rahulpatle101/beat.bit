# BEAT.BIT — Music Direction (V2.3b reset)

**Status:** ⏳ PROPOSED on 2026-11-23, for review. The previews exist; nothing is in the app.
**Vision:** *BEAT.BIT is a playful music arcade where people create original funky tunes, perform them, earn rewards, and unlock reactive pixel worlds.*
**Companion docs:** [GAME_DESIGN.md](GAME_DESIGN.md) · [V2_ROADMAP.md → Part 5](V2_ROADMAP.md)

> **Honesty note.** I composed these four kits deliberately, using harmony, voice leading, and arrangement craft, and verified them **objectively**:
> - a music-theory lint (key, approach notes, range);
> - no clipping;
> - silent tails;
> - section loudness;
> - stem balance.
>
> **I can't listen.** "Audition" in the brief needs your ears. The previews below are the audition material.

---

## 1. Why the current music underwhelms

| Problem (V1–V2.3a) | Effect | Fix in this direction |
|---|---|---|
| Drums only. The melody is generated, no bass, no harmony. | Patterns sound like exercises, not tunes | Every kit has **bass + harmony + an authored hook** |
| One timbre per role, fixed velocity | Flat, mechanical feel | **Velocity accents, ghost notes**, role-specific synths, delay/reverb sends |
| 1-bar loops | No sense of journey | **Intro → main → variation → drop → end** arrangement |
| Random generation for defaults | No memorable hook | **Composed defaults.** Randomness only *mutates* them (§6). |

## 2. Arrangement principles

These are craft principles drawn from game music and electronic dance music [A: my synthesis, not sourced]. No melodies or recordings are copied.

1. **Loop-first, hook-second.** A 2-bar hook built from *rhythm + contour* repeats with a changed ending (call → answer → call → resolution). Repetition is what makes a tune hummable.
2. **Bass outlines the harmony.** The chord root lands on the downbeat, and chromatic **approach notes** on the last 16th lead into the next root. This is enforced by the lint.
3. **Channel discipline.** Classic consoles had about 4–5 voices, so every part has a job. Each kit uses **drums + bass + chords + 1–2 lead lines**, with no clutter.
4. **Frequency slots per role:** bass E1–A3, chords G3–E4, lead A4–A5. The roles don't fight.
5. **Syncopation lives in the kick and bass. The backbeat stays put.** Snare and clap on 2 and 4 anchor non-musicians, while the kick and bass carry the funk.
6. **The energy curve is arrangement, not volume:**
   - the intro *withholds* (drums and pad);
   - the main adds the hook;
   - the variation *changes harmony* (or strips back for a breakdown);
   - the drop *stacks* everything plus doubling, open hats, and claps;
   - the end *resolves*.
7. **Tension → release.** Dominant chords (A7 in BOSS RUSH), leading tones (C♯→D), builds (snare rolls, filter sweeps), and a final cadence on the tonic.
8. **Chiptune idioms used *as craft*, not as nostalgia:** arpeggiated chords (1/32 cycling), duty-cycle contrast between call and answer (25% vs 12.5%), delayed vibrato on held notes.

## 3. The four kits

All four previews render at 44.1 kHz stereo, 15 bars, through the real master chain.

| | **NEON DRIVE** | **PIXEL QUEST** | **NIGHT SHIFT** | **BOSS RUSH** |
|---|---|---|---|---|
| Style | Synth-funk | Chiptune adventure | Tech house | Battle theme |
| BPM · Key | 112 · E Dorian | 132 · C major | 124 · F minor | 150 · D harmonic minor |
| Harmony | Em9 \| A13 vamp (i9–IV13). Variation Cmaj7 \| D6/9 \| Em9 \| A13 | C \| Am \| F \| G. Variation Am \| F \| Dm7 \| G7 | Fm7 vamp. Drop Fm7 \| Fm7 \| D♭maj7 \| E♭6 | Dm \| B♭ \| Gm \| A7. Build Gm \| Gm \| A7 \| A7 → Dm |
| Drums | Syncopated kick (1, a-of-2, and-of-3), backbeat snare with **ghost notes**, accented 16th hats, clap layer | Bouncy kick, backbeat snare, 8th hats, snare-roll fills | Four on the floor, **offbeat open hats**, clap on 2 and 4, soft 16th hats, accelerating snare roll in the build | Galloping kick, double-time drop, **tom fills** every 4 bars, crashes |
| Bass | **Funk** (saw + square, resonant filter pop): root/octave pops, chromatic approaches (G♯→A, D♯→E, B→C) | **Chip** triangle: root–octave–fifth bounce | **House** sub + saw on the offbeat 16ths ("and"/"a"), written per chord | **Drive** (detuned saws): 8th + two 16ths gallop, octave on beat 3 |
| Hook (original) | "B-D-**E**~ D-**B**~ A-**B**~~" / answer "C♯-E-**F♯**~ E-**C♯**~ B-**A**~~", ending variant resolving to E | Call (25% pulse) "E-G-**C**~ B-C-**E**~ D-**C**~", answer (12.5% pulse) climbing to the 5th, then G5 | Hypnotic 1-bar riff (F-A♭-C-F-E♭-C-A♭) + drop hook "C~ A♭ B♭ **C**~ E♭ C **B♭**~ **A♭**~" | Minor hook with the **leading tone** "D~ A D **F**~ E D **C♯**~ D E **A**~~~", climbing through B♭ and Gm to a dramatic A7 run that resolves |
| Lead sound | "Warm": saw + square, LP 2.6 kHz, glide on steps, delayed vibrato | Pulse 25% (call) / pulse 12.5% (answer), vibrato | "Hero" detuned saws + a resonant "riff" synth with a filter that opens through the build | "Hero" saws + 25% pulse octave-down doubling in the drop |
| Chords | Funk **stabs** on syncopated 16ths. Pads in the intro and variation. | **Chip arpeggio** (1/32 cycling) | Warm **pad** under the riff. Breakdown pad swells. | **Stabs** on the gallop accents |
| Arrangement | Intro 2 · Main 4 · Variation 4 · Drop 4 · End 1 | same | same; the "variation" is a **breakdown + build** | same; the "variation" is a **dominant build** |
| Length | 34.2 s | 29.3 s | 31.1 s | 26.1 s |
| City mood (suggested) | Warm neon | Bright arcade | Deep teal night | Red alert |

### Preview files (for your audition)
- `beatbit-kit-NEON-DRIVE.wav` · `beatbit-kit-PIXEL-QUEST.wav` · `beatbit-kit-NIGHT-SHIFT.wav` · `beatbit-kit-BOSS-RUSH.wav`
- They're rendered by the dev-only harness `dev/music-preview.html` (`src/dev/music/`). The score data is in `src/dev/music/kits.ts`, readable as notation.

## 4. Objective QA of the previews

All checks run on the final renders [B = run in Chrome].

| Check | NEON DRIVE | PIXEL QUEST | NIGHT SHIFT | BOSS RUSH | Target |
|---|---|---|---|---|---|
| Peak (clipped samples) | 0.867 (0) | 0.893 (0) | 0.779 (0) | 0.925 (0) | < 0.95, 0 clipped |
| Tail after the end hit (no stuck notes) | −92.8 dB | −101.3 dB | −101.6 dB | −106 dB | < −80 dB |
| Section RMS intro → main → var → drop | −19 → −16.2 → −16.6 → −15.8 | −19.7 → −16.6 → −17 → −16.1 | −18.8 → −16.6 → **−23** → −16.5 | −16.7 → −16.7 → −17.5 → −15.4 | intro < main ≤ drop |
| Stems: drums / bass / chords / lead (dB RMS) | −21 / −18 / −30.3 / −23 | −20.7 / −17.7 / −27.6 / −27.2 | −20.7 / −22 / −27 / −29.2 | −18.6 / −20.7 / −28.9 / −24.6 | bass within ±3 dB of drums. Lead −22 to −30. Chords below the lead. |
| Theory lint (key, approaches, range) | ✅ | ✅ | ✅ | ✅ | 0 findings |

**What the lint caught while composing** (all fixed):
- NEON DRIVE: a G♯ that didn't resolve, and a D♯ approach note leading to C instead of E (voice-leading slip).
- PIXEL QUEST: a doubling an octave too high (E6, shrill).
- NIGHT SHIFT: E♮ and F♯ in the bass from a transposed pattern (out of key).

BOSS RUSH's E♭ over Gm is a **deliberate** flat-second (♭II) colour, documented as allowed.

**Known gap:** drops are only about 0.5–1.3 dB louder than the main section (the compressor evens them out). The drop's lift currently comes from *arrangement* (doubling, open hats, crash). A sidechain-style pump on the bass and pads is the next mix improvement [A].

## 5. Sound palette (prototype → product)

| Role | Voices (prototype in `src/dev/music/synths.ts`) | Product notes |
|---|---|---|
| Drums | V1 kick/snare/hat/clap **+ velocity**, open hat, crash, shaker, synth toms | Velocity becomes part of the step data (3 levels: accent / normal / ghost) |
| Bass | funk · chip · house · drive | One preset per kit. Fixed stop times. |
| Chords | stab · pad · chip-arp · riff | Voicings are authored per kit (no auto-voicing in v1) |
| Lead | warm · pulse25 · pulse12 · hero (+ glide, delayed vibrato) | V2.3a BIT LEAD = `pulse25` (preserved) |
| FX | Dotted-8th delay (filtered feedback), generated 1.8 s reverb | Sends only from chords and lead |
| Master | V1 compressor (via `createMasterChain`) | **Add a final safety limiter** (ratio 20, −1 dBFS) for user-mutated content |

## 6. Phase B: mutating kits instead of generating from scratch

**Principle:** quality comes from the composed kit. Randomness only makes **small, musically valid edits** to it, so every result is still that kit's tune.

### 6.1 Representation
A kit is a **scored arrangement**: sections → bars → role parts (`drums` with velocities, `bass`, `chords`, `lead`, `lead2`, `riff`), plus **harmony per bar** (chord root and chord tones) and **locks**:
- **Locked:** kick/snare backbeat anchors (V2.2 rule), the bass on chord downbeats, the hook's first note of each bar, and the final cadence.
- **Mutable:** everything else, within that kit's style rules.

### 6.2 Style rules (per kit)
| Kit | Rhythm grid | Allowed rhythmic moves | Bass rules | Lead rules |
|---|---|---|---|---|
| NEON DRIVE | 16th swing-free funk | Kick pickups on "a"; ghost snares on "e"/"a"; hat accent shifts | Root on downbeats, octave pops, chromatic approach on step 15 only | Dorian notes; neighbour tones; keep the "B-D-E" head |
| PIXEL QUEST | 8th bounce | Snare-roll fills in bar 4; kick on "and" of 3 | Root–octave–fifth patterns only | Arp ornaments, octave jumps on the answer, call/answer duty contrast kept |
| NIGHT SHIFT | Four on the floor (locked) | Open-hat and clap layers, shaker density | Offbeat positions only ("and"/"a"), chord-tone only | Riff note substitution within Fm7 tones; filter-sweep depth |
| BOSS RUSH | Gallop / double-time | Tom-fill shapes, crash placement | Gallop shape locked; octave choice mutable | Hook sequence up/down by scale step; leading tone must resolve |

### 6.3 Mutation levels (seeded, deterministic, undoable)

| Level | Edits per press | Scope | Example |
|---|---|---|---|
| **SUBTLE** | 2–3 | One role. Ornaments and accents only. | Ghost snare on "e" of 3 · hook neighbour tone · hat accent shift |
| **PLAYFUL** *(default)* | 4–6 | Two roles. Rhythmic displacement allowed. | Kick pickup + bass octave pop + an answer phrase ending moved up a 3rd |
| **WILD** | 7–10 | All roles + one *arrangement* move | New fill shape, the hook sequenced up a step for the variation, chord stab rhythm swapped for another style template, drop doubling an octave up |

- **Seeded:** `mutate(kit, seed, level)` uses `mulberry32` (as now). The seed is shown (`#0421`) for future sharing.
- **Harmony alignment:** every pitched edit is validated against the bar's chord tones and scale. Bass edits land on chord tones on strong steps. Chromatic notes are allowed only as semitone approaches (**the lint becomes a runtime validator**). Invalid edits are discarded and re-rolled (bounded), as the V2.3a melody generator already does.
- **Repetition kept:** hook edits are applied to *motif positions* (A, A′, A″), not individual bars, so a mutated hook still repeats.
- **Undo and restore:** each mutation is a diff pushed onto the existing Undo history, plus **RESTORE ORIGINAL** (one tap back to the composed kit).
- **No clipping:**
  - per-role gain staging (measured above);
  - a voice-count cap per role (lead ≤ 2, chords ≤ 4 notes, bass mono);
  - a velocity ceiling;
  - a final safety limiter.
  - CI-style check: render 200 seeded WILD mutations offline and assert peak < 0.98.
- **No stuck notes:** every voice has a fixed stop time (already true). Stop's bus cut silences everything (verified in V2.3a). Mutation never extends a note past the bar end.

### 6.4 What happens to existing systems
- **V2.2 Remix Dice:** becomes the *drums* part of SUBTLE/PLAYFUL mutation (its rules carry over unchanged).
- **V2.3a melody generator:** becomes the motif-edit engine for lead mutations. Its constraints (scale, intervals, cadence) are reused.
- **V2.3a BIT LEAD:** kept as the `pulse25` preset (PIXEL QUEST's call voice).
