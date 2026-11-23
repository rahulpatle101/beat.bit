# BEAT.BIT — Art Direction

**Day 001 / 100 Days of Digital Craft** · Stage 2 of 4
**Status:** ✅ V1 APPROVED on 2026-11-23 with **Direction A: Signal City** · ✅ **V2.1 amendment (Signal City Live) APPROVED on 2026-11-23**, see [the end of this document](#v21-amendment--signal-city-live)
**V3.2 (proposed):** the pixel world moves to the **Oil 6** palette, see [V3.2 Addendum](#v32-addendum--oil-6-pixel-world). This is awaiting approval.
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


---

## V2.1 Amendment — Signal City Live

**Status:** ✅ APPROVED for implementation on 2026-11-23 (final visual sign-off): revised sprites, crowd = dark bodies + violet hands, composition, motion personalities.
**Source:** [V2_DIRECTIONS.md](V2_DIRECTIONS.md) (Direction A) · **Positioning:** *A tiny pixel world that performs the beat you make.*
**Reference renders:** the composition preview (rendered from the real `src/scene/city.ts` on the 160×50 grid). The coordinates and sprites below are the ones the preview used.

Everything above this section stays in force unless a row in the **Change register** says otherwise.

### Guiding rule

**The city is the hero.** The lit windows, the BIT sign, and the street are the visual anchors. Performers are **dark silhouettes** that recede into the city at rest and **only brighten when their instrument sounds**. Color still appears only where sound is (V1 rule).

### Change register (what this amendment changes in the approved V1 direction)

| # | V1 decision | V2.1 change | Type |
|---|---|---|---|
| C1 | One layer per instrument (ground, windows, sky, sign) | Each instrument also gets a **performer**. All V1 layer reactions stay underneath (skyline drop, street flash, antenna, star twinkle, sign flicker). | Extends |
| C2 | Snare lights 3–6 random small windows | Snare lights **one apartment window with a resident** plus **3** small windows | **Modifies** |
| C3 | While playing, the city is lit only by hits | While playing, **8 ambient windows** glow at **30% amber**. Snare hits are full amber plus a resident, so they stay clearly distinct. Stopped stays dark (V1 unchanged). | **Modifies** |
| C4 | Blackout on Clear was a stretch goal | **Blackout is core** in V2.1 | Promotes |
| C5 | "Warm-up" stretch | **Deferred** (C3 covers "the city is alive") | Defers |
| C6 | Palette | Adds performer tokens (below). No existing token changes. | Extends |
| C7 | City geometry | Adds a power line and **3 apartment windows formed by merging existing 2×2 window blocks** (the gaps between four small windows are filled). **No building is moved or resized.** Static change vs V1 idle: 186 of 8,000 px (2.3%), all additions. | Extends |

### Composition (exact, 160×50 logical px)

| Element | Position (logical px) | Size | Notes |
|---|---|---|---|
| **Stomper** (kick) | top-left at (19, 32), feet on y = 43 | 9×12 | Front-left on the street, in front of building 2. It's the only performer **not** shifted by the skyline drop (it causes the drop). |
| **Rooftop Crowd** (clap) | 4 figures at x = 47, 52, 57, 62, standing on building 4's roof (y = 14) | 4×4 each (6 tall on clap) | Left of the tower. The antenna (x = 77) stays unobstructed. |
| **Power line** | (117, 17) → (138, 19), sag 3 px | 1 px | Between buildings 7 and 9. Color `#2e313a`. |
| **Wire Birds** (hi-hat) | x = 120, 125, 130, 134, sitting on the wire | 4×3 each | |
| **Apartment windows** (snare) | (16, 22) building 2 · (94, 26) building 6 · (149, 21) building 9 | 6×6 each | Each is a 2×2 block of existing V1 windows merged into one window |
| **Ambient windows** | 8 fixed V1 windows chosen by seeded random. Never on the tower, apartment windows, or behind the Stomper. | 2×2 | 30% amber while playing |
| Tower, BIT sign, antenna, lamps, street | Unchanged (V1) | — | — |

**Hierarchy check (from the preview):**
- **Idle:** the dark city leads, with one blinking window. Performers are rim-lit silhouettes.
- **Between hits:** the ambient windows lead.
- **Strong beat:** the Stomper (ink), the snare window (amber), and the BIT sign (violet) carry the frame. The crowd adds only small violet hand pixels.

### Performers: sprites (final, from the preview)

Legend: `#` body · `c` visor · `V` hand accent · `e`/`E` bird eye · (`.` transparent). For residents, `#` is the `--void` silhouette on the amber window.

```
STOMPER 9×12
 idle          ready         HIT           land (recovery)
 .........     ...###...     .........     .........
 ...###...     ..#####..     ...###...     ...###...
 ..#ddd#..     ..#ccc#..     ..#CCC#..     ..#ccc#..
 ..#####..     ..#####..     ..#####..     ..#####..
 .#######.     .#######.     #########     .#######.
 #.#####.#     #.#####.#     ..#####..     #.#####.#
 #.#####.#     #.#####.#     ..#####..     ..#####..
 ..#####..     ..#####..     .##...##.     ..#####..
 ..##.##..     ..##.##..     .##...##.     .##..##..
 ..##.##..     ..##.##..     .##...##.     .##..##..
 ..##.##..     ..##.##..     .##...##.     .##..##..
 .###.###.     .###.###.     ###...###     .###.###.
               (+2 dust px each side on HIT, 1 on land)

RESIDENT 6×6 (inside a lit window)      BIRD 4×3                 CROWD FIGURE 4 wide
 lit/rest     CHEER                      asleep  ready  HOP(+1px)  sit    ready   half    FULL
 ......       #.##.#                     ....    .##.   .##.       ....   .##.    V..V    V..V
 ..##..       #.##.#                     .##.    #e##   #E##       .##.   .##.    .##.    #..#
 ..##..       .#..#.                     ####    .#..   .#..       ####   ####    .##.    .##.
 ......       .####.                                                      ####    ####    .##.
 .####.       .####.                                                              ####    ####
 .####.       ......                                                                      ####
```
*The resident CHEER pose is the current best. Final tuning happens during implementation, with a recognizable reaction prioritized over anatomy (your decision 5).*

### Color and lighting

| Token (new) | Value | Use |
|---|---|---|
| `--actor` | `#3b3f4a` | Performer body at rest (dark silhouette) |
| `--actor-rim` | `#6e727c` | 1 px rim light on body pixels whose top or left neighbor is empty |
| `--actor-mid` | `#6e727c` | Body during recovery ("cooling down") |
| `--actor-hi` | `#e6e1d3` (= `--ink`) | Stomper and hopping bird on their hit frames only |
| `--visor-idle` / `--visor-ready` | `#2e2224` / `#4a2826` | Stomper visor when stopped / playing. Near-black red, not a glow. |
| `--wire` | `#2e313a` | Power line |

- **Hit accents use track colors only:** coral visor (kick), amber window (snare), teal bird eye (hi-hat), **violet hands (clap)**.
- **The crowd stays dark on clap.** The celebration reads through arm poses and violet hand pixels, and the bodies never turn ink. The BIT sign stays the brightest violet element.
- **Ambient windows (C3):** amber at 30%. Snare light runs at 100% → 60% → 30% over 3 steps (V1 fade), so a snare is always brighter than ambient at its onset.
- There's no new glow (the V1 single-glow rule holds).

### Motion personalities and timing

All durations are measured from the moment the sound is heard. `s` = the step length of the triggering event. Onsets render on the next frame.

| Instrument | Character | Pose sequence | Timing | At 104 BPM (s = 144 ms) | At 180 BPM (s = 83 ms) |
|---|---|---|---|---|---|
| **Kick** | **Heavy, grounded.** All motion is downward: it holds the impact, then rises in two stages. | HIT (squash, wide stance, dust, ink body, coral visor) → LAND (upright, mid tone, 1 dust px) → ready | hit `min(167 ms, 0.65 s)` · land `min(83 ms, 0.3 s)` | 94 ms → 43 ms | 54 ms → 25 ms |
| **Snare** | **Sharp, expressive.** Snaps on and snaps off, with no in-between frame. | CHEER (arms up, window full amber) → lit bust → light fades | cheer `min(83 ms, 0.4 s)` · light 100/60/30% over `3 s` | 58 ms, light to 432 ms | 33 ms, light to 249 ms |
| **Hi-hat** | **Quick, nervous.** The shortest pose in the scene; the neighbors flinch. | The next bird in turn HOPS (+1 px, ink, teal eye) while its neighbors' eyes flick bright → ready | hop `min(50 ms, 0.35 s)` | 50 ms | 29 ms |
| **Clap** | **Celebratory, restrained.** Arms rise, hold, and lower, with a slight left-right stagger. | HALF (hands above head) → FULL (arms up) → HALF → ready. Figures 2 and 4 start `min(40 ms, 0.25 s)` later. | half `min(83 ms, 0.35 s)` · full until `0.9 s` | 50 → ~130 ms → 180 ms | 29 → ~75 ms → 104 ms |
| Skyline drop (V1) | Kept as the kick's world response | 1 px drop | `min(167 ms, 0.7 s)` | 101 ms | 58 ms |

**Pixel-art rules:**
- Integer positions only.
- At most 1 px of displacement (except pose swaps).
- No sub-pixel, smoothing, or easing.
- Pose holds are quantized as above.
- A retrigger always restarts the pose.
- Performers never move without a sound event.

### Signature moments

| Moment | Trigger | Sequence (normal motion) | Reduced motion |
|---|---|---|---|
| **City switches on** | Play | Over 4 pixel frames (~330 ms), alongside the first beats and never delaying them: the visor goes from idle to ready, the birds open their eyes left→right, the crowd stands, ambient windows fade in left→right | Everything at once, in 1 frame |
| **Blackout** | Clear while playing | Ambient and lit windows go off column by column, left→right, over 4 frames. The sign goes dark. Performers stay ready. The lamps keep sweeping. When the pattern has a note again, the ambient windows return over 2 frames. | Instant off and instant on |
| **Groove ripple** | Groove while playing | Ambient windows flash once left→right (3 frames) | None |
| **Power down** | Stop | Performers go to idle over 2 frames, then V1 idle (one blinking window) | Instant. No blink (V1). |
| **Audition performs** | A step toggled on while stopped | Its performer plays its hit once, timed to the audition sound. Playback doesn't start. | Pose/color only |

### Reduced motion

`prefers-reduced-motion: reduce`:
- **No translation:** no skyline drop, no bird hop, no Stomper squash (the Stomper shows the LAND/mid-tone body with a coral visor instead), and no clap stagger.
- **Allowed:** pose swaps within the sprite's footprint (crowd hands at HALF only, resident cheer) and color changes.
- **Removed:** sign flicker, star twinkle, idle blink, ripple, and multi-frame switch-on/blackout.
- **Kept:** the playhead lamps. Every hit still produces a visible change for its instrument.

### Responsive coexistence and mobile

- The layout is unchanged (scene → transport → grid). The canvas stays 160×50 at integer device-pixel scale. **Performers aren't enlarged, and city proportions don't change.**
- **At 2× (phones), verified in the preview:**
  - The Stomper reads clearly (18×24 CSS px).
  - The birds and crowd read through motion and accent pixels.
  - The resident window reads as an amber block with a reaction.
  - There are no scaling artifacts: frames are drawn at exactly 2 device px per logical px.
- The grid track glyphs remain the non-color identity, and the grid doesn't animate performers.

### Deliberately not added
- Extra characters, buildings, scenes, weather, parallax, or camera moves.
- Idle "dancing". Performers move only on sound.
- New glow, and colors outside the token set.


---

## V2.2 Addendum — Groove moods

**Status:** ✅ Implemented on 2026-11-23 (approved V2 decision 7: "lightweight palette and atmosphere variations").

Each curated groove tints the **sky only**: the two-tone dither pair behind the skyline. Buildings, windows, performers, the BIT sign, and all UI tokens are unchanged, so contrast and the "city is the hero" hierarchy hold.

| Groove | Mood | Sky top / horizon |
|---|---|---|
| SIGNAL | night | V1 `#0f1220 / #141830` |
| BOOM BAP | warm | `#16111a / #241921` |
| TECHNO | teal | `#0b1419 / #0f222a` |
| BOSS FIGHT | red | `#190c13 / #290f19` |

The BIT sign stays "BIT" (a "BOSS" sign would change the approved tower geometry). Remix adds a 3-frame "dice tumble" in the windows: amber, restrained, and off with reduced motion.


---

## V2.3 Addendum — Melody color and the tower "elevator light"

**Status:** ✅ Approved on 2026-11-23 (V2_3_MELODY_PROPOSAL.md §5). Token added in V2.3a; the city visual is planned for V2.3b.

- New track color **`--lead: #6fcf97`** (muted mint), for melody only: 8.06:1 on an empty cell, dark glyph on mint 10.15:1 [computed]. Used now for the MELODY toggle's on state.
- **Elevator light (V2.3b):** the tower's 6 window rows below the BIT sign map to the 6 scale degrees. Each note lights the two centre windows of its row in `--lead` for the note's length, with a 2-frame fade (instant with reduced motion). No new performer, sky change, or glow. The four performers stay the stars.

---

## V3.2 Addendum — Oil 6 pixel world

**Status:** ⏳ PROPOSED on 2026-11-24, awaiting approval. Studies only: the production renderer (`src/scene/city.ts`) and the UI are unchanged.
**Replaces** the earlier SLSO-CLR17 palette proposal, which was never implemented.
**Palette:** [Oil 6 by GrafxKid](https://lospec.com/palette-list/oil-6).
**Previews:** run `npm run dev`, then open `/dev/oil6.html`. The PNG exports are listed in §8 below.

### 1. The palette and its roles

| # | Hex | Name | Main roles |
|---|---|---|---|
| 0 | `#272744` | navy | Night sky top, nearest silhouettes, figure bodies, outlines |
| 1 | `#494d7e` | indigo | Night horizon, far skyline, unlit windows, street/lamps at night |
| 2 | `#8b6d9c` | mauve | Moon-glow horizon, rain streaks, wet street, daylight buildings, sunset sky top |
| 3 | `#c69fa5` | dusty rose | Night rim light ("moon rim"), sign glow, sunset middle sky, daylight far skyline |
| 4 | `#f2d3ab` | peach | Lit windows, skin, lamp halo, sunset horizon and clouds, street rim at sunset |
| 5 | `#fbf5ef` | cream | **Reserved for the brightest moments:** moon/sun, hit frames (stomper, bird eye, hat star), snare windows, lit playhead lamp |

The code is in `src/scene/oil6.ts`:
- `OIL6` holds the six colours.
- `WorldRoles` holds the semantic roles: sky stops, orb, clouds, buildings plus lit edge, far skyline, windows (off / lit / hit), sign, wire, street, lamps, performers (body / sky rim / street rim / hit), track accents, character ramp, rain, reflection and haze.
- `WORLDS` holds the four light settings.

### 2. Rules

1. **Only six colours in the pixel world, and no alpha.** The current renderer uses alpha (30% windows, 35% stars, glows), which produces off-palette colours. In Oil 6, every in-between tone is a **4×4 Bayer ordered dither** between two palette neighbours: sky gradients, haze, lamp halos, cloud edges and reflections.
2. **Lighting is value-led, not hue-led.** Light settings differ by redistributing the six colours across roles (§3), not by adding tints.
3. **Cream is the beat.** At rest, cream appears only on the moon or sun. On a hit it marks what played: the stomper's body, the bird's eye, a star or the antenna, snare windows, and the playhead lamp. The beat is therefore the brightest thing in the scene in every setting.
4. **Silhouettes get a rim that depends on what's behind them:**
   - figures against the **sky** (crowd, birds) use `actorRim`;
   - figures against **buildings** (stomper, character) use `actorRimStreet`.

   One rim for both failed readability, because the rim matched the sky in Sunset. Sunset sky figures are pure backlit silhouettes with no rim.
5. **Track identity in the scene comes from place, shape and motion, not hue.** Kick = the street stomper and street line, snare = apartment windows, hi-hat = birds, star and antenna, clap = rooftop crowd and the BIT sign. The UI grid keeps its track hues and glyphs (see Decision 3 in §9).

### 3. The four light settings (same composition)

| | Moonlit Night | Warm Sunset | Rainy Night | Soft Daylight |
|---|---|---|---|---|
| Sky (top → horizon) | navy → indigo → mauve glow | mauve → rose → peach, with peach streak clouds | indigo → mauve (city glow), navy cloud bellies | rose → peach → cream, with cream puff clouds |
| Orb | Cream crescent moon, upper right | Cream sun **behind** the skyline | None | Small cream sun, upper left |
| Buildings / lit edge | navy / indigo on the right (moon side) | indigo / mauve along roof tops (backlit) | navy / none (flat, wet) | mauve / rose on the left (sun side) |
| Far skyline | indigo | mauve, peach haze at the base | indigo, mauve haze | rose, peach haze |
| Windows (off / lit / hit) | indigo / peach / cream | navy / peach / cream | indigo / peach / cream | indigo / peach / cream |
| Figures (body / sky rim / street rim) | navy / rose / rose | navy / none / peach | navy / rose / rose | navy / navy (solid) |
| Weather | Stars (rose), the hat star in cream | — | 3 px slanted mauve streaks (rose on hats), wet mauve street with dithered reflections, cream kick splashes | — |
| Pixel share at rest (navy / indigo / mauve / rose / peach / cream) | mostly navy and indigo | balanced across all six | navy and indigo with mauve | mauve, rose and peach |

### 4. Readability (measured)

Method: the share of a sprite's outline pixels that differ from the background pixel next to them by **at least 2 Oil 6 value steps**. Each study was rendered with and without the sprite.

| Setting | Character | Stomper | Crowd | Birds |
|---|---|---|---|---|
| Moonlit (rest / beat) | 0.77 / 0.73 | 0.87 / 0.89 | 1.00 / 0.80 | 0.86 / 1.00 |
| Sunset | 0.75 / 0.76 | 0.74 / 0.89 | 1.00 / 1.00 | 0.63 / 0.96 |
| Rainy | 0.84 / 0.82 | 0.73 / 0.89 | 0.83 / 0.77 | 0.83 / 1.00 |
| Daylight | 0.78 / 0.86 | 0.73 / 0.92 | 1.00 / 0.89 | 0.65 / 0.70 |

- **Colour census:** each of the 8 frames uses exactly the 6 Oil 6 colours, with **0 off-palette pixels**.
- **Iteration:** the first pass failed:
  - Moonlit buildings merged with the sky;
  - Rainy Night was noise;
  - the Sunset crowd and birds scored 0.32 because the rim matched the sky;
  - the Daylight stomper scored 0.18.

  The final role mapping fixes all four.
- **Weakest remaining points:**
  - birds at rest in Sunset (0.63) and Daylight (0.65), which are still clearly visible at 4×;
  - the 1×-size character in Rainy Night, where streaks pass close by (rain is drawn *behind* figures for this reason).

### 5. The character (proposal used in the studies)

- An original 8×14 figure placed in front of building 6: headphones, hair, skin, a jacket with a zip highlight, trousers and shoes.
- Two poses:
  - **rest**;
  - **groove hit**: arm up, knee bent, and the headphone pixel turns cream.
- Character ramp per setting:
  - dark: navy;
  - skin: peach;
  - jacket: mauve (night), rose (sunset/rain) or cream (daylight, where a darker jacket scored 0.47);
  - highlight: cream (indigo in daylight).

At the proposed 192×108 canvas it grows to about 14×22 with the same ramp.

### 6. Current artwork vs Oil 6

| | Current Signal City | Oil 6 studies |
|---|---|---|
| Mood | Low-key, near-black, "city at 3 am". Murky at rest: the scene almost disappears. | Atmospheric and nostalgic, closer to painted pixel art. A readable city at rest in all four settings. |
| Beat feedback | Strong through saturated hue pops (coral, amber, teal, violet) | Strong through **value**: cream and peach against a darker field. It's slightly less "colour-coded", but each hit still lands in its own place. |
| Variety | 4 moods = 4 near-black sky tints, which are hard to tell apart | 4 genuinely different worlds from the same 6 colours |
| Cohesion with UI | Matches today's UI tokens | Clashes softly with the saturated UI track colours until the UI is aligned (Decision 3) |
| Technical | Alpha blending | Strict palette, dither only. This is cheaper to pre-render as tiles for the scrolling city. |

**Recommendation: adopt Oil 6 for the pixel world.**
- **Moonlit Night** becomes the default/home setting: the calmest, with the strongest beat contrast and the most "BEAT.BIT".
- **Warm Sunset** is the hero image for screenshots and the X post: it's the most striking frame.
- Map one light setting per kit, replacing the current near-black tints. This also matches the existing `mood` field:
  - NEON DRIVE (`warm`) → **Warm Sunset**
  - PIXEL QUEST (`night`) → **Soft Daylight**: a bright chiptune adventure; rename the mood to `day`
  - NIGHT SHIFT (`teal`) → **Moonlit Night**
  - BOSS RUSH (`red`) → **Rainy Night**: tension and drive
- With the future WORLD button, any setting can be combined with any kit.

### 7. Applying Oil 6 to the V3.2 plans

**Horizontally scrolling city (parallax):**
- **Aerial perspective by value:** the further a layer is, the closer its value is to the horizon sky.
  - At night: far skyline indigo → mid buildings navy, with lit windows → street navy → foreground navy with a rim.
  - In daylight it inverts: far rose → mid mauve → foreground indigo or navy.
- Each layer uses at most **3** of the six colours (body, edge, and one light), so layers never compete with the performers.
- Seeded chunks are pre-rendered per light setting as palette-exact tiles. Changing the setting swaps the role table and re-renders the tiles; nothing is tinted at runtime.
- Signage: original pixel words in rose (lit) / indigo (off), always 3×5 letters like the BIT sign.

**Groove-specific character animation:**
- The character ramp is fixed per light setting (§5). Groove styles change **motion and accent pixels, not colours**:
  - NEON DRIVE: a funk strut, with a cream headphone flash on accented hats;
  - PIXEL QUEST: a hop-skip, with cream shoes on the jump;
  - NIGHT SHIFT: a house shuffle, with the jacket zip flashing on offbeat hats;
  - BOSS RUSH: a charge, with a cream outline frame on the crash.
- **Hit frames always use cream.** Ghost notes use peach. Velocity maps to value (accent → cream, normal → peach, ghost → rose).
- Reduced motion: pose swaps only. The colour flash stays, because it is information, not motion.

**Weather effects:**
- **Rain:** 1 px wide, 3 px slanted streaks in the rain colour (mauve), capped at about 85–120 at 160×50. Hi-hats switch about 1 in 6 to rose. Kicks put cream 1 px splashes on the street line.
- **Reflections:** lit windows and signs mirror into the street band as **broken dashes on alternate rows**, using a 50% dither. Never alpha, never a solid block.
- **Fog/haze:** a Bayer ramp of the haze colour over the far layer's lower 8–10 px. It can thicken in breakdowns (music energy → haze level).
- **Lightning (optional):** one frame where the sky stops shift one step lighter. It's suitable only for BOSS RUSH drops, and it's off with reduced motion.
- **Reduced motion:**
  - rain becomes static streaks (no fall);
  - splashes and lightning are off;
  - reflections stay static.

### 8. Preview files

All are in the scratchpad (regenerate them with `oil6.pngs()` on `/dev/oil6.html`):

`/private/tmp/claude-501/-Users-rahulpatle-Documents-101Dev-100-Days-of-Digital-Craft-day-001-8bitcn-experiment-beat-bit/f8782503-0cd1-4214-a79b-e7e85a40cc64/scratchpad/oil6/`
- `oil6-contact-sheet-4x.png`: the current artwork plus the 4 studies, rest | beat, at 4×.
- `oil6-actual-size-1x.png`: all five on the beat at true 160×50 pixels.
- `png/`: 20 individual frames (current plus 4 studies × rest/beat × 1×/4×).

### 9. Decisions needed

1. **Adopt Oil 6 for the pixel world** (recommended), with Moonlit Night as the default?
2. **One light setting per kit** (mapping in §6), or one global setting chosen with WORLD?
3. **The UI:** keep today's UI tokens and track hues for now (recommended: scene first, then evaluate), or re-theme the UI to Oil 6 as well? Re-theming means track colours become **value plus glyph** (four distinguishable colours out of six, with the glyphs carrying identity), and contrast must be re-checked.
4. **Approve the street-rim / sky-rim rule and the 8×14 character proposal** as the base for V3.2b.
