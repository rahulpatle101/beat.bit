# BEAT.BIT — Research Synthesis (V2)

**Date:** 2026-11-23 · **Inputs:** [MARKET_RESEARCH.md](MARKET_RESEARCH.md), [RESEARCH.md](RESEARCH.md), [BUILD_STATUS.md](BUILD_STATUS.md)
**Both source documents are preserved unchanged.** This file only interprets them.

**New positioning:** *A tiny pixel world that performs the beat you make.*

---

## 1. Where the two documents agree (high confidence)

| Theme | RESEARCH.md | MARKET_RESEARCH.md | V1 reality |
|---|---|---|---|
| The scene is the differentiator, not the grid | §8 Opportunities #2 | §5 Core differentiator | Signal City exists but is an *environment*, not a *performer* |
| One visual actor per instrument | §8 #3 | §5 table | ✅ Implemented as one layer per instrument |
| Visuals must come from scheduled audio, not a parallel loop | §6 Two Clocks | §5, §7 risk table | ✅ Verified ([B] pixel probe) |
| An accessible sequencer is a rare strength | §7, §8 #1 | §5 secondary differentiators | ✅ Mostly. D1/D2 must be fixed before claiming it. |
| Play must be one action away, with a preloaded groove | §5 | §2 expectations, §6 | ✅ |
| Avoid DAW scope | CLAUDE.md scope | §4 anti-positioning | ✅ |

## 2. What MARKET_RESEARCH adds (new to the plan)

1. **Sharing and remixing** are the growth mechanic: URL-encoded pattern + BPM, a Share button, and a "Remix this beat" flow. RESEARCH.md didn't cover this, and DESIGN §15 explicitly listed share URLs as *out of scope for Day 001*. **This is a scope change that needs approval.**
2. **Curated grooves (3–5)** to replace the single starter. DESIGN §15 listed multiple presets as out of scope, so this is another scope change.
3. **The mobile-first sharing moment:** the first share is likely opened on a phone (an assumption; see §5).
4. **Success metrics:** Play within 15 s, share rate, remix rate. These need analytics, which V1 doesn't have.

## 3. Implications

### Product
- The core loop grows from *make → watch* to **make → watch → share → remix**.
- The link must reproduce the **performance**, not just the pattern. Since the world is deterministic given pattern + BPM (+ scene), a link *is* a replayable performance. Recorded video/GIF export is a different, much larger feature, so it's deferred.
- Grooves serve two jobs: an instant reward, and a showcase that each one makes the world perform differently.
- Keep one kit and one world for V2. The URL should carry a version field so kits and scenes can be added later without breaking old links.

### Creative
- "Performs" implies **characters with agency**, not only lighting changes. V1's city reacts but nobody *performs*.
- Each instrument needs a *recognizable actor* that a viewer can learn in one loop (kick = the big one, hat = the small fast one).
- Grooves are a chance for **mood variation** (palette or sky per groove) without building new scenes.
- The 10-second clip is the marketing unit. The world must read at phone size, which favors few, large, high-contrast actors over many small details.

### Interaction
- A shared link needs a **landing state**: "Someone made this beat → Play / Remix / Make your own" (MARKET §6.4).
- "Remix" should be zero-friction. Editing a shared beat *is* remixing; the Share button then produces a new link.
- The groove picker must not compete with Play for attention. It's a secondary control.
- Sharing uses the Web Share API on mobile and copy-link with confirmation on desktop.

### Engineering
- **URL codec:** 64 steps = 64 bits, so 16 hex characters plus BPM and a version. Pure functions, unit-tested, strict validation of untrusted input. No server.
- **No backend:** static hosting covers everything in V2. **Per-beat Open Graph images can't be generated on static hosting.** Only a single static OG image is feasible without a server or edge function.
- **Scene architecture:** characters need sprite frames and per-actor state. Consolidate to a single render loop (BUILD_STATUS D8) before adding actors.
- **Performance budget:** the scene stays a 160×50 canvas. Adding sprites is cheap, but each actor's state must be O(1) per frame.
- **Analytics:** any metric collection is a privacy and scope decision. It's not assumed in V2.

## 4. Conflicts and tensions

| Tension | Resolution proposed |
|---|---|
| DESIGN §15 put presets and share URLs out of scope; MARKET puts them in Phase 1 | Treat as an explicit **scope amendment** in the V2 roadmap, for approval |
| MARKET suggests encoding "kit and scene settings"; V1 has one of each | Version the URL format now, encode only what exists |
| MARKET Phase 1 lists an "Open Graph preview image or animated preview" | Static OG image only (no server). Animated previews are deferred. |
| "Share the performance, not just the pattern" vs. URL sharing | The link replays the deterministic performance. Video export is deferred. |
| Positioning favors characters; the approved art direction is an environment (Signal City) | Evolve, don't replace. See V2_DIRECTIONS.md. |
| Primary metrics need analytics; the project has no analytics or privacy policy | Defer metrics, or use privacy-friendly aggregate analytics with approval |

## 5. Unverified claims in MARKET_RESEARCH.md

MARKET_RESEARCH.md defines evidence tags ([V]/[R]/[A]) but **doesn't apply them to individual claims**, and nothing in it was verified in this session. Treat the following as unverified until checked.

| Claim | Type | Decision risk if wrong |
|---|---|---|
| Competitor feature sets: Orbeat (probability, polymeter, WAV/MIDI), Sprunki (permanent URLs, video, stems), SEQ-16 (AI generation, cloud), ButtonBass (recording/export), Beatbay (rolls, live pads), RockBlocks (rhythm tiles) | Reported, untagged | Low. It informs positioning, not the build. |
| Incredibox: characters + shareable mixes | Reported | **Medium.** It bears on how close a "character band" concept sits to Incredibox (Direction B). Verify before choosing B. |
| Song Maker: zero-login link sharing | [R] in RESEARCH.md (Google blog) | Low |
| "An accessible step sequencer is rare" | One academic source (NYU, [R]) plus inference | Medium. Don't overclaim in public copy; say "keyboard- and screen-reader-operable" instead. |
| "The first shareable moment will often occur on mobile" | Assumption | Medium. It drives mobile priority. Plausible but unmeasured. |
| Market map placements | Judgment | Low |
| Metrics targets and growth effects of remixing | Assumption | Low for the build. Can't be validated without analytics. |
| The Orbeat App Store listing id and the specific URLs | Unchecked links | Low. Check before citing publicly. |

**RESEARCH.md** claims keep their existing [V]/[R]/[A] tags. BUILD_STATUS.md has since **verified** these earlier [A] items: lookahead timing accuracy, the rAF note-queue sync, and the Vite + 8bitcn compatibility (with the Slider import patch).

## 6. Synthesis in one line

Keep the instrument and the clock exactly as they are. Spend V2 making the world *perform* (characters), giving people *good beats to start from*, and making every beat a *link someone else can play and remix*. Fix the accessibility defects first, so the "accessible" claim is true.
