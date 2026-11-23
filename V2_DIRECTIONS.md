# BEAT.BIT V2 — Reactive World Directions

**Status:** ✅ APPROVED on 2026-11-23: **Direction A · Signal City Live** · Preset moods approved (lightweight palette and atmosphere variations)
**Positioning:** *A tiny pixel world that performs the beat you make.*
**Inputs:** [RESEARCH_SYNTHESIS.md](RESEARCH_SYNTHESIS.md) · [ART_DIRECTION.md](ART_DIRECTION.md) (✅ Signal City, approved V1)

> ART_DIRECTION.md isn't modified by this proposal. Whichever direction is chosen gets added as a dated **V2 amendment**, with V1 decisions kept and marked as superseded only where they actually change.

## Constraints all three directions share

- The sequencer, audio engine, scheduler, and transport stay as they are. **Visuals are driven only by scheduled step events** (`StepEvent { step, time, duration, tracks }`).
- 160×50 logical-pixel canvas, integer-scaled. Same token palette family. 8bitcn frames the scene.
- Sprites are drawn in code as pixel arrays (no image assets, no new dependencies). Frames are quantized to ~12 fps, and onsets render on the very next frame.
- Every actor has a reduced-motion variant: state changes become color or pose swaps with no travel, shake, or flicker.
- Readable at phone size (2× scale, 320 CSS px): actors are at least 8 logical px tall, with high-contrast silhouettes.
- Everything is original, with no recreation of existing games or characters.

---

## Direction A — SIGNAL CITY LIVE *(evolve V1)*

> *The city you already built gets residents, and they perform.*

**Environment.** The approved Signal City skyline, street, and lamps stay. Three additions: a power line strung between two rooftops, a small rooftop stage on the tower, and a pavement strip in front.

**Characters (4 actors, one per drum)**
| Drum | Actor | Reaction |
|---|---|---|
| **Kick** | **The Stomper**: a chunky 12px-tall street robot on the pavement | Stomps (2 frames). Dust puffs at its feet, the skyline drops 1px (V1 kept), the street flashes coral. |
| **Snare** | **Window Crew**: residents in random windows | 1–3 residents pop their heads out (2 frames), and their window lights amber (V1 kept), fading over 3 steps |
| **Hi-hat** | **Wire Birds**: 4 birds on the power line | The birds hop in turn (one hop per hat, cycling left→right), so hat density reads as a ripple. The antenna blinks teal (V1). |
| **Clap** | **Rooftop Crowd**: 5 silhouettes on the tower stage | Arms up for 1 step, and the BIT sign flickers on (V1) |

**Animation language.** Anticipation-free reactions: the hit *is* the pose. Each actor has a rest pose, a hit pose, and an optional settle frame. Movement is 1–2px. Pixel-honest and restrained, like V1, just populated.

**Visual identity.** Unchanged palette. Actors are drawn in `--ink`, with their track color as a single accent pixel group (the Stomper's coral visor, the birds' teal eyes). That keeps the "color only where sound is" rule.

**States.** Idle: the birds sleep (eyes closed), the crowd sits, the Stomper powers down, and one window blinks. Groove load: residents switch on window by window over 4 frames. Clear: blackout (the approved stretch).

**Complexity.** ★★☆ About 4 actors × 2–3 frames, roughly 1 day. It reuses all V1 scene code and the layout.

**Strengths.** Lowest risk. Keeps the approved direction and V1's craft. Each drum stays legible and gains personality.
**Weaknesses.** The least surprising, and the actors are small inside a wide skyline. The Stomper and the crowd carry the clip.

---

## Direction B — THE BIT BAND *(a stage, four performers)*

> *Four tiny robots on a club stage. You're writing their set.*

**Environment.** An intimate club stage: dark room, dithered spotlight cones, a row of crowd heads at the bottom, an amp stack, a lighting truss.

**Characters**
| Drum | Actor | Reaction |
|---|---|---|
| **Kick** | **BOOM**: a squat robot behind a bass drum | Pedal stomp (2 frames), the bass drum skin flexes, the crowd heads bob down 1px |
| **Snare** | **CRACK**: a lanky robot with sticks | Overhead strike (3 frames), a white impact spark, the amp speaker cone punches |
| **Hi-hat** | **TIK**: a tiny robot on a cymbal stand | Quick tap (2 frames), the cymbal tilts, a teal spotlight flick |
| **Clap** | **The Crowd**: front-row heads | Hands up and clapping (2 frames), violet stage wash |

