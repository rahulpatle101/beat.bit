# BEAT.BIT — Game Design

**Status:** ⏸ **PARKED (2026-11-24, V3.1).** The product direction is now a *living music toy*, not a scoring game. The V3.0 Arcade slice (Wake the City, XP, stars, ranks) remains in the code behind the disabled feature flag `FEATURES.arcade`. Nothing here is on the active roadmap.
*(Originally proposed on 2026-11-23.)*
**Vision:** *A playful music arcade where people create original funky tunes, perform them, earn rewards, and unlock reactive pixel worlds.*
**Companion docs:** [MUSIC_DIRECTION.md](MUSIC_DIRECTION.md) · [V2_ROADMAP.md → Part 5](V2_ROADMAP.md)

## Design pillars
1. **Music first.** Every interaction produces something that sounds good. Failure is never ugly noise.
2. **Readable rhythm.** Cues use the instrument the player already knows: the grid, the lamps, and the performers. No separate note highway.
3. **Fair and generous.** Timing is judged on the audio clock, with latency calibrated, and spamming can't win.
4. **Short sessions.** One challenge takes 30–60 s. "One more try" is a single press.
5. **Inclusive.** Every timed challenge has an assist path and a non-timed alternative.
6. **No accounts.** Progress lives in `localStorage`. No backend, no leaderboard (yet).

---

## 1. Modes

### SANDBOX: make music
- Pick an **unlocked kit** (NEON DRIVE, PIXEL QUEST, …) → its composed tune plays (intro → main → variation → drop).
- **Edit** the drum grid (as now), toggle layers (bass / chords / lead), adjust tempo.
- **Mutate:** SUBTLE / PLAYFUL / WILD (MUSIC_DIRECTION §6), with UNDO and **RESTORE ORIGINAL**.
- **Save** up to 8 slots locally. **Download** a WAV (offline render, already proven in V2.3a).
- No scores. Light XP only for *first-time* creative milestones (first save, first download, first WILD mutation), each awarded once (§5).

### ARCADE: perform music
- Short **challenges** (30–60 s) built on a kit. The player **performs** drum hits in time on **pads**:
  - **Desktop:** keys `F` `J` (2 pads) or `D F J K` (4 pads).
  - **Touch:** large on-screen pads at least 64 px.
  - **Gamepad:** optional, later.
- **Cues are the existing instrument.** Upcoming target steps glow on the sequencer grid one bar ahead. When the playhead lamp reaches a glowing column, you hit. The **performers react to your hits** (the Stomper stomps when *you* hit the kick), so the city literally performs what you play.
- Results → score, accuracy, stars, XP, unlocks.

## 2. Core gameplay loop

```
 ┌─► PICK (challenge or kit) ─► PLAY / PERFORM (30–60 s) ─► RESULTS (score · stars · XP)
 │                                                             │
 │                                                             ▼
 └── NEW KIT / WORLD MOOD / LEAD SOUND ◄── UNLOCK ◄── RANK UP / CHALLENGE CLEARED
                     │
                     ▼
            SANDBOX: remix the unlocked kit ─► save / download ─► (later: share)
```
Arcade earns the **kits**, and Sandbox is where you **make them yours**. Each feeds the other.

## 3. Timing, scoring and anti-spam

### 3.1 Judging
- Every cue has an exact **audio-clock time** (from the scheduler). A pad press is converted to audio time:

  `pressAudioTime = ctx.currentTime − (performance.now() − event.timeStamp)/1000 − outputLatency − calibrationOffset`
- **Windows (Normal):** PERFECT ±35 ms · GREAT ±70 ms · GOOD ±110 ms · otherwise MISS.

  **Assist mode** doubles every window [A: tune by playtest].
- **Calibration:** a 10-tap "tap with the kick" screen. The median offset is stored. This is offered at the first challenge and is skippable.

### 3.2 Points
| Judgement | Points | Combo |
|---|---|---|
| PERFECT | 100 | +1 |
| GREAT | 70 | +1 |
| GOOD | 40 | +1 (keeps the combo) |
| MISS (no press for a cue) | 0 | Resets |
| **STRAY** (a press with no open cue on that pad) | −10 (score floor 0) | Resets |

