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
