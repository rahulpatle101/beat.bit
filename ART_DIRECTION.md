# BEAT.BIT — Art Direction

**Day 001 / 100 Days of Digital Craft** · Stage 2 of 4
**Status:** ✅ APPROVED on 2026-11-23 with **Direction A: Signal City**
**Builds on:** [RESEARCH.md](RESEARCH.md) · **Feeds:** [DESIGN.md](DESIGN.md)

## Approved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Visual direction | **A · Signal City** |
| 2 | Sound identity | **Clean, analog-inspired synthesized kit** |
| 3 | Secondary typeface | **Readable sans-serif** (proposed: IBM Plex Sans, see Typography) |
| 4 | Accumulation stretch | **Yes, included as a stretch goal** |
| 5 | Scope | BEAT.BIT is the Day 001 project. The hard requirement is **using 8bitcn**. |

---

## Concept

> *A city block at 2 a.m. Your beat is its power grid.*

The user is at a quiet arcade cabinet in a dark room. The interface is mostly black space and soft warm ink, and **color appears only where sound is**. When stopped, the city is dark apart from one blinking window. Press Play and the city switches on in rhythm. Each instrument powers a different part of it, so you can *read the beat in the skyline*.

**Anti-goals:** synthwave sunsets, chrome horizon grids, rainbow glow, random particles, "retro filter" noise, and CRT scanlines over the whole UI.

## Shared foundations

- **Three zones on one screen:** the **Scene** (pixel city), the **Sequencer** (4×16 grid), and the **Transport** (Play/Stop, BPM, Groove, Clear).
- **8bitcn** frames and controls everything: Card, Button, Slider, Badge, Kbd, Alert. Step cells are custom buttons in the same 4px pixel-border language.
- **Base unit is 4px.** All spacing, borders, and bevels are multiples of it.
- **Beat grouping:** the 16 steps fall in 4 groups of 4, with alternating group shading.
- **Pixel-honest motion:** note onsets are instant, and decays move in stepped frames (`steps()` / a ~12 fps scene cadence). There are no smooth easing tweens on pixel elements.
- **One glow treatment**, reserved for "this note is sounding now."
- **Fonts are self-hosted.** Press Start 2P is for short labels only.

## Typography

| Role | Face | Use | Rules |
|---|---|---|---|
| Display | **Press Start 2P** (ships with 8bitcn, self-hosted) | Logo, track names, button labels, BPM digits, badges | Uppercase, ≥10px mobile / ≥12px desktop, ≤ ~14 characters per label, letter-spacing 0.5px |
| Text | **IBM Plex Sans** **[A: OFL, self-host via @fontsource]**. The fallback is `system-ui` | Hints, status messages, the audio notice, the footer/credits | 14–16px, weights 400/500 only |

*Why Plex Sans:* it's engineered and slightly technical without being a cold default like Inter, and it sits well next to a pixel face. A zero-dependency alternative is the plain `system-ui` stack.

## Palette

| Token | Hex | Role |
|---|---|---|
| `--void` | `#0D0E12` | Page background |
| `--panel` | `#16181E` | Card surfaces |
| `--cell` | `#22252D` | Step off (odd beat groups) |
| `--cell-alt` | `#1C1F26` | Step off (even beat groups) |
| `--ink` | `#E6E1D3` | Primary text, borders, focus ring |
| `--ink-dim` | `#7C7F88` | Secondary text **[A: check contrast on --panel, 4.5:1 target]** |
| `--kick` | `#E8615A` | Kick: muted coral |
| `--snare` | `#F0B54A` | Snare: amber |
| `--hat` | `#5CC6D3` | Hi-hat: teal-cyan |
| `--clap` | `#A88BF2` | Clap: soft violet |
| `--sky-1` / `--sky-2` | `#0F1220` / `#141830` | Scene sky (2-tone ordered dither) |
| `--building` | `#1A1D26` | Unlit buildings |

These map onto the shadcn CSS variables (`--background`, `--foreground`, `--primary`, `--ring`, and so on), so 8bitcn components inherit the palette without being forked.

## Track identity (color + glyph + scene layer)

| Track | Color | Glyph (8×8 px) | Scene layer |
|---|---|---|---|
| Kick | coral | ▮ solid block | Ground: the skyline drops 1px, the street flashes |
| Snare | amber | ▚ checker | Windows: a cluster lights up |
| Hi-hat | teal | ▴ small triangle | Sky: antenna blink, star twinkle |
| Clap | violet | ✚ cross | Sign: a neon sign flickers on |

## Pixel treatment

- 4px hard borders (8bitcn). Step cells have a 1-unit bevel: lighter top-left, darker bottom-right.
- An "on" cell fills with the track color, and its glyph is knocked out in `--void`. That means state isn't signaled by color alone.
- The scene is a **160×50 logical-pixel canvas** (16:5), integer-scaled with `image-rendering: pixelated`.
- Dither only for the sky gradient, nowhere in the UI.

## Sound identity

A clean, analog-inspired kit synthesized with Web Audio. No samples, no bitcrush.

| Voice | Character |
|---|---|
| Kick | Round, with a short click, a pitch sweep of ~150 → 45 Hz, and ~400 ms decay |
| Snare | Snappy noise with a tonal body around 180 Hz |
| Hi-hat | Crisp and short (~50 ms), high-passed noise |
| Clap | A 3-burst stutter about 10 ms apart, with a band-passed tail |

A master bus with a gentle compressor (`DynamicsCompressorNode`) keeps levels consistent on laptop and phone speakers. Tuning is time-boxed to 45 minutes.

## Animation language

| Instrument | Scene response | Reduced-motion version |
|---|---|---|
| **Kick** | The skyline drops 1px and returns in 2 stepped frames. The street line flashes coral. | The street line flashes only. No movement. |
| **Snare** | 3–6 random windows light amber and fade over ~3 steps. | They light and fade with no randomized flicker. |
| **Hi-hat** | The antenna light blinks teal, and one star twinkles. | The antenna blinks only. |
| **Clap** | The tower's neon sign flickers on (2 frames) in violet, then holds briefly. | The sign turns on and off without flickering. |
| **Playhead** | A row of 16 street lamps along the bottom, where the current lamp is lit. | Unchanged, because it's information. |
| **Stopped/idle** | The city is dark. One window cursor blinks at ~1 Hz, with a "PRESS PLAY" prompt. | The window stays lit with no blink. |

**UI motion:** the button press translates 4px (8bitcn's built-in active state). A step toggle snaps in one frame. Sounding cells get a 1-frame brightening plus a soft glow of 2 units that decays within one step.

## Signature interactions

1. **The city wakes up.** Press Play on the starter groove and the lights come on in rhythm within the first bar.
2. **You can see your edits land.** Toggle a clap step while playing and a new neon flicker appears on the next pass.
3. **(Stretch) The city warms up.** While the pattern stays unchanged, lit windows linger a little longer each bar, up to 4 bars. Any edit resets the warm-up. **Clear** triggers a left-to-right **blackout**.

## Alternatives considered (not chosen)

- **B · Pocket Phosphor.** An amber handheld LCD with a dancing sprite character and chiptune sounds. It had the highest art cost (about 12 sprite frames), and its track-select model hid three of the four tracks. We kept one idea from it: strict glyph-per-track identity and a living idle state.
- **C · Night Garden.** A pattern that "plants" a garden which grows each loop. It was the most original, but it carried more sprite and state work and a weaker "instrument" framing. Its accumulation idea lives on in the stretch above.
