# BEAT.BIT — Research

**Day 001 / 100 Days of Digital Craft** · Stage 1 of 4 (Research → Art Direction → Experience Design → Implementation)
**Date:** 2026-11-23 · **Status:** Draft for review

## How to read this document

Every finding is tagged:

- **[V] Verified:** checked this session against the source (a docs page, the 8bitcn registry JSON, or the npm registry).
- **[R] Reported:** found in a secondary source (article, review, tutorial) and not independently checked.
- **[A] Assumption:** my professional judgment or memory, not checked this session. It needs a check during implementation.

---

## 1. Project state

| Item | Finding |
|---|---|
| Repository | [V] Empty apart from `CLAUDE.md`. No `package.json`, no git repo, no prior code. Nothing gets overwritten. |
| Series context | [V] `PROJECT_CONTEXT.md` lists the official Day 001 options as *link page, quote generator, designer calculator*. BEAT.BIT was one of six explored concepts, and the recommendation at the time was *Player One*. `CLAUDE.md` in this folder commits to BEAT.BIT, so I treat it as the selected concept. **Flag:** if the challenge requires one of the three official options, decide that now. |
| Tooling | [V] Node 24.2.0, npm 11.11.0, pnpm 9.0.0 are installed. |
| Current package versions | [V] (npm registry, today) vite 8.3.8 · tailwindcss 4.3.5 · shadcn CLI 4.23.0 · tone 15.1.22 · @radix-ui/react-slider 1.6.1. All are MIT-licensed. |

---

## 2. 8bitcn: what it really is

I read the docs pages and then pulled the raw registry files (`https://www.8bitcn.com/r/{name}.json`), because the code blocks didn't render in the fetched docs.

### Verified facts

- **[V] It's a shadcn/ui registry, not an npm package.** You install with `pnpm dlx shadcn@latest add @8bitcn/<name>`, which copies source into `components/ui/8bit/`. That means **we own and can edit the component code**, and it matters for the accessibility fixes below.
- **[V] Each 8bit component wraps a shadcn base component.** For example, `registryDependencies: ["button"]` pulls in `@/components/ui/button`, so the project needs a working shadcn setup first (Tailwind, `components.json`, `@/` path alias, `cn()` util).
- **[V] shadcn has an official Vite installation path** (`ui.shadcn.com/docs/installation/vite` returns 200). The 8bitcn docs don't mention Vite. The README says only that the `@/components/ui/8bit` alias is "common in Next.js and similar frameworks". **[A]** It should work in Vite once the alias is configured. Confirm with a smoke test in milestone 1.
- **[V] Styling comes from Tailwind utility classes and shadcn CSS variables** (`bg-foreground`, `border-ring`, `bg-primary`, and so on). Retheming means setting shadcn tokens, not overriding 8bitcn internals.
- **[V] The pixel look is built from absolutely positioned border `div`s** (`border-y-4`, `border-x-4`) layered over a square-cornered base. There are no images, so it scales crisply.
- **[V] Font:** `styles/retro.css` loads **Press Start 2P via a Google Fonts `@import`** and defines `.retro` and `.pixelated` (`image-rendering: pixelated`). Components default to `font: "retro"`, and Button/Toggle/Card take `font="normal"`.
- **[V] Available components** (docs sidebar): Accordion, Alert, Alert Dialog, Avatar, Badge, Breadcrumb, Button, Button Group, Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Combo Box, Command, Context Menu, Date Picker, Dialog, Drawer, Dropdown Menu, Empty, Enemy Health Display, Health Bar, Hover Card, Input, Input OTP, Item, Kbd, Label, Mana Bar, Menubar, Navigation Menu, Pagination, Popover, Progress, Radio Group, Resizable, Retro Mode Switcher, Scroll Area, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Spinner, Switch, Table, Tabs, Textarea, Theme Selector, Toast, Toggle, Toggle Group, Tooltip, XP Bar.
- **[V] There are no audio or music components.** The sequencer grid, the visualizer, and the transport behavior are ours to build.
- **[V] Button props:** `variant` (default | secondary | destructive | outline | ghost | link), `size` (default | sm | lg | icon), `font` (retro | normal), `asChild`.
- **[V] Toggle** wraps Radix Toggle, so `aria-pressed` and Space/Enter come built in. It has `active:translate-x-1 translate-y-1`, a nice tactile press.
- **[V] Slider** wraps `@radix-ui/react-slider`, so arrow keys, Home/End, and PageUp/PageDown come built in.
- **[V] License:** MIT.

