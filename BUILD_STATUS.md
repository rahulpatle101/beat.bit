# BEAT.BIT — Build Status (V1 Audit)

**Audited:** 2026-11-23 · **Commit:** `97252ff` (main) · **Auditor:** Claude, with automated checks
**Scope:** The implementation as shipped. This document records findings only; nothing was changed during the audit.

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
| Reactive scene (Signal City) | ✅ Working and synced to scheduled notes |
| Autoplay / blocked / tab-hidden handling | ✅ Working |
| Responsive layout | ✅ No overflow 320–1280px. ⚠️ Mobile cells below the 36px target |
| Accessibility | ⚠️ **Two WCAG failures** (focus visibility, non-text contrast). VoiceOver untested. |
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