- **Combo multiplier:** ×1 → ×2 at 8 → ×3 at 16 → ×4 at 32.
- **Objectives** add fixed bonuses (e.g. "+500: no misses in the drop").
- **Accuracy:** `Σ judged weights / (cues + strays)`, where PERFECT = 1, GREAT = 0.7, GOOD = 0.4.
- **Stars** come from accuracy: ★ 60% · ★★ 75% · ★★★ 90%. A challenge is **cleared at ★**.

### 3.3 Anti-spam safeguards
1. **One press per cue.** A cue is consumed by the first press inside its window. Extra presses become STRAYs.
2. **Strays cost points, break the combo, and count in the accuracy denominator.** Mashing 8 presses per beat drives accuracy toward 0 (target: below 25% in tests), so it can't reach ★.
3. **Per-pad debounce:** presses closer than 40 ms on the same pad count once (key-repeat and bounce protection).
4. **Stars and XP come from accuracy, not raw score**, so a long combo bought with mashing earns nothing.
5. **Max score is bounded** by the chart (cues × 100 × 4 + objectives), so it's verifiable.
6. **XP cooldown:** replaying a cleared challenge gives full XP only for a new best star tier, otherwise 20%. Sandbox milestones pay once.

## 4. Example challenges

### A. WAKE THE CITY *(tutorial · NEON DRIVE intro → main · ~30 s · 2 pads)*
- **Story:** Signal City is asleep. Your beat is its power grid.
- **Chart:**
  - Bars 1–2: kick on beats 1 and 3, with "PRESS" hints on the first 4 cues.
  - Bars 3–4: add the snare backbeat.
  - Bars 5–8: the NEON DRIVE syncopated kick.
- **Objectives:** ★ clear at 60% · **"Light every district"** (each bar with no miss lights one district of buildings) · "8-hit combo".
- **Feedback:** hits light windows near your performer. A full bar with no miss → a district's ambient windows switch on (V2.1 switch-on moment). A clear → the city fully awake, the hook kicks in, and the crowd cheers.
- **Reward:** NEON DRIVE in Sandbox, plus 100 XP.

### B. FUNK MASTER *(NEON DRIVE main + variation · ~45 s · 3 pads: kick / snare / hat)*
- **Skill:** syncopation and ghost notes. Ghost-note cues are dim cells that score as GOOD minimum and give bonus points for PERFECT.
- **Twist, the "Your Fill" break:** for 1 bar, there are no cues. The player improvises a fill. It's scored by **groove rules**, not timing targets:
  - presses are quantized and must land on the 16th grid (±70 ms);
  - 3–8 presses;
  - at least one on an offbeat;
  - more than 8 presses = "too busy" (0 bonus).
  
  The fill is then **played back by the city** and saved as a Sandbox variation.
- **Objectives:** "Hit 6 offbeat kicks PERFECT" · "16-combo through the variation" · "Fill with 3+ offbeats".
- **Reward:** the "warm" lead sound + the Warm Neon mood, + 200 XP.

### C. BOSS BATTLE *(BOSS RUSH · ~60 s · 4 pads)*
- **Story:** the **STATIC**, a glitch storm, is jamming the city.
- **Mechanic: call and response.** The boss plays a 1-bar drum phrase (heard, and shown as glowing cells). The player **repeats it** in the next bar. 8bitcn **Enemy Health Display** for the boss, **Health Bar** for the player.
  - Each PERFECT/GREAT hit damages the boss.
  - Each MISS or STRAY damages the player.
  - The phrase difficulty climbs: phases 1–3 (straight 8ths → syncopation → double-time drop).
- **Phases** follow the arrangement: main → dominant build (boss "charges": phrases get longer) → drop (final phase, double time).
- **Win:** boss HP 0 → the A7 → Dm resolution plays, and the whole city celebrates (all four performers + the BIT sign). **Lose:** retry from the last phase checkpoint, with the music continuing seamlessly.
- **Reward:** the BOSS RUSH kit, the Red Alert mood, the "hero" lead + 400 XP.

## 5. Progression and unlocks