### Issues found in the source (not in the docs)

| # | Issue | Impact | Mitigation |
|---|---|---|---|
| 1 | [V] `retro.css` `@import`s Google Fonts at runtime | It's an external request to a third party, can cause a font flash or layout shift, and breaks offline use. | Self-host Press Start 2P (it's OFL **[A]**) and edit the copied `retro.css`. |
| 2 | [V] The Slider wrapper doesn't expose Thumb props | **[A]** Radix puts the accessible name on the Thumb, so `aria-label` passed to Root may never reach the focusable element. | Patch the local `slider.tsx` to forward a `thumbProps` / `aria-label`. Verify with the accessibility tree. |
| 3 | [V] Slider applies `className` to both the wrapper and Root | Minor styling duplication. | Fix while patching. |
| 4 | [V] Files start with `"use client"` | **[A]** Vite/Rollup may log "module level directive" warnings. They're harmless. | Ignore or suppress. |
| 5 | [V] Decoration is layered `div`s | 64 decorated Toggles would add roughly 4–5 extra DOM nodes per cell. That's manageable, but heavy for a cell that re-renders on every playhead tick. | Build step cells as a custom `<button>` that uses the same tokens and pixel-border language. Keep 8bitcn for controls and framing. |

### Recommended 8bitcn usage (meaningful, not decorative)

| Need | 8bitcn component |
|---|---|
| Play/Stop, Clear, Load groove | `Button` (+ `Kbd` hint for shortcuts) |
| Tempo | `Slider` (patched for a11y) + a numeric readout |
| Instrument/scene framing | `Card` |
| Transport/audio status ("AUDIO OFF", "PLAYING", "♩ 112") | `Badge` |
| Preset picker (stretch) | `Toggle Group` |
| Audio-blocked notice | `Alert` |
| Bar/loop progress (optional) | `Progress` or `XP Bar`, as a playful reuse of the game components |

---

## 3. Classic drum machines and step sequencers

| Reference | Insight | Tag |
|---|---|---|
| **Roland TR-808** (c. 1980–83; sources disagree on the dates) | Defined "TR-style" step programming: choose an instrument, then press 16 step buttons. LEDs run across the steps to show the playhead, and you can edit **while the pattern runs**. Roland says this method "became the standard for electronic rhythm programming." | [R] Sound on Sound, Animagraffs, Roland |
| **TR-808 step colors** | The 16 buttons come in 4 color groups of 4, which reads as beats in a bar. I found no source for what the colors meant. | [A] (well known, not verified) |
| **Roland CR-78** | Roland calls it the first computer-controlled programmable drum machine, the precursor to the TR style. | [R] Roland |
| **Teenage Engineering Pocket Operators** | 16-step sequencer, 16 pattern slots, chaining. **Custom segmented LCDs with playful character animations** that react to the music. That's close to our "tiny world comes alive" idea, built with very few pixels. | [R] Wikipedia, retailers |
| **Chrome Music Lab Song Maker** | Grid-click note entry that works with no music training and no account, plus a shareable URL. Proof that "playable in seconds" is achievable. | [R] Google blog, TechCrunch |
| **Step-sequencer accessibility** | NYU MusEDLab notes that typical grid sequencers are pointer-only with "no standard UI elements that screen readers can parse." This is a known gap in the genre and an opportunity for us. | [R] NYU MusEDLab |

**Design insights**

1. **The 4×4 beat grouping is the most important legibility device.** Even a non-musician can see "1 _ _ _ 2 _ _ _". Use subtle alternating shading per beat group. [A]
2. **The running light is the instrument's heartbeat.** Its timing must be perfect, because any visible lag makes the whole thing feel broken.
3. **Edit-while-playing is the core loop**, not a nice-to-have. A toggle has to take effect on the next pass without restarting the transport.
4. **Character beats chrome.** Pocket Operators prove that a tiny animated scene is more delightful than meters and spectrums.

