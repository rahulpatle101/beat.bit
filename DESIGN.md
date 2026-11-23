# BEAT.BIT — Experience Design Specification

**Day 001 / 100 Days of Digital Craft** · Stage 3 of 4
**Status:** ✅ V1 APPROVED on 2026-11-23. All D1–D7 accepted as recommended. Step cells must carry the 8-bit style wherever it can be themed. · ✅ **V2.1 amendment APPROVED on 2026-11-23**, see [V2.1 Amendment](#v21-amendment--signal-city-live-interaction-specification)
**Builds on:** [RESEARCH.md](RESEARCH.md) · [ART_DIRECTION.md](ART_DIRECTION.md) (✅ Signal City)

---

## 1. Experience goals

| # | Goal | Measure |
|---|---|---|
| G1 | **Playable in seconds** | A first-time visitor hears the groove and sees the city react **with one action** (Play). |
| G2 | **Tactile, legible instrument** | Every step's state (off/on/playing/focused) is distinguishable at a glance and without color. |
| G3 | **Music you can see** | Each instrument visibly drives its own part of the scene, in time with the audio. |
| G4 | **Robust transport** | No duplicate loops, drift, or stuck audio after any sequence of Play/Stop/tempo/edit actions. |
| G5 | **Inclusive** | Fully operable by keyboard. Screen readers get meaningful names and states, motion can be reduced, and it's usable at 360px wide. |

**Primary user:** a curious visitor from a social post, on a laptop or phone, with no music training and about 30 seconds of attention.
**Secondary user:** a designer or developer evaluating the craft. They'll try the keyboard, resize the window, and spam Play.

## 2. Core user journey

1. **Land.** The city is dark and the starter groove is already in the grid. The Play button is the most prominent control. A one-line hint reads "Press Play, then tap the grid to change the beat."
2. **Play** (first user gesture). The AudioContext is created or resumed, the transport starts, and the city wakes up.
   - If audio is blocked, an inline `Alert` appears (§7.4) and the visuals still run so the experience isn't dead.
3. **Edit.** Tap steps while it plays. Changes land on the next pass.
4. **Explore.** Drag the BPM, Clear to start from silence, reload the Groove.
5. **Stop.** Silence comes at once, and the city goes dark with the idle blink.

## 3. Information architecture

```
App
├── Header           BEAT.BIT wordmark · "DAY 001 / 100" · audio status Badge
├── Scene            Pixel city canvas (decorative, aria-hidden) + text status for AT
├── Transport        Play/Stop · BPM slider + readout · Groove · Clear
├── Sequencer        4 tracks × 16 steps (+ track labels with glyphs)
├── Hint line        Context-sensitive one-line help (+ Kbd hints on desktop)
└── Footer           Credits, 8bitcn mention, source link
```

There is only one view: no routes, no modals, no settings panel.

## 4. Layout

### 4.1 Desktop (≥ 1024px), max content width 1040px, centered

```
┌──────────────────────────────────────────────────────────────┐
│ BEAT.BIT                         DAY 001/100   [AUDIO ● ON]  │  header
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                  ░ SCENE  160×50 @ 6× = 960×300 ░            │  Card
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [ ▶ PLAY ]   BPM ═══════●══════  104    [ GROOVE ] [ CLEAR ] │  Card: transport
├──────────────────────────────────────────────────────────────┤
│ ▮ KICK  │■□□□│□□■□│■□□□│□□□■│                                │
│ ▚ SNARE │□□□□│■□□□│□□□□│■□□□│                                │  Card: sequencer
│ ▴ HAT   │■□■□│■□■□│■□■□│■□■■│                                │
│ ✚ CLAP  │□□□□│□□□□│□□□□│■□□■│                                │
│           1    5    9    13     ← beat numbers                 │
├──────────────────────────────────────────────────────────────┤
│ ← → ↑ ↓ move · SPACE toggle · TAB to controls                │  hint
└──────────────────────────────────────────────────────────────┘
```

- Step cells are **48×48px** with 4px gaps and an 8px extra gap between beat groups.
- The track-label column is 120px wide. Beat numbers 1/5/9/13 sit under each group.

### 4.2 Tablet (640–1023px)

The same structure. Cells shrink fluidly to `min(48px, (container − label) / 16 − gap)`, which is about 36px at 768px. Track labels shrink to the glyph plus a short name. The scene scales to the largest integer that fits (4× = 640px at 768).

### 4.3 Mobile (< 640px): split bars

16 columns don't fit at 360px with usable touch targets, which would be about 18px each. **The grid wraps into two stacked 8-step blocks.** Each block has all 4 tracks, so steps stay vertically aligned across instruments:

```
┌─────────────────────────────┐
│ BEAT.BIT          [AUDIO ●] │
│ ░░ SCENE 160×50 @2× ░░░░░░░ │  320×100
│ [ ▶ PLAY ]          [GROOVE]│
│ BPM ══════●═══ 104  [CLEAR] │
│ STEPS 1–8                   │
│ ▮ ■□□□ □□■□                 │
│ ▚ □□□□ ■□□□                 │
│ ▴ ■□■□ ■□■□                 │
│ ✚ □□□□ □□□□                 │
│ STEPS 9–16                  │
│ ▮ ■□□□ □□□■                 │
│ ▚ □□□□ ■□□□                 │
│ ▴ ■□■□ ■□■■                 │
│ ✚ □□□□ ■□□■                 │
└─────────────────────────────┘
```

- **Cells are ≥ 36×36px** at 360px wide. That's above the WCAG 2.5.8 minimum (24px). The target is 40px at 390px+.
- Track labels become **glyph only** (24px column), and the accessible name still carries the full instrument name.
- The playhead sweeps block 1, then block 2, so it reads as two bars.
- **No horizontal overflow at 320px or wider.** Below 340px, cells may drop to 32px.
- The transport stays above the grid, so Play is reachable without scrolling on a 667px-tall screen **[A: verify]**.

### 4.4 Scene scaling

The scale is `floor(containerWidth / 160)`, clamped to 2–6. The canvas is centered, and the remaining letterbox uses `--void`. A canvas is never rendered at a non-integer scale.

## 5. The sequencer

### 5.1 Data model (kept separate from playback and rendering)

```ts
type TrackId = 'kick' | 'snare' | 'hat' | 'clap';
type Pattern = Record<TrackId, boolean[]>;   // each length 16
interface SequencerState { pattern: Pattern; bpm: number; }  // bpm 60–180, default 104
```

- The pattern lives in React state (reducer: `toggle`, `clear`, `loadGroove`, `setBpm`).
- The audio scheduler reads the **latest pattern through a ref**, so edits never restart the transport.
- The **current step is not React state.** The render loop writes `data-step` on the grid root, and CSS styles the active column. This avoids re-rendering 64 cells 7+ times a second.

### 5.2 Starter groove: "SIGNAL" at 104 BPM

| Track | Steps (1-indexed) | Shape |
|---|---|---|
| Kick | 1, 7, 9, 14 | Syncopated, head-nod |
| Snare | 5, 13 | Backbeat |
| Hi-hat | 1, 3, 5, 7, 9, 11, 13, 15, 16 | 8ths with a pickup |
| Clap | 13, 16 | Layered backbeat + turnaround |

It's loaded on first visit and by the **Groove** button. Final tuning happens by ear during the build.

### 5.3 Timing

- One step is a 16th note: `stepDuration = 60 / bpm / 4` s (≈144 ms at 104 BPM).
- **Lookahead scheduler:** it wakes every 25 ms and schedules every step whose time falls within the next 100 ms on the audio clock.
- **Note queue:** each scheduled step pushes `{ step, time, voices[] }`. A `requestAnimationFrame` loop pops entries whose `time <= ctx.currentTime − outputLatency` and drives the playhead and the scene. Visuals are therefore derived from scheduled audio events, not from a separate animation.
- **A tempo change** takes effect from the next step scheduled. There's no restart or jump.
- **Edits close to the playhead:** a toggle made less than 100 ms before its step may already have been scheduled, so it lands on the next loop. This is documented as expected behavior.

## 6. Controls

| Control | 8bitcn component | Behavior |
|---|---|---|
| **Play / Stop** | `Button` (default variant, lg) | A single toggle. Its visible label switches between `▶ PLAY` and `■ STOP`, and its accessible name matches. It's idempotent: repeated clicks never stack loops. |
| **BPM** | `Slider` (patched to forward `aria-label`/`aria-valuetext` to the Thumb) + numeric readout | Range 60–180, step 1. Arrows ±1, PageUp/PageDown ±10, Home/End min/max. `aria-valuetext="104 beats per minute"`. The readout is a Press Start 2P 3-digit display. |
| **Groove** | `Button` (outline) | Loads "SIGNAL" and sets BPM to 104. It works during playback. |
| **Clear** | `Button` (outline) | Empties all steps. The transport keeps running, so the playhead sweeps a silent, dark city and invites rebuilding. (Stretch: the blackout animation.) |
| **Audio status** | `Badge` | `AUDIO OFF` (before the first gesture) · `AUDIO ON` · `AUDIO BLOCKED` |
| **Audio notice** | `Alert` | Shown only when blocked (§7.4). |
| **Shortcut hints** | `Kbd` | In the hint line on desktop only. |
| **Framing** | `Card` | The scene, transport, and sequencer each sit in a Card. |
| **Step cells** | Custom `<button>`, styled to match 8bitcn | See §5 / §8. This is a performance and state-control decision, documented in the README. |

No confirmation on Clear: it's one click to undo via Groove, and a confirmation would break the instrument feel. (Stretch: an undo toast.)

## 7. Interaction specification

### 7.1 Step toggle
- **Pointer/touch:** it toggles on `pointerdown` for an instant feel. A second tap toggles it back.
- **Keyboard:** Space or Enter toggles the focused step.
- **Stopped:** turning a step **on** auditions that instrument once (pressing makes a sound, which teaches the rows). Turning it off is silent.
- **Playing:** no audition, because the step is heard on its next pass.
- The visual flip happens in the same frame, playing or stopped.

### 7.2 Transport
| From → action | Result |
|---|---|
| Stopped → Play | Create/resume the AudioContext, then start the scheduler at step 1, `startTime = ctx.currentTime + 0.05`. |
| Playing → Stop | Clear the scheduler timer, stop or disconnect every voice scheduled but not yet played, clear the note queue, reset the playhead, and set the scene to idle. |
| Play ×N rapidly | A guard flag means only one scheduler can exist. Each Stop fully tears it down first. |
| Tab hidden while playing | **Auto-stop** and announce "Stopped: tab hidden." Background timer throttling would otherwise cause stutter. **[Decision §13]** |
| Unmount / HMR | Dispose the scheduler, close the AudioContext, cancel rAF. |

### 7.3 Tempo
Dragging updates the readout live and the audio from the next step. Screen-reader announcements are debounced to 500 ms.

### 7.4 Audio activation and blocked state
| State | Trigger | UI |
|---|---|---|
| `locked` | The initial load | Badge: `AUDIO OFF`. Hint: "Press Play to start sound." |
| `running` | `ctx.state === 'running'` after Play | Badge: `AUDIO ON` |
| `blocked` | After the gesture, `resume()` rejects or state is still not running after 300 ms | Badge: `AUDIO BLOCKED`. `Alert`: "Sound is blocked. Tap Play again. On iPhone, check the silent switch." The visuals keep playing. |
| `interrupted` (iOS) | `statechange` to `interrupted`/`suspended` while playing | Stop the transport and show the `blocked` notice. |

## 8. Component states

### 8.1 Step cell

| State | Visual | Non-color cue |
|---|---|---|
| Off | `--cell` / `--cell-alt` (beat group), 1-unit bevel | Empty |
| Off + hover | Border brightens to `--ink-dim` | Border |
| On | Fill in the track color, glyph knocked out in `--void` | **Glyph visible** |
| On + hover | Fill lightened ~8% | — |
| Pressed | Translate 2px down-right (bevel inverts) for 80 ms | Movement |
| Focus-visible | 2px `--ink` outline, 2px offset, **square** corners | Outline (distinct from the playhead) |
| Playhead column (off cells) | `--ink` at 12% wash + 2px tick marks above and below the column | Ticks |
| Playhead column + on (**sounding**) | 1-frame brighten + 2-unit glow in the track color, decaying within one step | Brightness pulse |
| Reduced motion, sounding | Brighten only, with no glow decay animation | — |

### 8.2 Play button
| State | Label | Visual |
|---|---|---|
| Stopped | `▶ PLAY` | `--ink` fill, `--void` text (highest emphasis on the page) |
| Playing | `■ STOP` | Inverted: `--panel` fill, `--ink` border/text. A small beat-synced pip blinks on each quarter note (stops with reduced motion). |
| Focus | 8bitcn focus + `--ink` outline | — |
| Pressed | 8bitcn's built-in 4px translate | — |

### 8.3 Scene states
`idle` (dark city, blinking window, "PRESS PLAY" in pixel text) · `playing` (layer responses per ART_DIRECTION) · `cleared-playing` (dark city, only the playhead lamps move) · `blocked` (the visuals still run, and the scene isn't greyed out).

## 9. Keyboard interaction

### 9.1 Tab order
Play → BPM slider → Groove → Clear → **Sequencer (one Tab stop)** → footer link.

### 9.2 Within the sequencer (roving tabindex)
| Key | Action |
|---|---|
| ← / → | Previous/next step. Stops at the edges, no wrap (APG grid convention). |
| ↑ / ↓ | Same step, previous/next track |
| Home / End | First/last step in the row |
| Ctrl/⌘ + Home / End | First step of the first track / last step of the last track |
| Space / Enter | Toggle the step |
| Tab / Shift+Tab | Leave the grid. On return, focus restores to the last focused cell. |

On mobile's split layout the **logical** navigation is unchanged: → from step 8 goes to step 9 in the lower block.

### 9.3 Global shortcuts (stretch, post-MVP)
`Shift+Space` play/stop · `[` / `]` BPM ±1. They're disabled while focus is in the slider. Plain Space is deliberately **not** global, because it toggles the focused cell or button.

## 10. Accessibility

- **Grid semantics:** `role="grid"` with `aria-label="Drum pattern, 4 tracks by 16 steps"`. Each track is a `role="row"`. The label cell is `role="rowheader"` and the step cells are `role="gridcell"` wrapping a `<button aria-pressed>`. **[A]** The alternative of `<button>` inside `role="group"` rows is simpler. I'll validate with VoiceOver and pick whichever announces more cleanly, then note which in the README.
- **Step names:** `aria-label="Kick, step 5"` + `aria-pressed`. Beat group context is added on steps 1/5/9/13 ("Kick, step 5, beat 2").
- **Live region** (`aria-live="polite"`, visually hidden) announces only discrete events: "Playing at 104 BPM", "Stopped", "Pattern cleared", "Groove loaded", "Sound blocked…". **There are no per-step announcements.**
- **Scene:** the canvas is `aria-hidden="true"`. The live region and grid carry all the information.
- **Contrast:** text ≥ 4.5:1, UI boundaries and the focus ring ≥ 3:1 against neighbors. Each track color must reach ≥ 3:1 against `--cell` **[A: verify all tokens with a checker; adjust hex if needed]**.
- **Color independence:** the track glyph appears on every "on" cell and every label.
- **Reduced motion** (`prefers-reduced-motion: reduce`): per the ART_DIRECTION table. The playhead and state changes stay. Movement, flicker, twinkle, glow decay, and the idle blink are removed.
- **Zoom:** usable at 200% browser zoom on desktop (the layout falls through to the tablet/mobile arrangement).
- **Touch:** `touch-action: manipulation` on cells (no double-tap zoom delay). Cells never act as scroll-blocking drag surfaces.

## 11. Scene specification (Signal City)

A canvas of **160×50 logical pixels**, drawn with Canvas 2D at native resolution and CSS-scaled.

| Element | Count / size | Driven by |
|---|---|---|
| Sky | Full background, 2-tone ordered dither | Static |
| Stars | ~12 single pixels | Hi-hat: one random star twinkles for 2 frames |
| Skyline | 7–9 buildings, heights 14–38px, one tallest tower | Kick: whole skyline y+1 for 2 frames |
| Windows | 2×2 px on a 4px grid inside the buildings (~60 total) | Snare: 3–6 random windows light, fading over ~3 steps |
| Antenna | 1 light on the tallest tower | Hi-hat: blinks teal |
| Neon sign | ~16×5 px glyph on the tower ("BIT") | Clap: 2-frame flicker, then on for 1 step |
| Street line | 1px across the bottom | Kick: coral flash |
| Street lamps | 16 lamps evenly spaced | Playhead: the current lamp is lit `--ink` |
| Idle cursor | 1 window | Blinks at 1 Hz when stopped |

- Rendering: one draw function `draw(state, now)` per rAF. The decay state is a tiny array of `{ element, startTime }`. Scene-element frames are quantized to ~12 fps for the pixel feel, but **onsets render on the very next frame**.
- **Stretch (warm-up/blackout):** consecutive unchanged loops (up to 4) extend the window fade length. Any edit resets the count. On Clear, windows turn off column by column over 4 frames.

## 12. Implementation plan (for reference; it begins after approval)

### 12.1 Dependencies (each needs your approval at install time)
| Package | Why |
|---|---|
| `vite`, `react`, `react-dom`, `typescript`, `@vitejs/plugin-react` | The app shell |
| `tailwindcss`, `@tailwindcss/vite` | Required by shadcn/8bitcn |
| `shadcn` CLI (run with `pnpm dlx`, not installed) | Adds the 8bitcn components |
| Pulled in by shadcn: `radix-ui`/`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge` | 8bitcn component dependencies |
| `@fontsource/press-start-2p`, `@fontsource/ibm-plex-sans` | Self-hosted fonts **[A: package names to verify]** |
| `vitest` (dev, optional) | Unit tests for the pattern reducer and scheduler math |

There is no Tone.js unless the fallback is triggered, and if so I'll ask first.

### 12.2 Structure
```
src/
  audio/engine.ts        AudioContext lifecycle, master bus, unlock/blocked state
  audio/scheduler.ts     Lookahead scheduler + note queue (no React)
  audio/voices.ts        kick / snare / hat / clap synthesis
  data/patterns.ts       Types, empty pattern, SIGNAL groove
  hooks/useSequencer.ts  Reducer + wiring between state, scheduler, and the rAF loop
  components/SequencerGrid.tsx   Grid, roving focus, StepCell
  components/TransportControls.tsx
  components/CityScene.tsx       Canvas + draw()
  components/ui/8bit/*           8bitcn (generated, minimally patched)
  styles/tokens.css
```

### 12.3 Milestones and verification
| # | Milestone | How you verify |
|---|---|---|
| M1 | Vite + Tailwind + shadcn + **one 8bitcn Button rendering**, fonts self-hosted | `pnpm dev`: the button renders in Press Start 2P, with no Google Fonts request in the Network tab |
| M2 | Audio engine + 4 voices + scheduler + Play/Stop/BPM + groove (minimal UI) | You hear the groove, BPM changes are smooth, and 20 rapid Play/Stop clicks leave one loop |
| M3 | Full sequencer grid + states + keyboard + 8bitcn transport | Toggle every cell, navigate with the keyboard only, edit during playback |
| M4 | Signal City scene, synced | Each instrument drives its layer, and the playhead lamps match the grid |
| M5 | Quality pass: reduced motion, responsive (320/375/768/1280), contrast, VoiceOver, lifecycle | The §14 checklist |
| M6 | Ship pass: README, deploy instructions, screenshot/recording guide, X draft | Docs reviewed by you |

## 13. Decisions (✅ all approved as recommended)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Mobile grid layout | **Split into two 8-step blocks** (§4.3). The alternative, a vertical tracker (steps as rows), is more unusual but less like a drum machine. |
| D2 | Step cells as custom buttons styled to 8bitcn, rather than 64 8bitcn `Toggle`s | **Custom.** It's better for performance and state control, and 8bitcn stays meaningful across the transport and framing. |
| D3 | Behavior when the tab is hidden | **Auto-stop**, rather than continuing with possible stutter. |
| D4 | Secondary font | **IBM Plex Sans** (self-hosted) vs `system-ui` (zero dependencies). |
| D5 | Clear has no confirmation | **No confirmation.** Groove restores the starter pattern instantly. |
| D6 | Add vitest for logic tests | **Yes**, a small dev dependency that gives confidence in the scheduler/reducer. |
| D7 | Package manager | **pnpm** (it matches the 8bitcn docs). |

## 13a. Implementation notes (decisions made during the build)

- **Silent mode when audio is blocked:** if the AudioContext can't start, playback runs on a fallback clock (`performance.now()`), so the grid and city still animate, and the blocked `Alert` explains how to retry. If audio is interrupted mid-play (an iOS call, a device change), the transport stops instead, because the audio clock freezes.
- **Mobile cell size:** about 36px at 390px wide, 34px at 375px, and 28px at 320px. That meets the WCAG 2.5.8 minimum (24px) but is below the 36px target in §4.3 at the narrowest widths.
- **Scene scaling:** the integer scale is computed in *device* pixels, so 2× and 3× phones get a crisp canvas that fills the width. On a 1× screen narrower than 320px the canvas falls back to 160×50 CSS px.
- **Idle "PRESS PLAY" label:** hidden when the canvas is narrower than 400 CSS px, where it would collide with the tower sign.
- **Grid semantics:** uses the `role="group"` + `aria-pressed` buttons option from §10, with a roving tabindex. DOM order is track-major, and CSS grid placement produces both layouts.

## 14. Acceptance criteria

**Sequencer**
- [ ] All 64 steps toggle by pointer, touch, and keyboard, and keep their state across play/stop and tempo changes.
- [ ] Toggling while stopped auditions the instrument (on-toggle only).
- [ ] Edits during playback take effect on the next pass without interrupting the transport.

**Audio and transport**
- [ ] The four voices are clearly distinguishable on laptop speakers and headphones.
- [ ] The loop is in time: 16 steps = 1 bar at the chosen BPM. Over 60 s at 180 BPM there is no audible drift.
- [ ] Stop silences at once, and no scheduled notes play after it.
- [ ] 20 Play/Stop clicks in about 5 s leave exactly one loop when it ends on Play, and silence when it ends on Stop.
- [ ] Changing BPM 60↔180 during playback doesn't glitch, skip, or double steps.
- [ ] No audio before the first user gesture. The blocked state is shown and recoverable.
- [ ] The tab-hidden and unmount paths leave no running timers, rAF loops, or open contexts (checked in DevTools).

**Visuals**
- [ ] The playhead and scene events match the audible beat (no perceptible lag on wired or built-in output).
- [ ] Each instrument triggers its own scene layer, and only when its note actually plays.
- [ ] Idle, playing, cleared-playing, and blocked scene states all appear correctly.
- [ ] The canvas is always integer-scaled (crisp pixels at every width).

**Accessibility and responsive**
- [ ] The whole experience is operable by keyboard alone, with a visible focus everywhere.
- [ ] VoiceOver announces the track, step, and pressed state for cells, a name and value for BPM, and Play/Stop state changes.
- [ ] Reduced motion removes movement, flicker, and glow decay, and keeps the playhead.
- [ ] No horizontal overflow at 320, 375, 768, 1024, or 1440px. Touch cells are ≥ 36px on mobile.
- [ ] Contrast targets in §10 are met (or adjustments are documented).

**8bitcn and shipping**
- [ ] Real 8bitcn components are used: Button, Slider, Card, Badge, Kbd, Alert. The README lists exactly which ones, and any local patches.
- [ ] No runtime errors in the console. No Google Fonts or other third-party requests at runtime.
- [ ] The README covers run commands, stack, design choices, and known limitations (Bluetooth latency, background tabs, iOS silent switch).

## 15. Explicitly out of scope for Day 001
Multiple presets beyond SIGNAL, mute/solo, swing, per-track volume, local-storage save, share URLs, audio export, paint-drag editing, accents/velocity, MIDI, and a richer multi-scene world. The stretch goals (only after MVP): global shortcuts, warm-up/blackout, Clear undo toast.


---

## V2.1 Amendment — Signal City Live: Interaction Specification

**Status:** ✅ APPROVED for implementation on 2026-11-23 (revised sprites, quiet crowd, motion personalities) · **Art direction:** [ART_DIRECTION.md → V2.1 Amendment](ART_DIRECTION.md#v21-amendment--signal-city-live) · **Roadmap:** [V2_ROADMAP.md](V2_ROADMAP.md) V2.1

**Scope:** performers, scene moments, and their interaction rules. **Not in V2.1:** curated presets (V2.2), sharing (V2.3), and mobile cell sizing (V2.4). The sequencer, audio engine, scheduler, transport controls, and 8bitcn components are **unchanged**, except where §V3 adds one event channel.

### V1. Change register (sections of this document affected)

| V1 section | Change | Type |
|---|---|---|
| §11 Scene specification | Adds performers, apartment windows, power line, ambient windows, and scene moments (see ART_DIRECTION change register C1–C7) | Extends / modifies C2, C3 |
| §7.1 Step toggle | Audition while stopped now also **performs** (the scene reacts to the audition sound) | Extends |
| §7.2 Transport | Play → switch-on. Stop → power-down. | Extends |
| §6 Controls (Clear, Groove) | Clear while playing → blackout. Groove while playing → ripple. Behavior of the controls themselves is unchanged. | Extends |
| §10 Accessibility | Adds a static text description of the scene for screen readers | Extends |
| §11 "Stretch: warm-up/blackout" | Blackout becomes core. Warm-up is deferred. | Modifies |
| §14 Acceptance | Adds the V2.1 criteria (§V7) | Extends |

### V2. Interaction specification

| User action | Audio | Grid | Scene | Live region |
|---|---|---|---|---|
| **Play** (from stopped) | Unchanged | Unchanged | **Switch-on** (4 frames, alongside the first beats), then performers respond to steps | "Playing at N BPM" (unchanged) |
| **Stop** | Unchanged (immediate silence) | Playhead cleared | **Power-down** (2 frames), then V1 idle | "Stopped" (unchanged) |
| **Step heard** (playing) | — | Playhead + hit flash (V1) | The performer for each sounding track hits. V1 layer reactions underneath. | — |
| **Toggle on** while stopped | Audition (V1) | Cell on | **The performer plays its hit once**, at the moment the audition sound is heard | — |
| **Toggle on/off** while playing | Heard on the next pass (V1) | Cell flips at once | No immediate reaction. The performer reacts when the step plays. | — |
| **Clear** while playing | Silence from the next step | All off | **Blackout** (4 frames). The city stays dark, the lamps keep sweeping, performers stay ready. The first added note → ambient windows return (2 frames). | "Pattern cleared" (unchanged) |
| **Clear** while stopped | — | All off | No scene change (already idle) | Unchanged |
| **Groove** while playing | New pattern from the next step | Updated | **Ripple** (3 frames). If coming from blackout, the city switches back on. | Unchanged |
| **Groove** while stopped | — | Updated | No scene change | Unchanged |
| **Tempo change** | From the next step (V1) | — | Pose durations follow the new step length from the next event | — |
| **Tab hidden** (auto-stop) | Stop | Cleared | Power-down | "Stopped: tab hidden" |
| **Audio blocked** (silent mode) | None | Plays | **Performers still perform** on the silent clock, so the world isn't dead | Unchanged |
| **Reduced motion** on | — | V1 rules | ART_DIRECTION V2.1 reduced-motion rules | — |

### V3. Timing and event rules (the non-negotiables)

1. **Performers move only in response to sound events**, and nothing else creates rhythmic motion. The two kinds of sound event are:
   - (a) scheduled `StepEvent`s drained by the render loop at the moment they're heard (V1);
   - (b) **audition events** (new): when an audition plays at audio time `t`, an event is queued and published by the same render loop when `t` is heard.
2. **Non-rhythmic cues** (switch-on, power-down, blackout, ripple) come from transport/UI state changes. They carry no beat timing, and their durations are fixed pixel-frame counts.
3. **Pose durations** derive from the triggering event's `duration` (the step length at schedule time), so tempo changes stay musically correct. The per-instrument formulas (the **motion personalities**: kick heavy, snare sharp, hi-hat quick, clap restrained) are defined in ART_DIRECTION V2.1 "Motion personalities and timing", and they're the single source of truth for pose timing.
3a. **Hierarchy rule:** performers render as dark silhouettes (`--actor` + rim) except during their instrument's hit window. The crowd body **never** turns ink. Its clap is arm poses plus violet hand pixels only.
4. **One render loop.** Step events → audition events → cues → `draw(now)`, all in the same frame, with timestamps in the frame timebase (Phase 0, D8).
5. **Stop clears everything** pending (step queue, audition queue, active poses), same as V1.

### V4. Architecture (implementation guidance, no new dependencies)

```
src/scene/
  city.ts         Orchestrator: static layers, V1 reactions, moments state machine, draw order
  sprites.ts      Pixel frames as string arrays → cached ImageBitmaps/canvases; draw helper
  performers.ts   Stomper, Residents, Birds, Crowd. Each is pure state + draw:
                    hit(now, stepMs)            // called from step/audition events
                    pose(now) → 'idle'|'ready'|'hit'|'recovery'   (pure, unit-tested)
                    draw(ctx, now, { dy, reducedMotion, lit })
```

**Scene moments state machine:**

```
idle ──Play──► switchingOn ──4 frames──► on ◄──note returns── dark
  ▲                                       │  ╲──Clear──► blackingOut ──4 frames──► dark
  └───────── poweringDown ◄──Stop─────────┴────────────────────────────────────────┘
```

**Hook additions** (`useSequencer`; no change to the scheduler or engine):
- `onCue(fn)` channel: `'cleared' | 'groove' | 'became-non-empty'`. These are emitted by the reducer-side actions.
- An audition event queue drained by the existing render loop.

**Performance:** no per-frame allocations in performer draw paths, and at most ~40 `fillRect` calls per performer per frame. The canvas stays at 160×50.

### V5. Accessibility

- The canvas stays `aria-hidden`. All state is still conveyed by the grid, controls, and live region. **No new announcements** (performers would be noise for screen reader users).
- **New:** a static, visually-hidden description next to the scene: *"Signal City: a pixel city that performs your beat. A robot stomps on the kick, a resident waves from a window on the snare, birds hop on the hi-hat, and a rooftop crowd claps on the clap."* This lets non-sighted users know what sighted users are seeing.
- Reduced motion per ART_DIRECTION V2.1. Contrast: performer bodies 5.07:1 against buildings and 5.26:1 against the sky [computed].

### V6. Verification plan (Chrome, as in V1 and Phase 0)

| Check | Method |
|---|---|
| Each performer reacts **only** to its drum | A canvas pixel probe over each performer's bounding box, over 2 bars of SIGNAL (expected steps: kick 0,6,8,13 · snare 4,12 · hat 0,2,4,6,8,10,12,14,15 · clap 12,15) |
| Reactions land on the heard step | Probe change observed in the same frame the grid playhead reaches that step (±1 frame) |
| Audition performs | Toggle a kick on while stopped → the Stomper region changes once, then returns |
| Switch-on / power-down / blackout / ripple | Region probes over time: complete within 4 frames (~330 ms) |
| Blackout recovery | Clear → dark; toggle a step on → ambient windows return |
| Tempo | At 60, 104, and 180 BPM: poses complete within one step, with no stuck hit poses |
| Rapid Play/Stop ×21 | No stuck poses; the state ends idle or playing as expected |
| Motion personalities | Probe each performer region at 0/25/50/85/130/200/300 ms after a hit at 104 and 180 BPM. Pose sequences and hold times match the ART_DIRECTION timing table (±1 frame). |
| Quiet crowd | During a clap, crowd-region pixels contain no `--ink` values. Violet appears only at hand positions. |
| Hierarchy | Idle and between-hits screenshots: no performer pixel brighter than `--actor-rim`, except hit windows |
| Reduced motion | No pixel translation in the Stomper/bird regions, no skyline drop, moments instant |
| Silent mode | Performers still react with no audio |
| Keyboard and existing behavior | The Phase 0 regression suite (timing, tempo, rapid toggle, focus rings, grid keyboard) |
| Unit | `pose(now)` transitions per performer, the moments state machine, and the audition queue drain |
| Visual review | Screenshots at desktop 6× and mobile 2×, reviewed by you |

### V7. V2.1 acceptance criteria

- [ ] Four performers exist as specified, each reacting **only** to its drum, on the step it's heard (probe-verified).
- [ ] Auditioning a step while stopped makes its performer react in time with the sound.
- [ ] Switch-on, power-down, blackout (with recovery), and ripple behave as specified and finish within 4 pixel frames.
- [ ] Empty, sparse (1 note), SIGNAL, and dense (all 64 on) patterns all look intentional, reviewed in screenshots.
- [ ] At 180 BPM no pose sticks or blurs, and at 60 BPM no pose lingers past its step.
- [ ] Reduced motion: no translation, flicker, or multi-frame moments, and every hit is still visible.
- [ ] Performers are legible at 2× (mobile) and 6× (desktop) with no scaling artifacts (integer device-pixel scale). You approve the screenshots.
- [ ] Motion personalities match the timing table at 104 and 180 BPM: kick holds then lands, snare snaps, hi-hat is the shortest pose with a neighbor flinch, clap rises and lowers with a stagger.
- [ ] The city stays the hero: at rest, performers are dark rim-lit silhouettes. During a clap the crowd bodies stay dark (violet hands only) and the BIT sign remains the brightest violet element.
- [ ] The composition matches ART_DIRECTION V2.1 coordinates. No building moved or resized, and no performer enlarged.
- [ ] No regressions: 8/8 existing tests pass plus new unit tests, the Phase 0 Chrome regression suite passes, and there are no console errors.
- [ ] The audio engine, scheduler, and sequencer grid are unchanged apart from the two hook channels in §V4.
- [ ] BUILD_STATUS.md is updated with what was verified and how.


---

## V2.2 — Playfulness: Curated Grooves + Remix Dice

**Status:** ✅ Implemented on 2026-11-23 per the V2.2 brief ("PLAY → REMIX"). Awaiting your review. **Scope:** PLAY and REMIX only. No City Energy, challenges, accounts, or sharing.

### Decisions (and deviations from V2_ROADMAP V2.2)

| # | Decision | Why |
|---|---|---|
| P1 | **4 grooves:** SIGNAL (starter, unchanged) + **BOOM BAP 90 · TECHNO 128 · BOSS FIGHT 150**. LO-FI dropped. | The brief asks for three presets. SIGNAL stays the approved first-visit groove. |
| P2 | Picker is an **8bitcn Toggle Group** (visible buttons), not a Select | All choices visible at once supports "understood within 5 seconds". One Tab stop with arrow keys (Radix roving focus). |
| P3 | Moods are **sky tints only**. The BIT sign doesn't change to "BOSS". | A 4-letter sign would change the approved tower geometry. The sign stays the brand anchor. |
| P4 | The GROOVE button (V1 §6) is replaced by the picker. Pressing the active groove again reloads it. | Restore-to-preset is still one click |
| P5 | **Undo** covers Remix, Clear, and groove changes (30-step history) | The brief requires a way to restore the previous pattern. Clear becomes safely undoable too. |
| P6 | Header tagline: "A tiny pixel world that performs the beat you make." | 5-second comprehension of the positioning |

### Curated grooves (1-indexed steps)

| Groove | BPM | Kick | Snare | Hi-hat | Clap | Mood (sky top / horizon) |
|---|---|---|---|---|---|---|
| SIGNAL | 104 | 1, 7, 9, 14 | 5, 13 | 8ths + 16 | 13, 16 | night (V1 `--sky-1/2`) |
| BOOM BAP | 90 | 1, 7, 11 | 5, 13 | 8ths + 16 | 13 | warm `#16111a / #241921` |
| TECHNO | 128 | 1, 5, 9, 13 | 16 | 3, 7, 11, 15 (offbeats) | 5, 13 | teal `#0b1419 / #0f222a` |
| BOSS FIGHT | 150 | 1, 3, 7, 9, 11, 15 | 5, 13, 14 | all 16ths | 5, 13 | red `#190c13 / #290f19` |

Grooves load immediately, even during playback: the pattern and BPM change from the next scheduled step and the transport isn't restarted. The mood swaps on the next frame. While playing, the V2.1 ripple runs.

### Remix Dice rules (`src/data/remix.ts`, pure + seeded in tests)

1. **Identity:** kick and snare notes on steps 1/5/9/13 of the chain's **origin** are anchors and never change. The origin is the pattern before the first of a run of consecutive remixes; any manual edit, Clear, groove change, or Undo starts a new run.
2. **Noticeable but coherent:** every roll changes **2–4 cells**, and at least one is on kick, snare, or clap.
3. **Musical moves only:** kick pickup ("a"/"and"), kick push/pull by one 16th, kick thinning, snare ghost (around backbeats), clap layer / fill clap, turnaround in the last beat, hat density ±.
4. **Caps:** kick ≤ 6, snare ≤ 4, clap ≤ 4 (or the origin's count if higher). A track that had notes is never emptied.
5. **Drift limit:** a run of rolls stays within **8 cells** of the origin. When needed, a roll first reverts toward the origin (restoring original notes first).
6. **Empty pattern:** Remix builds a simple backbone (kick 1, 9 · snare 5, 13 · 8th hats).
7. Remix during playback edits the pattern the scheduler reads. There's no transport restart, and timing is untouched.

### Remix feedback (UI response, not beat timing)

| Element | Normal motion | Reduced motion |
|---|---|---|
| Grid | Changed cells: added = ink ring pop, removed = fading track-color ghost, 3 stepped frames (360 ms) | Static ring for 420 ms, no animation |
| Die icon on REMIX | Tumbles through 3 faces (~180 ms), lands on the number of changes | Jumps to the result |
| City | "Dice tumble": 5 random windows flicker amber for 3 pixel frames | None |
| Live region | "Remixed: N changes. Undo available." · "Undid remix / clear / groove change. GROOVE, N BPM" · "BOOM BAP loaded, 90 BPM" | Same |

### Keyboard (additions to §9)

Tab order: PLAY → Tempo → **Groove picker** (one stop; ←/→ move, Enter/Space select) → **REMIX** → **UNDO** (skipped while disabled) → CLEAR → grid. All of them show the square 2px focus ring.

### V2.2 acceptance criteria

- [x] Each groove plays in time at its BPM, loads mid-playback with no skipped or repeated steps, updates the picker, mood, and readout, and is announced.
- [ ] **You approve the three new grooves by ear** (synthesized kit; not yet heard by a human).
- [x] Every Remix changes 2–4 cells, with at least one audible; anchors kept; drift ≤ 8; never empties a track; works during playback with no timing change.
- [x] Undo restores exact previous states in order (remix, clear, groove change) and is disabled when empty.
- [x] Remix feedback appears on exactly the changed cells; reduced motion removes the animation, tumble, and die roll.
- [x] Keyboard-operable picker, Remix, and Undo with visible focus.
- [x] No horizontal overflow at 375 px @ 2×. Picker buttons are 40 px tall.
- [x] V2.1 performers and audio sync unchanged (probe + regression suite).


---

## V2.3a — BIT LEAD synth + melody generator

**Status:** ✅ Implemented on 2026-11-23. Awaiting your review (listening). **Spec:** [V2_3_MELODY_PROPOSAL.md](V2_3_MELODY_PROPOSAL.md) (approved: editor B · melody off by default · pentatonic per groove · tower light · 3-step Chaos slider · review controls).

**Built (V2.3a only)**
- `src/audio/lead.ts`: BIT LEAD, a 25% pulse (PeriodicWave, per-context cache) with a 3 ms / 70 ms → 55% / 85% gate / 40 ms envelope, peak 0.16. Written against `BaseAudioContext`.
- `src/audio/chain.ts`: `createMasterChain(ctx)`, extracted from the engine with no behavior change, shared with future export.
- `src/data/melody.ts`: `generateMelody(groove, seed, drums)`. Minor pentatonic per groove (A / D / F / E), A A′ B A″ grammar, density bands, interval and leap limits, resolves to the root, avoids kick+snare steps. Seeded retries are validated against the same rules; a safe fallback motif is the last resort.
- Scheduler: `getMelody` / `triggerNote`. Notes use the drums' exact step time, `StepEvent.note` is set for future visuals, and silent mode skips the lead.
- Hook: melody state `{notes, seed, on}`, off on first load. A groove change loads its curated melody (seeds 421 / 90 / 128 / 150) and keeps on/off. NEW MELODY is undoable. Undo snapshots include the melody.
- **Temporary review controls** (transport, third row): `MELODY` toggle (`aria-pressed`, mint when on) · `NEW MELODY` · seed `#0421`. They're replaced by the Pitch Grid editor in V2.3b.
- Dev-only harness `dev/audio-smoke.html` (not in the production build): offline render, live output-onset measurement, and WAV renders for review.

**Not built yet (by design):** Pitch Grid editor + DRUMS/MELODY tabs + preview strip, the tower "elevator light", Remix Dice v2 / Chaos, product audio export. Clear doesn't affect the melody in V2.3a (to revisit with the editor).


---

## V3.1 — Living Music Toy (simplification)

**Status:** ✅ Implemented on 2026-11-24. Awaiting your review.
**Product direction:** *BEAT.BIT is a living music toy.* The core loop is **PLAY → REMIX → WATCH → EXPLORE**. It isn't primarily a rhythm scoring game.

### What changed from V3.0
| Area | V3.1 |
|---|---|
| Modes | **Sandbox is the default and only visible mode** |
| Arcade (Wake the City, XP, stars, ranks, F/J timing, pads, results) | Hidden behind the feature flag `FEATURES.arcade` (`src/config/features.ts`), **off** by default. Developers can enable it with `VITE_FEATURE_ARCADE=true`. **The code is kept, not deleted** (`src/data/arcade.ts`, `src/hooks/useArcade.ts`, `src/components/ArcadePanel.tsx`, and their 12 tests). With the flag off, nothing can start a challenge, F/J do nothing, and no progress is written. |
| Kits | **No locked states.** NEON DRIVE, PIXEL QUEST, NIGHT SHIFT, and BOSS RUSH are all directly selectable. Composed drums, bass, chords, and lead are unchanged. |
| Primary control | **One primary button: PLAY/STOP.** REMIX, UNDO, CLEAR, and the kit picker are secondary (outline). |
| Copy | Tagline: "A living music toy. Press play, remix, and watch the city move." Help text: switch kits, tap squares, or REMIX, and watch the city respond. |
| Kept | Drum-grid editing, Remix Dice + Undo, Clear (+ blackout), kit moods, the four performers and city moments, keyboard model, focus rings, reduced motion, scene description, live announcements |

### First-time experience (V3.1)
1. **Open BEAT.BIT.** The city is asleep. NEON DRIVE is loaded, and the grid shows its composed drums. PLAY is the only primary button.
2. **Press PLAY.** A **complete musical loop** starts at once (drums + bass + chords + lead). The city switches on.
   - Measured: first sound 322 ms after the click, which includes starting the audio context.
3. **Switch kits** (PIXEL QUEST, NIGHT SHIFT, BOSS RUSH) while it plays. The tempo, tune, and sky mood change from the next step.
4. **REMIX.** A small, musical variation, with the die, a grid ring, and a window tumble. UNDO is always one tap away.
5. **Watch the city respond.** The Stomper, resident, birds, and crowd perform each drum. Lamps follow the playhead.

### Acceptance (V3.1)
- [x] No Arcade UI is visible: no challenge card, rank, XP, stars, or pads. F/J are inert. Nothing is written to `localStorage`.
- [x] All kits are selectable while playing (tempo, tune, mood, announcement).
- [x] Press PLAY → full loop audible (drums + backing). Backing continues with the drums cleared.
- [x] Remix ×3 / Undo ×3 returns exactly to the start. Clear and Undo work.
- [x] Performers on the exact drum steps with 0-frame lag. Reduced motion keeps reactions without movement.
- [x] Focus ring on every control. Tab order starts at PLAY. Grid keyboard unchanged.
- [x] No horizontal overflow at 320 / 375 / 390 px.

---

## V3.3 — Download Beat (WAV export)

- **Where:** DOWNLOAD (outline Button, pixel arrow) after REMIX / UNDO / CLEAR. It opens an inline panel in the transport card. The panel is a disclosure, not a modal: `aria-expanded` / `aria-controls`, focus moves to the selected length, and Escape closes it and returns focus to DOWNLOAD.
- **Panel:**
  - LENGTH 4 / 8 / 16 bars (8bitcn Toggle Group, default 8);
  - FORMAT WAV (16-bit PCM, stereo, 44.1 kHz);
  - a one-line summary (kit, edited flag, BPM, bars, duration with tail);
  - DOWNLOAD WAV (primary Button, full width on phones);
  - progress (8bitcn Progress, retro) or "SAVED <filename>", or an inline error (`role=alert`). Each is also announced in the live region.
- **Cassette:** a 24×15 pixel cassette in the Oil 6 palette (only here for now). While rendering, its reel spokes swap frames every 250 ms; on save it does one small hop. Under `prefers-reduced-motion` it stays static.
- **Contract:**
  - The export renders what Sandbox plays, from bar 1 of the main section, whatever the playhead position: same voices, mix and master chain, offline.
  - The beat is captured when DOWNLOAD WAV is pressed.
  - The tail is max(2.5 s, 15 steps + 0.5 s).
  - The mix is not normalised.
  - Filename: `beatbit-<kit>-<bpm>bpm-<bars>bars.wav`.