**Animation language.** Characterful: anticipation on longer notes, squash and stretch at a pixel scale. Lighting cones change color per instrument, which is the main color carrier.

**Visual identity.** Warm stage lights on near-black, each spotlight in its track color. A more saturated, show-like look than V1.

**Complexity.** ★★★ 3 robots × 3–4 frames + crowd + lighting, roughly 1.5–2 days. It replaces the V1 scene art.

**Strengths.** The most literal "performs the beat". The strongest character appeal, and an instantly readable 10-second clip.
**Weaknesses.** It drops the approved Signal City. It's conceptually close to **Incredibox** (characters performing your mix), which MARKET_RESEARCH names as a competitor. That weakens differentiation (the Incredibox claims are unverified; see the synthesis §5). It's also the highest art cost.

---

## Direction C — BIT RUN *(the beat plays a level)*

> *Your beat builds the level. A tiny courier runs it, perfectly in time.*

**Environment.** A single-screen, auto-scrolling night street: parallax dithered skyline (reusing Signal City art in the background), rooftops, crates, and coins.

**Characters and mechanics**
| Drum | Element | Reaction |
|---|---|---|
| **Kick** | Crates | A crate spawns *ahead*, timed so the courier **jumps it exactly on the kick** |
| **Snare** | Brick blocks | The courier punches through a block on the snare (debris pixels) |
| **Hi-hat** | Coins | A coin is collected on every hat, with a small teal sparkle |
| **Clap** | Fireworks | A firework bursts over the skyline in violet |

**The key idea.** The scheduler already knows the pattern ahead of time, so the world can spawn obstacles **one bar early** and the courier always lands its moves on the beat. The level *is* your pattern made visible, and editing the grid visibly reshapes the upcoming level.

**Animation language.** Game-like but rule-bound. Constant run cycle (4 frames), jump arcs quantized to steps, parallax at integer speeds.

**Visual identity.** Signal City palette in the background, with the courier in ink plus a coral scarf. The most kinetic of the three.

**Complexity.** ★★★★ Run cycle, jump physics locked to steps, spawn-ahead logic that has to stay correct through tempo and pattern edits, and parallax. Roughly 2.5–3 days.

**Strengths.** The most novel and shareable ("my beat made a level"), with clear cause and effect, and it plays to the audio-clock lookahead as a technical story.
**Weaknesses.** Dense patterns (16 hats, kick on every step) get visually chaotic. Visitors may expect a score or goal, i.e. a game. Spawn-ahead logic adds sync risk when edits land within the lookahead. It needs care to avoid resembling existing platformers.

---

## Comparison

Scores run 1–5, where 5 is best.

| Criterion | A · City Live | B · Bit Band | C · Bit Run |
|---|---|---|---|
| Fits "performs the beat" | 4 | **5** | 4 |
| Per-drum legibility at phone size | 4 | **5** | 4 |
| Differentiation vs. market | 3 | 2 (Incredibox) | **5** |
| Continuity with the approved art direction and V1 code | **5** | 2 | 3 |
| Sync risk with scheduled audio | **5** (reactive only) | **5** | 3 (spawn-ahead) |
| Robust to any pattern (sparse, dense, empty) | **5** | 4 | 2 |
| Accessibility / reduced-motion ease | **5** | 4 | 3 |
| Build cost (5 = cheapest) | **4** (~1 d) | 3 (~2 d) | 2 (~3 d) |
| Clip appeal | 3 | **5** | **5** |
| **Total** | **38** | 35 | 31 |

## Recommendation

**Direction A, Signal City Live, with B's character craft applied to the Stomper and the Rooftop Crowd.** In practice that means giving those two actors more frames and more personality, so they carry the clip.

**Why.**
- It delivers "performs" without throwing away an approved, working, verified world.
- It's purely reactive, so it can't drift from the audio and it works for every pattern, including empty and dense ones.
- It's the cheapest, which leaves budget for grooves and sharing (V2.2 and V2.3), where MARKET_RESEARCH says the growth is.

**Hold C (Bit Run) as the V3 "second world".** Once URL sharing carries a scene id, it becomes a second scene a beat can be played in. That's the strongest long-term differentiator, without risking V2.

## Decisions needed
1. **Direction:** A (recommended), B, or C?
2. If A: should the Stomper live on the **pavement** (front, large, the clip anchor; recommended) or on a **rooftop** (smaller, more integrated)?
3. Should grooves bring **mood variation** (sky tint and sign text per groove, e.g. "BOSS" for the boss-fight groove)? Recommended yes: it's cheap and adds a lot.