---

## 4. Pixel-art interface principles

| Principle | Implication | Tag |
|---|---|---|
| Integer scaling only | Size the canvas at a low resolution (e.g. 160×90 or 128×72) and scale it by whole numbers with CSS `image-rendering: pixelated`. Non-integer scales blur or produce uneven pixels. | [A] |
| One pixel grid per surface | Mixing pixel sizes (a 4px border next to 3px sprite pixels) reads as sloppy. Pick a base unit (4px) and stick to it. | [A] |
| Limited palette | 8–12 colors total. Restraint is what makes it look intentional rather than "retro filter." | [A] |
| Pixel fonts are wide and low-legibility at small sizes | Press Start 2P needs roughly ≥10–12px and short labels only. Use a readable font for anything longer than a few words. | [A] |
| Glow is a seasoning | Use one glow treatment, reserved for the "now playing" state. | [A] (matches CLAUDE.md) |

---

## 5. Music-interaction patterns

| Pattern | Use in BEAT.BIT | Tag |
|---|---|---|
| **Pre-loaded groove** | Load a starter pattern on first visit. Play is then the only step between a visitor and the signature moment. | [A] / brief |
| **Audition on toggle** | Play the instrument sound when a step is switched *on* while stopped. It gives instant feedback and teaches which row makes which sound. | [A] |
| **Paint-drag** | Pointer-down then drag to set or clear several steps. A common sequencer affordance, but it adds complexity. **Stretch.** | [A] |
| **Accent/velocity** | Out of scope for Day 001. | — |
| **Tempo by direct number + slider** | The slider covers coarse changes and arrow keys cover ±1 BPM. Tap-tempo is a stretch. | [A] |
| **Per-track identity** | Each row needs a consistent color **and** shape/icon, so the sequencer doesn't depend on color alone. | [A] / WCAG 1.4.1 |

---

## 6. Browser audio technology

### The core timing problem — [V]/[R]

Chris Wilson's *A Tale of Two Clocks* (web.dev) is the canonical reference. JavaScript timers (`setTimeout`/`setInterval`) are too jittery to trigger notes. The fix is a **lookahead scheduler**:

- A JS timer wakes up every ~25 ms.
- On each wake, it schedules every note that falls within the next ~100 ms, at exact `AudioContext.currentTime` values.
- The audio thread then plays them sample-accurately.

The same article pairs this with a **note queue**. `requestAnimationFrame` reads `currentTime` and draws whichever notes have "become now." That's exactly how we sync the playhead and visuals to the audio.

### Option comparison

| | **Raw Web Audio + custom scheduler** | **Tone.js 15.x** |
|---|---|---|
| Timing | Lookahead scheduler, roughly 60–100 lines **[A]** | `Tone.Transport` + `Sequence`, built in [R] |
| Drum synthesis | Hand-built: oscillator pitch sweep (kick), noise + tone (snare), filtered noise (hat/clap) [R] | `MembraneSynth`, `NoiseSynth`, `MetalSynth` presets **[A]** |
| Bundle | Zero dependencies | Large. Measure in the build **[A]** |
| Visual sync | We own the note queue | `Tone.Draw.schedule()` exists **[A]**, plus one more abstraction to learn |
| Tempo change mid-play | We control it: the next scheduled step uses the new interval | `Transport.bpm` ramps [R] |
| Lifecycle risk | We have to get start/stop/cleanup right ourselves | Transport events and `dispose()` have known gotchas with duplicate scheduling **[A]** |
| Learning value | High: this is the real skill | Medium |
| Autoplay | `ctx.resume()` on a gesture | `Tone.start()` on a gesture [R] |

**Recommendation: raw Web Audio with a lookahead scheduler.** The scope is small (4 voices, 16 steps, one tempo). Owning the clock makes play/stop idempotence and visual sync explicit and easy to test. There are no dependencies, and the craft story is better for the build log. Tone.js stays the fallback if synthesis quality or timing turns into a time sink.

### Drum synthesis recipes — [R] (Opera Dev, ez-web-audio, Kabisa, SEN LLC)

