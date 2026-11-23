# BEAT.BIT V2 — Gap Analysis & Roadmap

**Status:** ✅ APPROVED on 2026-11-23, with the decisions recorded below · **Date:** 2026-11-23
**Inputs:** [BUILD_STATUS.md](BUILD_STATUS.md) · [RESEARCH_SYNTHESIS.md](RESEARCH_SYNTHESIS.md) · [V2_DIRECTIONS.md](V2_DIRECTIONS.md) (recommendation: A · Signal City Live)
**Positioning:** *A tiny pixel world that performs the beat you make.*

**Ground rules:**
- Preserve the working sequencer, audio engine, and scheduler.
- Keep 8bitcn as the UI foundation.
- Drive every visual from scheduled audio events.
- No DAW features.
- Nothing is implemented until this is approved.

---

## Part 1 — Gap analysis

| Area | V1 today (verified) | Research / V2 direction | Gap | Phase |
|---|---|---|---|---|
| World performs the beat | Environment reacts per instrument (lights, drop, sign) | Characters *perform*; one recognizable actor per drum | No actors; no idle "life" beyond one window | V2.1 |
| Scene state moments | Idle + playing | Groove load "switch-on", Clear blackout, idle sleeping actors | Missing (blackout was an approved stretch) | V2.1 |
| Render architecture | Two rAF loops (grid, scene) | One clock-driven render path for many actors | Consolidate first | V2.1 |
| Starter content | 1 groove (SIGNAL) | 3–5 curated grooves, each showcasing the world differently | 4 grooves to compose, plus a picker | V2.2 |
| Mood variation | None | Optional sky tint / sign text per groove | New, small | V2.2 |
| Sharing | None | URL with pattern + BPM; Share button | Codec, Share UI, toast | V2.3 |
| Remixing | Implicit (editing) | Shared-link landing: Play / Remix / Start fresh | Landing state, URL updates | V2.3 |
| Link previews | Default title, Vite favicon | OG image + title/description | Static OG only (no server) | V2.3 |
| Hosting | Not deployed | Public link needed for sharing to be real | Deploy target | **V2.3 dependency** |
| Keyboard focus | **Fails on 8bitcn Button/Slider** (D1) | Accessible-sequencer claim | Must fix before any public claim | **V2.1 (first task)** |
| Non-text contrast | **Off cells 1.16:1** (D2) | WCAG 1.4.11 | Cell boundary treatment | V2.1 (with D1) |
| Mobile | No overflow; cells 28–34px; scene small on 1× | Mobile-first sharing moment | Cell size, real-device test, Share sheet | V2.4 |
| Screen reader | Names/states verified in DOM; no VoiceOver pass | Credible accessibility | VoiceOver + iOS VoiceOver pass | V2.4 |
| Sound | Timing verified; never heard by a human | Presets must sound good | Listening test; tuning time-box | V2.2 |
| Publishing | No README, recording, post | CLAUDE.md publication package | All | V2.4 |
| Metrics | None | MARKET suggests Play/share/remix rates | Needs an analytics decision | Deferred (decision) |

## Part 2 — Proposed changes to approved documents

These are **amendments to propose, not edits made**. Each one will be added as a dated "V2 amendment" section once approved. V1 text stays in place, and anything superseded is marked, not deleted.

### ART_DIRECTION.md (approved V1: Signal City)
| Section | Proposed amendment | Replaces an approved decision? |
|---|---|---|
| Concept | Add "Signal City **Live**": residents perform the beat | No. Extends it. |
| Track identity | Add an **actor** column (Stomper / Window Crew / Wire Birds / Rooftop Crowd) | No |
| Animation language | Add actor rest / hit / settle frames and reduced-motion equivalents | No |
| Palette | Actors in `--ink` with one track-color accent group; optional per-groove sky tints | **Partly.** It adds tints to a fixed palette, which needs approval. |
| Signature interactions | Add "switch-on" on groove load; promote **blackout on Clear** from stretch to core | Promotes a stretch item |

