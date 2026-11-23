# BEAT.BIT — Build Status (V1 Audit)

**Audited:** 2026-11-23 · **Commit:** `97252ff` (main) · **Auditor:** Claude, with automated checks
**Scope:** The implementation as shipped. The audit (§1–§8) records findings at `97252ff`. Later phases are logged in the **Phase log** directly below.

## Phase log

### Phase 0 — Stabilization (2026-11-23)

| Defect | Change | Verification | Result |
|---|---|---|---|
| **D1** Invisible focus on 8bitcn Button/Slider | Local patches: square 2px `--ink` outline, offset 8px on Button (outside the pixel frame) and 4px on the Slider thumb. Comments in both files. | [B] Real Tab presses: PLAY, Tempo, GROOVE → `:focus-visible`, `outline: solid 2px`. Screenshots show the ring. | ✅ Fixed |
| **D2** Off-step contrast 1.16:1 | New token `--cell-edge: #646872`, a 2px inset edge on off steps (on steps use the track color, hover uses `--ink-dim`) | [C] 3.07:1 against `--panel`. [B] Screenshot. | ✅ Fixed |
| **D3** Silent-mode clock mismatch | `trigger` is gated to the audio clock. A late `running` state during silent playback restarts the loop on the audio clock and announces "Sound started…". | [R] Code review. [B] The blocked/silent path still works (badge, notice, playhead). **Not reproducible in Chrome:** a later trusted click doesn't complete a pending `resume()`, so the late-unlock branch is untested. | ✅ Fixed (branch unexercised) |
| **D4** Stop button corner artifacts | Stop uses the `outline` variant with a solid `--cell` fill instead of `secondary` | [B] Screenshot while playing | ✅ Fixed |
| **D7** Template leftovers | Pixel favicon (four track-color squares). Unused `public/icons.svg` removed. | [R] No references remain | ✅ Fixed |
| **D8** Two render loops | One rAF loop in `useSequencer`: step events, then `onFrame` renderers. Step listeners receive the frame timestamp, so scene event times share the draw timebase. | [B] Canvas probe: skyline drop on **exactly** kick steps 0/6/8/13 (the one-frame spillover is gone) | ✅ Fixed |
| D5 Mobile cell size | Deferred to V2.4, as planned | — | Open |
| D6 1× narrow scene | Accepted (documented limitation) | — | Accepted |

**Regression checks after Phase 0** [B][T]:
- 8/8 unit tests pass.
- 104 BPM: mean 144.11 ms vs 144.23, steps in order.
- 104→180 mid-play: 83.48 ms vs 83.33.
- 21 rapid clicks from playing: stopped, 0 steps after, 0 lit.
- Keyboard: one tabbable cell, ↓ moves to "Snare, step 1".
- Reduced motion: no skyline drop.
- No console errors.

### V2.1 — Signal City Live (2026-11-23)

**Commits:** `4cc7a25` (approved docs) · `a11d9b3` (performers + transport moments) · `e8c715b` (cues, audition performs, scene description). All pushed to `origin/main`.

**Implemented** (per ART_DIRECTION / DESIGN → V2.1 amendments)
- Four performers on the approved coordinates and sprites: Stomper (kick), Resident (snare), Wire Birds (hi-hat), Rooftop Crowd (clap). They're dark rim-lit silhouettes that brighten only on hits. The crowd stays dark with violet hands.
- Motion personalities as pure timing functions (`src/scene/performers.ts`), driven only by heard step and audition events.
- C2: snare = resident + 3 small windows. C3: 8 ambient windows at 30% while playing. C7: apartment windows merged from 2×2 V1 window blocks, plus the power line. No building moved.
- Moments: switch-on (Play), power-down (Stop), blackout (Clear while playing) with lights returning on the first new note, ripple (Groove while playing), plus reduced-motion variants.
- Audition performs: a step toggled on while stopped triggers its sound and performer once. Playback doesn't start.
- A static, visually-hidden scene description. The canvas stays `aria-hidden`, with no per-animation announcements.
- Engine, scheduler, sequencer grid, transport controls, and 8bitcn components are unchanged, apart from the two new hook channels (`onCue`, `onAudition`).