| Voice | Recipe |
|---|---|
| **Kick** | Sine oscillator, frequency swept roughly 150 Hz → 40–50 Hz over ~100–150 ms, with a gain envelope that has a fast attack and ~300–500 ms decay. |
| **Snare** | White-noise buffer through a high-pass (~1 kHz) with a short envelope, plus a triangle/sine "body" around 180 Hz with a quick decay. |
| **Hi-hat** | Noise (or 6 detuned square oscillators, the classic 808-style approach **[A]**) through a high-pass/band-pass around 7–10 kHz, very short decay. Sources call it the hardest voice to synthesize well. |
| **Clap** | A noise burst through a band-pass (~1–1.5 kHz), retriggered **3–4 times about 10 ms apart**, then a longer tail. **[A]** That stutter is what makes it read as "clap" rather than "snare." |
| **Noise source** | Web Audio has no noise node, so create one shared `AudioBuffer` of random samples once and reuse it. [R] |

### Other browser constraints

- **[R]** The AudioContext starts `suspended` until a user gesture. Call `resume()` inside the Play click handler, and show a clear "tap to enable audio" state.
- **[A]** iOS Safari: hardware silent mode can mute Web Audio. Mention it in the blocked/muted UI copy ("Check your ringer switch").
- **[A]** `AudioContext.outputLatency` (where supported) lets visuals subtract output delay for tighter sync. Bluetooth headphones add 150 ms or more, which we can't fully fix.
- **[A]** Background tabs throttle timers to ~1 s, so the scheduler will stutter or stop. Pause or stop playback on `visibilitychange`, or accept and document it.

---

## 7. Accessibility patterns