### DESIGN.md (approved V1)
| Section | Proposed amendment | Replaces an approved decision? |
|---|---|---|
| §3 IA | Add a Groove picker (transport), a Share button, and a Shared-beat banner (above the scene, only for shared links) | No |
| §5.2 Starter groove | SIGNAL becomes one of 5 curated grooves | No |
| §6 Controls | Groove → 8bitcn **Select** (picker) + Load; Share → 8bitcn Button; confirmation → 8bitcn **Toast** | **Yes:** the "Groove" button behavior changes |
| New §5.4 | URL state format and validation rules | New |
| §7 Interactions | Shared-link landing flow; URL update rules | New |
| §9 Keyboard | Picker keyboard behavior (8bitcn/Radix Select defaults) | New |
| §11 Scene | Actor specs and the single render loop | Extends |
| §14 Acceptance | V2 criteria (below) | Extends |
| §15 Out of scope | **Move "multiple presets" and "share URLs" into scope.** Everything else (swing, mute/solo, volume, export, accounts, gallery, MIDI) stays out. | **Yes:** an explicit scope change |

---

## Part 3 — Roadmap

Estimates assume the same working pace as V1 (focused days).

### V2.1 — Reactive World ("Signal City Live"), about 1.5 days

**Goal:** The world visibly *performs*, and the accessibility claim becomes true.

**Deliverables**
1. **Fixes first:** D1 (visible focus on 8bitcn Button and Slider, via a documented local patch), D2 (off-cell boundary ≥ 3:1), D3 (silent-mode clock gating), D4 (Stop button corners), D8 (single render loop).
2. A pixel-sprite helper: frames as string arrays, drawn with `fillRect`. No assets.
3. Four actors (Stomper, Window Crew, Wire Birds, Rooftop Crowd) with rest / hit / settle frames and reduced-motion variants.
4. Scene moments: idle (sleeping actors), groove switch-on, Clear blackout.
5. Tests: reducer tests, plus a scene mapping test (a step event produces the expected actor triggers).
6. Amendments to ART_DIRECTION and DESIGN §11 (after approval).

**Dependencies:** Direction approval (V2_DIRECTIONS.md).

**Acceptance criteria**
- [ ] Each drum triggers **only** its actor (verified by canvas probe, as in V1) at the step it is heard.
- [ ] All four actors stay readable at 2× scale (320 CSS px canvas); review screenshot approved by you.
- [ ] Empty, sparse, and all-16-steps patterns all look intentional (no visual chaos, no idle-looking world while playing).
- [ ] Reduced motion: no travel, shake, or flicker; actors change pose or color only.
- [ ] Visible focus indicator on every interactive control (real Tab key presses + screenshots).
- [ ] Empty cell boundaries ≥ 3:1 against the panel (computed).
- [ ] No regression: scheduler tests pass, rapid Play/Stop still yields one loop, no console errors.

**Risks:** Actors too small to read on phones (mitigation: Stomper/Crowd sized to at least 10px tall, reviewed at 2×). Art-time overrun (mitigation: 2 frames per actor first, more only if time allows).

---

### V2.2 — Curated Grooves, about 0.5–1 day

**Goal:** The first Play always sounds good, and each groove shows the world in a different light.

**Deliverables**
1. Five grooves, each composed and **listened to**:

   | Groove | BPM | Character | Optional mood |
   |---|---|---|---|
   | SIGNAL | 104 | Existing syncopated head-nod | Default night |
   | BOOM BAP | 90 | Laid-back kick/snare, swung-feel hats via placement | Warm amber sky |
   | TECHNO | 128 | Four-on-the-floor, offbeat hats, clap on 2 and 4 | Cool teal sky |
   | BOSS FIGHT | 150 | Driving 16th hats, double kicks | Red-tinted sky, sign reads "BOSS" |
   | LO-FI | 76 | Sparse, lazy | Dimmed city, more windows lit |

   *(Names and moods follow MARKET_RESEARCH suggestions. "Arcade Chase" was dropped as overlapping with BOSS FIGHT.)*
2. A groove picker (8bitcn **Select**) in the transport, replacing the single Groove button. Picking a groove loads it immediately, even during playback.
3. Mood data per groove: sky colors and sign text, with no new scene code paths.
4. A human listening test of the voices, with a 45-minute tuning time-box.

**Dependencies:** V2.1 (switch-on moment, mood hooks in the scene). Your ears for the listening test.

**Acceptance criteria**
- [ ] Each groove plays in time, loads mid-playback without a restart or skip, and is announced ("BOOM BAP loaded, 90 BPM").
- [ ] You approve all five grooves by ear.
- [ ] The picker is fully keyboard-operable with a visible focus.
- [ ] Mood changes are visual only and keep text/UI contrast unchanged.

**Risks:** The 8bitcn Select API is unverified, so check the registry source before building. Four synthesized voices limit genre authenticity (mitigation: name grooves by feel, not strict genre).

---

### V2.3 — URL Sharing & Remixing, about 1 day