**Verification (DESIGN V6)**

| Check | Method | Result |
|---|---|---|
| Each performer reacts only on its drum | [B] Per-frame canvas probes of signature pixels over 2+ bars of SIGNAL | ✅ kick 0,6,8,13 · snare 4,12 · hi-hat 0,2,4,6,8,10,12,14,15 · clap 12,15. Identical at 104 BPM, 180 BPM, and reduced motion. |
| Reaction lands on the heard step | [B] Frames between the grid playhead change and the performer onset | ✅ 0 frames (100% of onsets) |
| Motion personalities | [T] Timing table at 104/180 BPM. [B] Pose sequences in the composition preview and the live probes. | ✅ Kick 94→43 ms, snare cheer 58 ms, hi-hat hop 50 ms (the shortest), clap half→full→half with a 36 ms stagger (at 104 BPM) |
| No stuck poses | [T] 60/104/180 BPM. [B] 21 rapid Play/Stop clicks → idle visor, nothing lit. | ✅ |
| Quiet crowd | [B] Ink pixels in the crowd region during claps | ✅ The crowd never turns ink. (One ink pixel came from a star at (46, 9) twinkling on hi-hat; it's 0 with reduced motion, where twinkle is off.) |
| Switch-on / power-down | [B] Ambient window and visor probes | ✅ 167 ms, left→right / 107 ms. Reduced motion: instant. |
| Blackout + return | [B] | ✅ All ambient off in 192 ms, sign dark, transport and lamps continue. Lights return 108 ms after the first new note. Reduced motion: instant. |
| Ripple | [B] | ✅ Bright ambient flash on Groove while playing. None with reduced motion. |
| Audition performs | [B] Toggle a kick and a clap step on while stopped | ✅ The performer reacts ~53 ms after the click (when the sound plays) and returns to idle. Playback not started. Toggling off doesn't perform. |
| Reduced motion translation | [B] | ✅ No Stomper squash (0 frames), no bird eye-row change, no skyline drop |
| Regression (Phase 0 suite) | [B][T] | ✅ 104 BPM 144.3 ms (exp 144.23), 180 BPM 83.13 ms (exp 83.33), steps in order. Focus ring on PLAY/Tempo/GROOVE/CLEAR/grid via real Tab presses. Grid keyboard. 19/19 unit tests. No console errors. |
| Legibility | [B] Screenshots at desktop 6× and an emulated phone (375 px @ 2× DPR) | ✅ Integer device-pixel scale, no artifacts. Birds and crowd small but distinct on phone. **Awaiting your visual review.** |
| Recording | [B] DevTools screencast → ffmpeg | ✅ 17 s silent video (headless Chrome can't capture audio) |

**Bundle:** JS 318 KB (103 KB gzip), up from 309 KB (+9 KB) for V2.1.

**Remaining issues after V2.1**

| # | Severity | Issue | Note |
|---|---|---|---|
| V1 | Low (visual) | The resident's 6×6 cheer pose still reads partly as a cup shape | Approved for tuning. The reaction reads in context (light + silhouette change). Your call at review. |
| V2 | Low (visual) | Birds and crowd are ~8 CSS px on phones and read through motion and accents rather than shape | Accepted in the composition decision (no enlarging) |
| V3 | Info | The clap stagger (36 ms) is nearly invisible at phone size | Intended ("restrained") |
| V4 | Info | Audition visuals trail the click by ~50 ms: the audio unlock + 5 ms schedule + output latency | By design: visuals follow the heard sound |
| D3 | Low | The late-unlock branch is still unexercised in Chrome | Unchanged since Phase 0 |
| D5 | Low | Mobile grid cells ~34 px at 375 px | Scheduled for V2.4 |
| — | [—] | Not verified: real iOS/Android devices, VoiceOver, human listening test | Needs you or a device |



### V2.2 — Playfulness: Curated Grooves + Remix Dice (2026-11-23)

**Commit:** `ba05c2b` (pushed). **Spec:** DESIGN.md → V2.2 (decisions P1–P6, Remix rules, acceptance) · ART_DIRECTION.md → V2.2 mood addendum.

**Implemented**
- **Grooves:** SIGNAL (starter) + BOOM BAP 90 · TECHNO 128 · BOSS FIGHT 150, each with a subtle sky mood. The picker is an 8bitcn **Toggle Group**, added with the shadcn CLI (the prompt to overwrite our patched `retro.css` was declined) and patched locally: `radix-ui` types, className order, focus ring, and selected fill. No new npm dependencies.
- **Remix Dice** (`src/data/remix.ts`, pure): 2–4 musical changes, at least one audible; anchors, caps, and a drift limit of 8; never empties a track; an empty pattern gets a backbone.
- **Undo:** 30-step history for remix, clear, and groove change. Disabled when empty.
- **Feedback:** a grid roll ring on the changed cells, a rolling pixel die on REMIX, a 3-frame window "dice tumble", and live announcements. Reduced-motion variants for all of them.
- **First 5 seconds:** a header tagline and updated hint copy.

**Verification**

| Check | Method | Result |
|---|---|---|
| Remix invariants | [T] 2,000 single rolls + 9,600 chained rolls (4 grooves × 60 seeds × 40) | ✅ 2–4 changes, ≥1 audible, anchors kept, drift ≤ 8, caps held, no track emptied, pure + deterministic. Two bugs found and fixed during the build: drift-control reverts could empty a track or exceed a cap. |
| Preset switching mid-play | [B] Cadence after each switch | ✅ BOOM BAP 166.7 ms (exp 166.7) · TECHNO 117.6 (117.2) · BOSS FIGHT 99.9 (100) · SIGNAL 143.7 (144.2). Steps in order across a switch. Picker, readout, sky mood, and announcement updated. |
| Repeated remix during playback | [B] 25 rolls, 200 ms apart, at 90 BPM | ✅ All 2–4 changes, anchors kept, max drift 8, cadence 166.7 ms in order (unchanged), die = roll size, "EDITED" shown |
| Undo | [B] | ✅ 25 remixes undone in exact reverse order. Groove switch undone (groove, BPM, mood). Clear undone. Then disabled. |
| Remix feedback | [B] 12 spaced rolls | ✅ Every changed cell is highlighted with the right kind (on/off), and highlights clear afterwards. City tumble: 24 amber px at peak vs 4 baseline. The die shows 5 faces while tumbling. |
| Reduced motion | [B] Emulated | ✅ Static ring (`animation: none`), no city tumble (4 = baseline), die jumps straight to the result |
| Keyboard | [B] Real Tab, arrow, and Enter presses | ✅ PLAY → Tempo → picker (1 stop) → REMIX → (UNDO skipped while disabled) → CLEAR → grid, all with a 2px focus ring. → → Enter loads TECHNO and is announced. Enter on REMIX rolls. |
| Mobile | [B] 375 px @ 2× DPR | ✅ No horizontal overflow. Picker buttons 40 px tall; grooves wrap 2×2. |
| V2.1 regression | [B] Performer probe + regression suite | ✅ Performers on the same steps with 0-frame lag. 144.47 / 83.2 ms at 104 / 180 BPM. No stuck poses. Grid keyboard and scene description intact. |
| Unit tests | [T] | ✅ 25/25 |
| Demo recording | [B] Screencast → ffmpeg | ✅ 21.6 s, silent (headless Chrome can't capture audio) |

**Bundle:** JS 338 KB (109 KB gzip), up from 318 KB in V2.1 (+20 KB: Toggle Group, remix, grooves).

**Remaining issues after V2.2**

| # | Severity | Issue |
|---|---|---|
| G1 | **Needs you** | The three new grooves and remix variations haven't been heard by a human. The step patterns are musically conventional, but the synthesized kit and the pattern choices need your ears. |
| G2 | Low (layout) | On phones the action row wraps (REMIX + UNDO, then CLEAR alone). Functional, but slightly untidy. |
| G3 | Info | Mood tints are deliberately subtle. On some displays the warm and red skies may read very close to night. |
| G4 | Info | The remix origin resets on any manual edit, so after hand edits the "identity" is your edited pattern, not the preset. This is intended; it's noted here for review. |
| V1 | Low | Resident cheer pose (carried over from V2.1) |
| D5 | Low | Mobile grid cells ~34 px at 375 px (V2.4) |
| — | [—] | Not verified: real devices, VoiceOver, human listening |


### V2.3a — BIT LEAD synth + melody generator (2026-11-23)

**Spec:** V2_3_MELODY_PROPOSAL.md (approved) · DESIGN.md → V2.3a · ART_DIRECTION.md → V2.3 addendum. **Scope:** synth, generator, scheduling, and temporary review controls only.

**Verification**

| Check | Method | Result |
|---|---|---|
| Generator rules | [T] 4 grooves × 500 seeds | ✅ In scale, density band, intervals ≤ 3 degrees (octave allowed), ≤ 2 consecutive leaps, resolves to the root, A/A′/A″ share a rhythm, deterministic, ≥ 25 distinct melodies per 50 seeds, leaves room on kick+snare steps. One bug found during the build: the root resolution could create a third leap. Fixed with validated seeded retries. |
| Synth | [T] | ✅ 25% pulse Fourier coefficients (4th harmonic = 0), envelope ordered and within step + 40 ms release at 60/104/150/180 BPM, A4 = 440 Hz |
| Melody timing | [T] Scheduler | ✅ Notes carry exactly the drums' step timestamps (0 / 0.5 / 1.625 s at 120 BPM), off → no notes while drums continue |
| **Real audio onsets** | [B] Dev harness: AnalyserNode on the real engine's master chain | ✅ 15/15 scheduled lead notes detected as sound. Onset lag 5.1–13 ms (mean 9.9), which is the measurement resolution (5.8 ms analyser window + 2–4 ms polling). |
| Stop / rapid Play-Stop | [B] Same harness | ✅ Output RMS = 0 at 120 ms and 520 ms after Stop, and 0 after 21 rapid toggles: no hanging notes |
| **Offline render (export readiness)** | [B] `OfflineAudioContext` + `createMasterChain` + real voices | ✅ All 4 grooves: drums + lead peak 0.66–0.71 (no clipping), lead alone peak 0.26–0.31, 35–51 ms per bar to render. The engine's voices and chain can be reused for export. |
| App wiring | [B] Output tap injected into the production build | ✅ Melody off by default (#0421). Drums cleared + melody off → RMS 0. On → 0.133. Off again → 0. NEW MELODY #0421→#1168, Undo → #0421. BOOM BAP → curated #0090 with the melody still on. Stop → 0. |
| V2.1/V2.2 regression | [B] Performer probe + regression suite | ✅ Unchanged (same steps, 0-frame lag, 144.43 / 83.26 ms, no stuck poses). First Play is identical with the melody off. |
| Keyboard / focus / mobile | [B] Real Tab + Enter; 375 px @ 2× | ✅ CLEAR → MELODY (`aria-pressed`) → NEW MELODY → grid, all with focus rings. Enter toggles and announces. No overflow. |
| Unit tests | [T] | ✅ 37/37 |
| Listening artifacts | [B] Offline render → 16-bit WAV | ✅ 4-bar WAV per groove with its curated melody (the recording can't capture audio) |

**Bundle:** JS 344.8 KB (111.2 KB gzip), +6.4 KB vs V2.2. The dev harness isn't in the production build (`dist/` holds only `index.html` + assets).

**Remaining issues after V2.3a**

| # | Severity | Issue |
|---|---|---|
| M1 | **Needs you** | The melodies and the lead's tone haven't been heard by a human. Curated seeds (421/90/128/150) were chosen by rule, not by ear. |
| M2 | Info | Temporary review controls (MELODY / NEW MELODY) will be replaced by the Pitch Grid editor in V2.3b |
| M3 | Info | Clear doesn't clear the melody yet (decide with the editor) |
| M4 | Info | The melody has no city visual yet (tower light planned for V2.3b) |
| M5 | Info | The lead releases 40 ms past the next step's onset (by design, a short overlap). It's monophonic in practice. |


### V2.3b — Music & game reset: planning + audio previews (2026-11-23, ⏳ awaiting review)

**Scope:** planning only. **No app changes.** The production bundle is unchanged (344.80 KB) and the dev preview code isn't in `dist/`.

| Deliverable | Where | Verification |
|---|---|---|
| 4 composed kits (NEON DRIVE, PIXEL QUEST, NIGHT SHIFT, BOSS RUSH) as score data | `src/dev/music/kits.ts` | [T] Music-theory lint, 8 tests: key, semitone approach notes (across barlines and sections), range, structure. It caught 4 composition slips while writing (all fixed). |
| Prototype instruments (velocity drums, open hat/crash/toms, 4 bass, 4 chord, 5 lead presets, delay + reverb sends) | `src/dev/music/synths.ts` | All `BaseAudioContext`, fixed stop times |
| 4 audio previews (WAV + MP3, ~26–34 s, intro → main → variation → drop → end) | Scratchpad (paths in the review message) | [B] Offline render through `createMasterChain`: 0 clipped samples (peaks 0.78–0.93), tails −93 to −106 dB, stem balance within targets. Section loudness in MUSIC_DIRECTION §4. |
| MUSIC_DIRECTION.md · GAME_DESIGN.md · V2_ROADMAP Part 5 (V3.0 Playable Slice + acceptance criteria) | repo root | — |

**Open:** your listening review of the four kits (the key gate). Drops are only 0.5–1.3 dB louder than main sections (the lift is arrangement-driven; a sidechain pump is the proposed fix). Decisions are listed in V2_ROADMAP Part 5.


### V3.0 — Playable Slice (2026-11-24, ✅ built, ⏳ awaiting your review)

**Commits:** `7012f39` kit engine · `5ecd6b8` kits in Sandbox · `91da480` Arcade: Wake the City · (this commit) FTUE + docs. **Decisions** were taken as recommended on "continue" (V2_ROADMAP Part 5).

| Check | Method | Result |
|---|---|---|
| App sound = approved previews | [B] Offline render via the shared kit player | ✅ Every section within 0.1 dB. Peaks 0.74–0.92. 0 clipped. Tails < −92 dB. |
| Sandbox on kits | [B] | ✅ Performers on the NEON DRIVE grid steps with 0-frame lag. Backing audible with drums cleared. 112 BPM 133.3 ms (exp 133.9). Kit switch while playing + Undo. Silence after Stop. |
| Judge / scoring logic | [T] 12 arcade tests | ✅ Windows, Assist ×2, chart rules, perfect run = max score, mash < 25% accuracy, debounce, miss sweep, strays, live vs final accuracy, ranks, XP cap, corrupt storage |
| On-time run | [B] Scripted presses at cue times | ✅ 62/62 PERFECT, ★★★, 19,500 (= max bound), press offsets 0–4.5 ms |
| +50 ms run | [B] | ✅ All GREAT, ★ |
| Mash run | [B] F/J ~8 per beat | ✅ 783 strays, 4% accuracy, 0 stars, 0 XP |
| Persistence / anti-farming | [B] Reload in one session; replay | ✅ XP, best stars, and "PLAY AGAIN" persist. Replay at or below the best tier → 20% XP. |
| Keyboard / a11y | [B] | ✅ Focus ring on every control (Tab sweep). Enter starts. Esc quits. Results heading focused + summary announced. |
| Mobile / reduced motion | [B] 375 px @ 2× | ✅ No overflow. Pads 80 px. Cue pulse off with reduced motion. |
| Regression | [B][T] | ✅ 180 BPM 83.32 ms, rapid Play/Stop, grid keyboard, scene description. 60/60 tests. |
| Demo recording | [B] | ✅ 37.8 s silent screencast of a human-like run (53P · 6G · 3M) |

**Bundle:** JS 381 KB (122 KB gzip). The DEV-only `__arcade` handle is confirmed absent from `dist/`.

**Remaining issues**

| # | Severity | Issue |
|---|---|---|
| A1 | **Needs you** | Nobody has listened yet: the kits in the app, and how the challenge *feels* with real hands, speakers, and latency |
| A2 | Medium (feel) | District reward is subtle (8 small ambient windows). It needs a bigger "city wakes" payoff. |
| A3 | Medium | No calibration screen yet. Judging relies on `getOutputTimestamp()` / output latency only. Bluetooth audio will feel late. |
| A4 | Low | Esc quits (no pause). Stray presses are silent. NEON DRIVE isn't gated behind the tutorial. Two primary buttons on the first screen (WAKE THE CITY and PLAY). |
| A5 | Low | The test scripts assumed button order (fixed). The dev-server background wrapper sometimes reports failure while Vite runs. |
| — | [—] | Not verified: real devices, VoiceOver, human playtest of the difficulty curve |

## How findings were verified

| Tag | Meaning |
|---|---|
| **[T]** | Unit test (`pnpm test`, vitest) |
| **[B]** | Driven in real Chrome (headless, over the DevTools protocol): clicks, key presses, DOM/canvas reads, screenshots |
| **[C]** | Computed (e.g. WCAG contrast ratios from the token hex values) |
| **[R]** | Code review only: reasoned, not reproduced |
| **[—]** | Not verified. It needs a human or a real device. |

---

## 1. Summary

| Area | Status |
|---|---|
| Sequencer (4×16, edit while playing) | ✅ Working |
| Audio engine and scheduler | ✅ Working (timing verified). ⚠️ Sound quality not yet heard by a human. |
| Transport (Play/Stop, BPM, Groove, Clear) | ✅ Working |
| Reactive scene (Signal City) | ✅ Working and synced to scheduled notes → **V2.1 Signal City Live: performers + moments ✅ (see Phase log)** |
| Autoplay / blocked / tab-hidden handling | ✅ Working |
| Responsive layout | ✅ No overflow 320–1280px. ⚠️ Mobile cells below the 36px target |
| Accessibility | ⚠️ **Two WCAG failures** (focus visibility, non-text contrast). VoiceOver untested. → **Both fixed in Phase 0.** VoiceOver still untested. |
| 8bitcn integration | ✅ Six real components in use, two patched locally |
| Publishing (README, deploy, recording, post) | ❌ Not started |

---

## 2. Verified working features

| Feature | Evidence |
|---|---|
| 64 steps toggle by mouse (on press), touch (on tap), and keyboard (Space/Enter) and keep their state | [B] `aria-pressed` flips. Pattern state persists across play/stop. |
| Starter groove "SIGNAL" @ 104 BPM loads on first visit, and Groove reloads it | [B] Screenshots |
| Steps play in order 1→16 at the correct tempo | [B] 28 steps observed, mean 144.15 ms vs 144.23 expected. [T] Bar timing at 120 BPM. |
| Tempo change mid-play applies from the next step with no skips or doubles | [B] 104→180: mean 83.43 ms vs 83.33, 0 skips. [T] 120→60 test. |
| Repeated or rapid Play never layers loops | [B] 21 rapid clicks leave 1 playhead column with a clean cadence. [T] Idempotent `start()`. |
| Stop silences and clears pending visuals | [B] 0 step events after Stop, 0 lit columns. [T] Queue cleared. |
| Edits during playback land on the next pass | [T] |
| Stalled timer skips missed steps rather than bursting | [T] |
| Audio starts only after a real user gesture | [B] A trusted click leads to `AUDIO ON` |
| Blocked audio, so silent mode with a visible notice | [B] An untrusted click with no autoplay permission gives the `AUDIO BLOCKED` badge, the Alert, a moving playhead, and the announcement "Sound is blocked. Playing silently…" |
| Tab hidden while playing, so auto-stop | [B] Label returns to PLAY, announcement "Stopped: tab hidden", playhead cleared |
| Audition on toggle-on while stopped | [R] Code path present. [—] Not heard. |
| Playhead and grid hit flash driven by scheduled notes, not React renders | [B] Class changes per step. [R] No per-step React state. |
| Scene reacts per instrument, only on real notes | [B] Canvas pixel probe: the skyline dropped **only** on kick steps 0/6/8/13 (after a fix to the drop length). Screenshot at step 13 shows lamp 13, the BIT sign, amber windows, and the teal antenna. |
| Reduced motion | [B] With emulated `prefers-reduced-motion`, there is no skyline drop. [R] Flicker, twinkle, and glow decay are disabled in code and CSS. |
| Scene integer scaling | [B] 960×300 at 1× desktop. Fills the width at 2× density. |
| Keyboard model | [B] Tab order: PLAY → Tempo → GROOVE → CLEAR → grid (1 stop). → moves to "Kick, step 2". Exactly one tabbable cell. |
| Accessible names | [B] Cells "Kick, step 1, beat 1" + pressed state. Slider `aria-label="Tempo"`, `aria-valuetext="104 beats per minute"`. Landmarks: banner, main, contentinfo, status. |
| Responsive layout | [B] No horizontal overflow at 320 / 375 / 390 / 768 / 1280px. Mobile uses the two 8-step blocks. |
| Fonts self-hosted, no third-party requests | [B] No `fonts.googleapis` reference in the build |
| No console errors or exceptions | [B] Every driven session logged none |

## 3. Defects

| # | Severity | Defect | Evidence | Proposed fix |
|---|---|---|---|---|
| **D1** | **High** (WCAG 2.4.7) | **8bitcn Button and Slider have no visible keyboard focus.** The slider thumb ships `focus-visible:outline-none ring-0`, and the Button's shadcn ring is effectively invisible against the pixel border. | [B] Real Tab presses: `:focus-visible` matched, but the screenshot is unchanged on Tempo and near-unchanged on PLAY | Add a 2px `--ink` square outline + offset to the 8bit Button/Slider thumb (local patch, documented) |
| **D2** | **Medium** (WCAG 1.4.11) | **Empty step cells are 1.16:1 (alt 1.08:1) against the panel.** Their boundaries rely on the bevel shadow. | [C] | Add a 1px `--ink-dim`-derived inner border or lighten `--cell` until boundaries reach 3:1 |
| D3 | Low | **Silent-mode clock mismatch.** If `resume()` resolves *after* the 300 ms timeout, the context becomes running while the transport uses the fallback clock. `trigger()` would then schedule notes at `performance.now()` times (far in the future), so the nodes stay pending until Stop and the badge says AUDIO ON while it's silent. | [R] Not reproduced | Gate `trigger` on the run's clock mode. On a late unlock, either restart on the audio clock or stay silent until Stop. |
| D4 | Low | The Stop state uses the 8bitcn `secondary` Button, whose shadow spans render as dark corner pixels | [B] Screenshot | Use the outline variant with an inverted fill, or patch the decorations |
| D5 | Low | Mobile cells are about 34px at 375px and 28px at 320px, below the DESIGN §4.3 target of 36px (but ≥ the WCAG 24px minimum) | [B] Measured | Reduce card padding or label column, and test on devices |
| D6 | Low | On 1× screens narrower than 320 CSS px the scene renders at 160×50 (crisp but small) | [B] | Accept, or allow a 1.5× device scale |
| D7 | Low | Vite template leftovers: `public/favicon.svg` (Vite logo), `public/icons.svg` (unused) | [R] | Pixel favicon, delete the unused file |
| D8 | Info | The playhead/grid and the scene run on **two separate rAF loops**, which can show a one-frame skew between grid and scene | [B] Observed once (since mitigated) | Single render loop that fans out to subscribers |

## 4. Missing vs. CLAUDE.md / DESIGN.md

| Item | Source | Status |
|---|---|---|
| README (run commands, stack, design choices, limitations, 8bitcn list) | CLAUDE.md acceptance | ❌ |
| Deployment and live link | CLAUDE.md publication | ❌ |
| Screen recording, screenshots, build log, X post | CLAUDE.md publication | ❌ |
| VoiceOver / screen-reader pass | DESIGN §14 | [—] Not done |
| Real-device mobile test (iOS Safari silent switch, Android) | DESIGN §14 | [—] Not done |
| Human listening test of the four voices | DESIGN §14 | [—] Pending (asked; no answer yet) |
| Contrast sign-off | DESIGN §10 | Partial. See D2 and §6. |
| Stretch: warm-up / blackout, global shortcuts, Clear undo toast | DESIGN §9.3, §11 | Not started (optional) |
| Debounced BPM announcement | DESIGN §7.3 | Not implemented. The slider's own `aria-valuetext` announces changes, so this may be unnecessary. Decide during the VoiceOver pass. |

## 5. Technical debt

| Item | Impact | Note |
|---|---|---|
| Tests cover only the scheduler (8 tests) | Medium | No tests for the reducer, the URL codec (future), or the scene event mapping. Audio voices can't be meaningfully unit-tested. |
| Two rAF loops (D8) | Low | Consolidate when adding scene characters |
| Unused: `src/components/ui/slider.tsx` (the 8bit slider uses Radix directly), dependency `lucide-react` (0 occurrences in the bundle), `@import "tw-animate-css"` (no animate utilities used) | Low | Remove. Lucide isn't bundled, so the cost is install size only. |
| `shadcn` is a runtime dependency | Info | Required for `@import "shadcn/tailwind.css"`. Not dead. |
| Upstream 8bitcn quirks: `buttonVariants` is defined but never applied; `Kbd` sets both `retro` and `font-sans`; Badge splits className by prefix | Info | Upstream code, so leave it unless it causes bugs |
| Bleeding-edge toolchain (Vite 8, TypeScript 7, Tailwind 4.3, React 19.3) | Low | It builds clean. Pin it with the lockfile (already committed). |
| JS bundle 309 KB (~98 KB gzip) | Low | Mostly React + Radix. Fine for now; re-check after V2 features. |
| Scene geometry is hand-placed constants in `city.ts` | Low | Fine for one scene. A second scene would want a small scene-module interface. |

## 6. Contrast (computed, WCAG 2.x) [C]

| Pair | Ratio | Requirement | Result |
|---|---|---|---|
| Ink text on panel / void | 13.58 / 14.77 | 4.5 | ✅ |
| Ink-dim text on panel / void | 5.35 / 5.82 | 4.5 | ✅ |
| Kick / Snare / Hat / Clap fill on off cell | 4.59 / 8.33 / 7.64 / 5.57 | 3 | ✅ |
| Void glyph on each track fill | 5.78 / 10.48 / 9.62 / 7.02 | 3 | ✅ |
| Focus ring (ink) on cell | 11.73 | 3 | ✅ |
| Hover border (ink-dim) on cell | 4.62 | 3 | ✅ |
| **Off cell on panel** | **1.16 / 1.08** | **3** | ❌ (D2) |
| Scene: unlit window / sign on building | 1.10 / 1.16 | n/a (decorative, aria-hidden) | Intentional "dark city" |

## 7. 8bitcn usage (actual)

| Component | Where | Local patch |
|---|---|---|
| `Button` | Play/Stop, Groove, Clear | None (D1 and D4 need patches) |
| `Slider` | Tempo | **Patched:** `radix-ui` import, Thumb props forwarding (a11y name), single className |
| `Card` | Scene, transport, and sequencer frames | None |
| `Badge` | Audio status (OFF / ON / BLOCKED) | None |
| `Kbd` | Keyboard hint line (desktop) | None |
| `Alert` | Audio blocked notice | None |
| `retro.css` | Press Start 2P class | **Patched:** removed the Google Fonts `@import`, now self-hosted |
| Step cells | **Custom** `<button>` in the 8bitcn border/bevel language | By design (approved D2) |

## 8. CLAUDE.md acceptance checklist

| Item | Status |
|---|---|
| Every grid step toggles and keeps its state | ✅ [B] |
| Four tracks produce distinguishable sounds | ⏳ [—] Needs a listening test |
| Playback loops all 16 steps in time with BPM | ✅ [B][T] |
| Stop reliably halts scheduled playback | ✅ [B][T] |
| Rapid Play/Stop: no duplicate audio or broken state | ✅ [B][T] |
| Visual feedback matches the beat | ✅ [B] (grid + scene) |
| Starter pattern and Clear work | ✅ [B] |
| Uses real 8bitcn components | ✅ |
| Mobile and desktop usable | ⚠️ Layout verified [B]. No real-device test. D5. |
| Keyboard / focus / reduced motion checked | ⚠️ Keyboard ✅, reduced motion ✅, **focus ❌ (D1)** |
| No critical runtime errors or obvious leaks | ✅ No errors [B]. Node cleanup in code [R]. D3 is a potential leak in an edge case. |
| README | ❌ |