| Finding | Application | Tag |
|---|---|---|
| APG toolbar/grid use a **roving tabindex**: one Tab stop for the composite, arrows move inside it | The 4×16 grid is a single Tab stop. Arrow keys move between cells, Home/End jump to the ends of a row. | [V] W3C APG |
| Toggle buttons use **`aria-pressed`**, and Enter/Space toggle them | Each step is `<button aria-pressed>`. | [V] W3C APG |
| Grid role semantics for interactive cells | Decide between `role="grid"` (with row/gridcell wrappers) and a simpler group of labelled rows. That decision belongs in DESIGN.md. | [V] APG (pattern exists) / [A] (choice) |
| Labels need context | e.g. `aria-label="Kick, step 5"`, with state carried by `aria-pressed`. Don't announce "playing" on every tick, because that floods screen readers. | [A] |
| `prefers-reduced-motion` | Keep the playhead (it's information). Replace bounces, shakes, and particles with short opacity/color changes. | [A] |
| Non-color cues | Track glyphs and the "on" state shown by fill *and* shape. | [A] / WCAG 1.4.1 |

---

## 8. Opportunities

1. **An accessible sequencer is rare.** A keyboard- and screen-reader-operable grid is a real differentiator, not box-ticking.
2. **The scene is the hook, not the grid.** Every comparable web sequencer looks like a spreadsheet of lights. A tiny world reacting per instrument is what makes people share it.
3. **One visual system per instrument.** If the kick, snare, hat, and clap each move a *different element* of the scene, the visual stays legible as music, rather than a generic pulse.
4. **8bitcn's game components (XP Bar, Health Bar)** can be used wittily, e.g. a loop-progress bar that "levels up" each bar. Optional.
5. **Frame-accurate sync story** ("the visuals are scheduled on the audio clock") is a strong technical point for the build log.

## 9. Technical risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 8bitcn + Vite + Tailwind v4 setup friction | Medium | Milestone 1 is a smoke test: one 8bitcn Button rendering in Vite before anything else. |
| Playhead/visual drift from audio | Medium | Note queue read by rAF against `ctx.currentTime`. No `setInterval` drives the UI. |
| Duplicate loops on rapid Play/Stop | Medium | A single scheduler instance, an idempotent `start()`, and `stop()` that clears the timer and disconnects any scheduled-but-unplayed nodes. |
| React re-rendering all 64 cells on every step | Medium | Keep the playhead out of React state. Update a CSS variable or `data-` attribute on the grid from the rAF loop. |
| Hi-hat/clap sounding weak | Medium | Time-box synthesis tuning to ~45 min. The fallback is Tone.js MetalSynth/NoiseSynth. |
| Press Start 2P legibility on mobile | Low–Medium | Pixel font for short labels only, with a readable secondary font. |
| Slider accessible name | Low | Patch the local component (see §2). |
| Scope creep into a "richer scene" | High | Fix the scene's element count in ART_DIRECTION.md before building. |

## 10. Recommendations carried into Art Direction

1. React + TypeScript + Vite + Tailwind v4 + shadcn + 8bitcn (Button, Slider, Card, Badge, Kbd, Alert; Toggle Group optional).
2. Raw Web Audio with a lookahead scheduler and synthesized voices. Tone.js is the fallback.
3. A low-res Canvas 2D visualizer (integer-scaled), driven by the audio-clock note queue.
4. Custom step cells built on 8bitcn's token and border language.
5. A roving-tabindex grid with `aria-pressed` toggles.
6. Each instrument drives a distinct element of the scene.

---

## Sources

**8bitcn & tooling**
- [8bitcn docs](https://8bitcn.com/docs) · [8bitcn GitHub](https://github.com/TheOrcDev/8bitcn-ui) · registry JSON `https://www.8bitcn.com/r/{button,slider,toggle,card}.json` (read directly)
- [shadcn registry index](https://ui.shadcn.com/docs/changelog/2025-09-registry-index) · [shadcn CLI 3.0 namespaced registries](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp) · [shadcn Vite install](https://ui.shadcn.com/docs/installation/vite)

**Audio**
- [A Tale of Two Clocks — web.dev](https://web.dev/articles/audio-scheduling)
- [IRCAM Web Audio tutorials — timing & scheduling](https://ircam-ismm.github.io/webaudio-tutorials/scheduling/timing-and-scheduling.html)
- [Tone.js GitHub](https://github.com/Tonejs/Tone.js) · [tone-learn notes](https://github.com/vibertthio/tone-learn) · [WAAClock](https://github.com/webmedia-lab/WAAClock)
- [Synthesising Drum Sounds with the Web Audio API — Opera Dev](https://dev.opera.com/articles/drum-sounds-webaudio)
- [Synthesising Sounds with Web Audio — Sonoport](https://sonoport.github.io/synthesising-sounds-webaudio.html)
- [Browser Beats I (kick) — Kabisa](https://dev.to/kabisasoftware/browser-beats-i-synthesizing-a-kick-drum-1gej) · [Browser Beats II (snare, hat)](https://dev.to/kabisasoftware/browser-beats-ii-synthesizing-a-snare-drum-and-a-hi-hat-463h)
- [Sample-free drum synthesis — SEN LLC](https://dev.to/sendotltd/sample-free-drum-synthesis-in-web-audio-building-kick-snare-and-hi-hat-from-oscillators-in-60-2c0k) · [ez-web-audio synth drum kit](https://sethbrasile.github.io/ez-web-audio/examples/synth-drum-kit.html)

**Drum machines & sequencers**
- [Sound on Sound — Roland TR-808 retrospective](https://www.soundonsound.com/reviews/roland-tr808) · [Roland TR-808 specs](https://support.roland.com/hc/en-us/articles/201963539-TR-808-Technical-Specifications) · [CR-78: The Whole Story — Roland](https://articles.roland.com/?p=75463) · [Roland TR-8](https://www.roland.com/products/tr-8/) · [Animagraffs TR-808](https://animagraffs.com/roland-tr-808-rhythm-composer)
- [Pocket Operators — Wikipedia](https://en.wikipedia.org/wiki/Pocket_Operators) · [CDM on PO rhythm sounds](https://cdm.link/heres-tes-59-pocket-operator-rhythm-sounds-work/) · [POG8 (GB Studio sequencer)](https://jonathanneels.itch.io/pog8)
- [Chrome Music Lab — Google blog](https://blog.google/topics/education/simple-music-making-everyone/) · [TechCrunch on Song Maker](https://techcrunch.com/2018/03/02/googles-song-maker-experiment-makes-making-songs-easy/amp/)

**Accessibility**
- [W3C APG Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid) · [W3C APG Toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) · [NYU MusEDLab — QWERTYBeats research](https://wp.nyu.edu/musedlab/?p=62)