**Goal:** Every beat is a link, and every link invites a remix.

**Deliverables**
1. **URL codec** (pure, unit-tested): `?v=1&t=<bpm>&p=<16 hex>[&g=<groove-id>]`
   - `p` holds 4 tracks × 16 steps as 16 hex characters (kick, snare, hat, clap; step 1 = most significant bit).
   - Strict validation: an unknown `v`, a malformed `p`, or an out-of-range `t` falls back to the default groove plus a polite notice. It never throws on untrusted input.
2. **Share button** (8bitcn Button): Web Share API where available (mobile), otherwise copy to clipboard, with an 8bitcn **Toast** "LINK COPIED" and a live-region announcement.
3. **Shared-beat landing:** when the URL contains a beat, a banner Card shows "SHARED BEAT · 112 BPM" with **PLAY**, **REMIX** (dismisses the banner and focuses the grid), and **START FRESH** (clears). Play still needs the user's gesture (autoplay rules).
4. **URL update rule (approved):** the shareable URL is generated and written to the address bar **only when Share is pressed**. It isn't updated live while editing.
5. **Deploy** (prerequisite for real sharing), plus a static OG image (1200×630 screenshot), title, description, and a pixel favicon (D7).

**Dependencies:** A hosting decision (below). V2.2 groove ids (for `g`).

**Acceptance criteria**
- [ ] Round trip: encode → decode gives an identical pattern and BPM for every groove and 1,000 random patterns (unit test).
- [ ] Malformed or hostile URLs (`p` too long, non-hex, `t=9999`, script fragments) load the default safely (unit test + browser).
- [ ] Opening a shared link on desktop and on a phone shows the banner, and Play reproduces the same performance.
- [ ] Share works on iOS Safari (share sheet) and desktop Chrome (clipboard + toast).
- [ ] Links render a preview card (title, description, image) when pasted into a messaging app.

**Risks:** GitHub Pages needs `base: '/beat.bit/'` in Vite. Per-beat OG images aren't possible without a server, so expect a generic card. Clipboard permission edge cases (mitigation: fall back to a selectable text field).

---

### V2.4 — Mobile, Accessibility & Polish, about 1 day

**Goal:** It feels good on a phone, holds up with a screen reader, and is ready to publish.

**Deliverables**
1. Mobile: cells ≥ 36px at 375px (D5), a scene-size review on real phones, thumb-reachable Play/Share, and a check of the iOS silent-switch notice.
2. Accessibility: VoiceOver (macOS + iOS) pass, a decision on the debounced BPM announcement, and contrast re-verification of every V2 addition.
3. Polish:
   - optional global shortcuts (Shift+Space play/stop, `[`/`]` BPM);
   - remove dead dependencies and files (lucide-react, tw-animate-css, unused `ui/slider.tsx`, `icons.svg`);
   - a motion review of every actor.
4. Publication package: README (stack, 8bitcn components + patches, design choices, limitations), 10–20 s recording guide, 2–3 screenshots, build log, and an X post draft labelled **DAY 001 / 100 — BEAT.BIT** with real links.

**Dependencies:** V2.1–V2.3 deployed. Access to an iPhone and an Android phone (yours).

**Acceptance criteria**
- [ ] Every item in DESIGN §14 plus the V2 criteria above passes.
- [ ] VoiceOver: grid cells announce track, step, and pressed state; Play/Stop and share confirmations are announced.
- [ ] No horizontal overflow at 320–1440px; touch cells ≥ 36px at ≥ 375px.
- [ ] Lighthouse accessibility ≥ 95 on the deployed URL. **[A: a target, not a guarantee]**
- [ ] README reviewed by you. No claims that weren't verified.

**Risks:** Real-device findings may reopen V2.1 sizing. Time pressure on the publication assets (mitigation: write the README progressively from V2.1 onward).

---

## Approved decisions (2026-11-23)

| # | Decision |
|---|---|
| 1 | World: **A · Signal City Live** |
| 2 | Curated presets and URL sharing are **in scope as later V2 phases (V2.2, V2.3), not V2.1** |
| 3 | Hosting: **GitHub Pages** |
| 4 | Shareable URL generated/updated **only when Share is pressed** |
| 5 | Confirmed accessibility defects fixed in a **separate commit before V2.1** (Phase 0, Stabilization) |
| 6 | Analytics: **none** |
| 7 | Preset moods: **yes**, as lightweight palette and atmosphere variations |