| Rank | XP | Unlocks |
|---|---|---|
| ROOKIE | 0 | NEON DRIVE (after Wake the City), Sandbox, SUBTLE mutation |
| BEATMAKER | 300 | PIXEL QUEST, PLAYFUL mutation, save slots 1–4 |
| GROOVE PILOT | 900 | NIGHT SHIFT, Funk Master, WAV download |
| NIGHT HERO | 2000 | Boss Battle, WILD mutation, save slots 5–8 |
| CITY LEGEND | 4000 | BOSS RUSH in Sandbox, all moods, performer outfits |

- The rank badge uses an 8bitcn **Badge**, and XP fills an 8bitcn **XP Bar** on the results card.
- Unlocks are cosmetic or creative. Core music-making is **never** paywalled or gated beyond the first tutorial.
- Stored in `localStorage` with a schema version. A "reset progress" option lives in settings.

## 6. Player feedback

| Moment | Visual | Audio | Text (live region) |
|---|---|---|---|
| Hit | Pad flash + the matching **performer reacts** + judgement pop (PERFECT/GREAT/GOOD) above the playhead lamp | The real drum sound (the player *is* the drummer) | none (would flood) |
| Miss / stray | The cue cell dims, small "×", combo resets | **No error buzz.** The music keeps flowing. | none |
| Combo milestones 8/16/32 | Ambient windows step up a level, the crowd raises hands | Subtle open-hat flourish | "Combo 16" (polite) |
| Section clear | District lights up (switch-on sweep) | none | "District lit" |
| Results | Score count-up, stars, XP Bar fill, unlock card | Resolution chord | Full summary announced |

## 7. Difficulty curve
- **Per challenge:** EASY (half the cues, Assist windows) · NORMAL · HARD (adds ghost notes and fills, tighter windows: ±25/50/90 ms).
- **Across challenges:** Wake the City (2 pads, quarter notes) → Funk Master (3 pads, syncopation, ghost notes) → Boss Battle (4 pads, memorise-and-repeat, double time).
- **Guarantees:**
  - The first 4 cues of any first attempt are hinted.
  - The first challenge can be cleared at 60% on EASY by a first-time player [A: validate in playtest].

## 8. Replayability
- Stars and personal best per difficulty.
- A **daily mutation:** the date seeds a PLAYFUL mutation of a kit, so the challenge is fresh daily, locally, with no backend.
- **Ghost of your best:** your previous best run's hits shown as faint marks.
- Unlock-driven Sandbox variety (kits, moods, lead sounds).
- Funk Master's fill becomes a **saved Sandbox variation**: performance turns into creation.

## 9. Accessibility alternatives
| Need | Alternative |
|---|---|
| Timing difficulty, motor impairment | **Assist mode** (2× windows) · **one-button mode** (all cues on one pad; chart simplified to the kick line) · **Practice** (no fail, 75% tempo, loop any section) |
| No timed play at all | **Compose challenges:** objective-based Sandbox puzzles (e.g. "make the kick hit 3 offbeats", "build a 4-bar fill that resolves") that award the **same XP and unlocks** |
| Screen reader | Objectives and results announced. Pads are labelled buttons. During play, cues are audible (the kit) and an optional **metronome click** + "count-in" voice (1-2-3-4) is used rather than per-note announcements. |
| Low vision / colour | Cue cells use the track glyph + a brightness change (not colour alone). High-contrast cue outline option. |
| Motion sensitivity | Reduced motion: no judgement pops travelling, no screen shake, district lights switch instantly |
| Hearing | Every cue is visible. Hits show performer and pad feedback. Optional haptics (`navigator.vibrate`, Android). |
| Input | Remappable keys. Pads at least 64 px on touch. Gamepad later. |

## 10. First-time user experience (target: first sound under 5 s, first successful hit under 15 s)
1. **Land.** The city is asleep. One big **PLAY** button. The tagline reads "Make a beat. Wake the city."
2. **Press PLAY.** The NEON DRIVE intro starts and the hint appears: "Tap **KICK** (F) when the lamp reaches the glowing step."
3. **First 4 cues are hinted** (pulsing pad + "NOW"). Each hit makes the Stomper stomp and lights a window.
4. **After 30 s:** results (★, XP), **"NEON DRIVE unlocked: make it yours in Sandbox."**
5. **Sandbox opens** on the same tune. The MUTATE (PLAYFUL) button pulses once. "Every press makes a new version. UNDO anytime."
6. **Calibration** is offered after the first challenge (not before; don't block the fun).
