# BEAT.BIT — Claude Project Instructions

## Project identity
**Series:** 100 Days of Digital Craft  
**Mission:** Day 001 — Build a small, working 8-bit digital experience using **8bitcn**.  
**Concept:** BEAT.BIT, a playful browser-based pixel drum machine where music animates a tiny visual world.

Read `PROJECT_CONTEXT.md` in the parent project if present. This file is the local source of truth for BEAT.BIT.

## North star
Build a polished, shareable interactive artifact that demonstrates creative direction, audio engineering, responsive interaction, and motion craft—not a generic music dashboard. Make a compact tool that feels like an arcade instrument: tactile, legible, fast, and delightful.

## Collaboration protocol
1. Inspect the existing repository, dependencies, and project instructions first.
2. Summarize what exists and identify gaps; do not overwrite existing work without permission.
3. Propose a concise implementation plan, including component structure, audio approach, risks, and milestones.
4. **Ask for approval before installing dependencies, changing files, or beginning implementation.**
5. Implement in small, testable stages; show how to run and verify each milestone.
6. Be candid about what is working, untested, or incomplete.
7. When design choices are ambiguous, present 2–3 options with a recommendation; prioritize craft and feasibility.

## Experience concept
The user enters a dark, retro-futurist 8-bit studio. A 16-step grid is the central instrument. Tapping steps creates patterns; pressing Play makes the cursor sweep through them. Kick, snare, hi-hat, and clap produce distinct sounds. Each triggered note creates a synchronized pixel animation: pulses, bouncing sprites, flashes, or a small reactive skyline. The interface should feel playable within seconds, even to someone who has never used a drum machine.

**Signature moment:** Press Play on a populated pattern and the pixel world visibly comes alive in time with the beat.

## Visual and motion direction
- A restrained retro-arcade aesthetic: deep charcoal/near-black background, muted neon accents, crisp pixel edges, and carefully balanced negative space.
- Pixel typography for short labels and titles; readable sans-serif for dense information where needed.
- 8bitcn components should be used meaningfully for controls and framing. Check current library docs/API before implementation; do not assume component names or props.
- Step cells have clear off, on, playing, hover/focus, and pressed states.
- Motion is rhythmic and purposeful: quick tactile presses, a clear playhead, restrained pulses, and a visually distinct response for each instrument.
- Avoid overusing glow, random effects, and distracting animation. Respect `prefers-reduced-motion`.
- Desktop-first composition with a genuinely usable mobile layout; maintain touch targets and readable contrast.

## MVP — required working features
1. **16-step × 4-track sequencer:** Kick, Snare, Hi-hat, Clap. Toggle each step independently.
2. **Play / Stop:** Reliable looping playback with an obvious playhead and transport state.
3. **Tempo control:** BPM adjustable within a sensible range (suggest 60–180), with visible value.
4. **Sound:** Distinct, audible percussion generated via Web Audio or Tone.js; no copyrighted audio assets required.
5. **Pattern controls:** Clear pattern and load one useful starter groove so the experience is immediately demonstrable.
6. **Reactive pixel visualization:** Triggered notes drive at least one meaningful synchronized visual effect.
7. **Audio activation:** Handle browser autoplay restrictions by starting/resuming audio only after a user gesture; provide a useful muted/blocked state.
8. **Accessibility:** Keyboard-operable controls, meaningful labels, visible focus, accessible play/stop state, and reduced-motion support.
9. **Responsive layout:** Works at common desktop and mobile widths without horizontal overflow or unusable cells.
10. **8bitcn integration:** Incorporate the mission's UI library, and document which components are actually used.

## Technical approach (proposed, verify with repository)
- React + TypeScript + Vite.
- 8bitcn and its required styling/tooling.
- Tone.js for transport and synthesized percussion **if compatible and justified**; otherwise use Web Audio API with lookahead scheduling.
- CSS animations or lightweight Canvas for the visualizer. Do not add Three.js merely for novelty.
- Keep sequence data separate from playback scheduling and rendering.
- Use a stable clock or scheduled audio events rather than relying on `setInterval` alone for musical timing.
- Synchronize the UI playhead and reactive effects with the audio timeline as closely as practical.
- Clean up transport events, synths, and audio nodes on teardown; avoid duplicate scheduling after repeated Play/Stop.

### Suggested structure
```text
src/
  components/
    SequencerGrid.tsx
    TransportControls.tsx
    TrackLabel.tsx
    PixelVisualizer.tsx
  audio/
    engine.ts
    instruments.ts
  data/
    patterns.ts
  hooks/
    useSequencer.ts
  styles/
    tokens.css
```
Adjust to the actual repository; do not create architecture for its own sake.

## Interaction details
- Step toggles give immediate visual confirmation even while stopped.
- Playback highlights the current column without obscuring which steps are active.
- Clicking Play repeatedly must not layer duplicate loops.
- Tempo changes should apply without breaking timing.
- Clearing or editing a pattern during playback should behave predictably.
- Visualizer effects should correspond to real note triggers, not a disconnected looping animation.
- Provide a useful empty-state cue or a preset groove to help first-time users.

## Scope boundaries
**Must ship:** working sequencer, real audio, responsive pixel UI, synced visual feedback, 8bitcn integration.

**Only after MVP:** multiple presets, mute/solo, swing, volume per track, pattern save/load via local storage, shareable pattern URL, export audio, keyboard shortcuts, richer pixel scenes.

**Out of scope for Day 001:** DAW-grade editing, accounts, backend, sample marketplace, AI generation service, complex 3D world, and multi-user collaboration.

## Build milestones
1. **Discovery + plan:** inspect project and library; agree on architecture and visual direction.
2. **Playable core:** grid state, transport, BPM, real sound, starter pattern.
3. **Craft pass:** 8bitcn styling, interaction states, pixel visualizer, motion.
4. **Quality pass:** accessibility, responsive layouts, timing and lifecycle edge cases.
5. **Ship pass:** README, deployment instructions, screenshots/demo guidance, and X post draft.

## Acceptance checklist
- [ ] Every grid step can be toggled and retains state correctly.
- [ ] Four tracks produce distinguishable sounds.
- [ ] Playback loops through all 16 steps in time with BPM.
- [ ] Stop reliably silences or halts scheduled playback.
- [ ] Rapid Play/Stop does not create duplicate audio or broken state.
- [ ] Visual feedback matches the beat.
- [ ] Starter pattern and Clear work.
- [ ] Interface uses real 8bitcn components.
- [ ] Mobile and desktop are usable.
- [ ] Keyboard/focus/reduced-motion behavior is checked.
- [ ] No critical runtime errors or obvious memory leaks.
- [ ] README explains run commands, stack, design choices, and limitations.

## Publication package
Prepare (do not claim published unless verified):
- A live demo link after deployment.
- Repository/source link.
- A 10–20-second screen recording showing pattern editing, playback, and the reactive pixel world.
- 2–3 strong screenshots.
- A short build log: concept, visual inspiration, technical challenge, what AI helped with, what the designer decided, and next improvement.
- An X post labeled **DAY 001 / 100 — BEAT.BIT** with a strong hook and actual links.

## Creative quality bar
This should feel like a tiny instrument worth playing, not a tutorial exercise. Prioritize a compelling central interaction, rhythmic motion, coherent visual art direction, and clean execution. Challenge generic solutions and keep the first version shippable in a day.

## First response requested from Claude
Before writing code: inspect the project, summarize findings, propose 2–3 visual directions and a recommended implementation plan, list dependencies and tradeoffs, then ask for approval to proceed.