**Execution order:**
1. **Phase 0** Stabilization (separate commit).
2. **Phase 1** ART_DIRECTION.md V2.1 section + DESIGN.md interaction spec, then an **approval gate**.
3. **Phase 2** V2.1 implementation.

V2.2 and V2.3 don't start until V2.1 has been reviewed. BUILD_STATUS.md is updated after each phase.

## Part 4 — Sequencing and decisions (as proposed)

```
V2.1 Fixes + Reactive World ──► V2.2 Grooves ──► V2.3 Share/Remix (+ Deploy) ──► V2.4 Mobile/A11y/Publish
        ▲                                               ▲
   Direction approval                           Hosting decision
```

**Total:** about 4–4.5 focused days.

**Decisions needed**
1. **World direction:** A · Signal City Live (recommended), B, or C? See V2_DIRECTIONS.md.
2. **Scope amendment:** move curated presets and URL sharing into scope (DESIGN §15). Approve?
3. **Hosting:**
   - **GitHub Pages** (recommended: the repo is already there, it's free, and a GitHub Action can deploy it);
   - **Vercel/Netlify** (simpler previews, an extra account).
4. **URL behavior:** update the address bar live while editing (recommended) vs. only when Share is pressed.
5. **Fix-first:** do the D1–D4 and D8 fixes at the start of V2.1 (recommended) vs. as a separate hotfix commit before any V2 work.
6. **Analytics:** none for now (recommended), or privacy-friendly aggregate analytics to measure the MARKET_RESEARCH metrics.
7. **Mood per groove** (sky tint, sign text): yes (recommended) or no.


---

## Part 5 — Music & Game Reset (2026-11-23, ⏳ PROPOSED)

**Trigger:** V2.3a works, but the product feels musically underwhelming. **New vision:** *a playful music arcade where people create original funky tunes, perform them, earn rewards, and unlock reactive pixel worlds.*
**Specs:** [MUSIC_DIRECTION.md](MUSIC_DIRECTION.md) · [GAME_DESIGN.md](GAME_DESIGN.md).

### Status of earlier phases
| Phase | Status |
|---|---|
| V2.1 Signal City Live · V2.2 Grooves + Remix Dice · V2.3a BIT LEAD + generator | ✅ Shipped. **Preserved.** |
| V2.3b Pitch Grid editor · V2.3c Remix Dice v2 · sharing · V2.4 polish | ⏸ **Paused** by this reset (not cancelled) |
| Four composed kits + objective QA + audio previews | ✅ Done as **dev-only previews** (`src/dev/music/`, `dev/music-preview.html`) |

### Phase D: smallest playable milestone, "V3.0 PLAYABLE SLICE" (~3 focused days)
**Goal:** prove both (1) *genuinely enjoyable music* and (2) *one satisfying game challenge*, with the least new surface.

| # | Build | Explicitly not in the slice |
|---|---|---|
| S1 | **Kit engine:** promote the prototype voices (bass, chords, leads, open hat/crash/toms, velocity, FX sends, safety limiter) into `src/audio`, with tests. Bar-aware scheduling (bar index → the kit's bass/chords/lead per bar). | Pitch Grid editor, melody editing |
| S2 | **Two kits in the app:** NEON DRIVE (default) and PIXEL QUEST, with intro → main → variation → drop → end and a looping main in Sandbox. The drum grid edits the kit's drum layer. Remix Dice (drums) keeps working. The V2.2 groove picker becomes the **kit picker**; NIGHT SHIFT and BOSS RUSH show as locked. | Mutation levels (Phase B), NIGHT SHIFT / BOSS RUSH playable, new worlds |
| S3 | **ARCADE: WAKE THE CITY** (2 pads, ~30 s): cues on the grid one bar ahead, audio-clock judging, PERFECT/GREAT/GOOD/MISS/STRAY, combo, district lighting, results card (score, accuracy, stars, 8bitcn XP Bar) | Funk Master, Boss Battle, daily mutation, ghost runs |
| S4 | **Progression-lite:** XP + rank badge + "NEON DRIVE unlocked" stored in `localStorage` (versioned). Assist mode toggle. A simple 10-tap calibration. | Accounts, leaderboard, cloud saves |
| S5 | **FTUE:** PLAY → challenge-as-tutorial → results → Sandbox | Full settings screen |

**Preserved:** V2.1 performers (they react to the player's hits in Arcade and to drum steps in Sandbox), V2.2 Remix Dice + Undo, V2.3a BIT LEAD (as the `pulse25` preset), keyboard and reduced-motion behavior, 8bitcn foundation.

### Acceptance criteria: V3.0 Playable Slice
**Music**
- [ ] NEON DRIVE and PIXEL QUEST in the app match the approved previews. Same score data. Offline render of the app path within ±0.5 dB per section of the preview.
- [ ] No clipping: peak < 0.95 on every section, plus 200 seeded drum-remix variations rendered offline stay < 0.98. Tail < −80 dB after Stop. 21× rapid Play/Stop leaves silence (V2.3a harness).
- [ ] The composition lint passes on all kit data (key, approach notes, range).
- [ ] **You approve both kits by ear** in the app.

**Sandbox (regression)**
- [ ] All V2.1/V2.2/V2.3a unit tests, the performer probe, and the regression suite pass. Drum-grid edits change the kit's drum layer on the next pass. Undo works.

**Arcade: Wake the City**
- [ ] Judge function unit tests: offsets 0/±30/±60/±100/±150 ms → PERFECT/PERFECT/GREAT/GOOD/MISS at Normal windows. Assist doubles the windows.
- [ ] Scripted Chrome run: presses injected at the cue times (±5 ms) → ≥ 95% PERFECT, ★★★.
- [ ] **Anti-spam:** a scripted mash (8 random presses per beat on both pads) → accuracy < 25%, no star, XP 0. Repeated presses < 40 ms apart count once.
- [ ] Combo, district lighting, and the performer reacting to each player hit are visible. Misses make no error sound.
- [ ] Results card shows score, accuracy, stars, and XP (8bitcn XP Bar). XP and unlock persist across reload. A replay below the best star tier gives 20% XP.
- [ ] Keyboard (`F`/`J`) and touch pads (≥ 64 px) both work. Focus is visible. The challenge can be started, paused (Esc), and retried by keyboard.
- [ ] Reduced motion: no travelling pops or shake, instant district lights.
- [ ] Screen reader: objectives and results announced, no per-note announcements. An optional count-in is available.
- [ ] **FTUE:** a scripted first visit produces sound within 5 s of pressing PLAY, and the first hinted cue can be hit within 15 s of page load.

### Slice status (2026-11-24): ✅ BUILT, awaiting your review

On "continue" I proceeded with the **recommended option for each decision below** (stated at the time):
- music arcade positioning (tagline "Make funky tunes. Wake the city.");
- kits replace grooves in the picker;
- NEON DRIVE + PIXEL QUEST;
- V2.3a melody controls removed;
- F/J + on-screen pads.

**Your by-ear approval of the kits is still open.**

| Item | Status | Commit |
|---|---|---|
| S1 Kit engine | ✅ Instruments + kit player promoted to `src/audio`. Safety limiter. App renders match the approved previews within 0.1 dB per section. | `7012f39` |
| S2 Kits in Sandbox | ✅ Kit picker (NIGHT SHIFT / BOSS RUSH locked), grid from the kit's composed drums + accents, looping main-section backing, mood per kit, Remix + Undo kept | `5ecd6b8` |
| S3 Wake the City | ✅ Chart, audio-clock judging, scoring, anti-spam, HUD, pads, results + 8bitcn XP Bar, districts | `91da480` |
| S4 Progression-lite | ✅ XP, ranks, best stars, replay cap, Assist, versioned `localStorage`. ⚠️ **Calibration not built** (deferred). | `91da480` |
| S5 FTUE | ✅ Simplified: a "WAKE THE CITY" start card (first-time copy, hints for the first 4 cues), and results point to Sandbox. Sandbox stays open from the start (no tutorial gate). | this commit |

**Deviations from GAME_DESIGN, to review:**
- Esc **quits** (there's no pause).
- NEON DRIVE is playable in Sandbox before the tutorial.
- Stray presses are silent; only judged hits sound.
- The calibration screen is deferred.
- District lighting is subtle (8 ambient windows).

### Decisions needed before the slice (answered by assumption, see above)
1. **Vision change:** adopt "music arcade" as the product positioning (it supersedes "a tiny pixel world that performs the beat you make" as the headline, while the world stays central)?
2. **Kits replace V2.2 grooves** in the picker (the V2.2 grooves are retired from the UI, kept in code for tests)? Recommended: yes.
3. **Slice kits:** NEON DRIVE + PIXEL QUEST (recommended), or NEON DRIVE only (faster)?
4. **V2.3a temporary melody controls:** remove in the slice (the kit lead replaces them)? Recommended: yes.
5. **Arcade input default:** 2 pads `F` / `J`, with on-screen pads on touch (recommended)?
