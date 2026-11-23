// The 4×16 instrument (DESIGN.md §5, §7.1, §8.1, §9.2).
//
// - DOM order is track-major (Kick 1–16, Snare 1–16, ...), which is the logical reading order.
//   The visual position comes from CSS grid placement, so the mobile "two 8-step blocks"
//   layout doesn't change the DOM or the keyboard model.
// - Semantics: role="group" of toggle buttons (aria-pressed) with a roving tabindex.
//   Each button's name carries its track and step, so track labels are presentational.
// - The playhead and hit flashes are applied by toggling classes on cell refs from the
//   step subscription. The current step never causes a React render.

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { STEPS, TRACKS, type Pattern, type TrackId } from '@/data/patterns'
import type { RemixListener, StepListener, TransportListener } from '@/hooks/useSequencer'
import { TrackGlyph } from './TrackGlyph'
import './sequencer.css'

interface Props {
  pattern: Pattern
  onToggle: (track: TrackId, step: number) => void
  onStep: (fn: StepListener) => () => void
  onTransport: (fn: TransportListener) => () => void
  onRemix: (fn: RemixListener) => () => void
  /** V3.0 Arcade: cue states for the current bar, keyed `${track}:${step}`; grid editing is locked. */
  cues?: Map<string, 'open' | 'perfect' | 'great' | 'good' | 'miss'>
}

const ROWS = TRACKS.length

/**
 * Grid placement. Columns include a narrow spacer track after every 4 steps (beat groups).
 * Desktop: one row per track, 16 steps.  Mobile: two blocks of 8 steps, each with a header row.
 */
const col = (i: number) => 2 + i + Math.floor(i / 4)
const place = (t: number, s: number) =>
  ({
    '--rd': t + 1,
    '--cd': col(s),
    '--rm': s < 8 ? t + 2 : t + 7,
    '--cm': col(s % 8),
  }) as CSSProperties

export function SequencerGrid({ pattern, onToggle, onStep, onTransport, onRemix, cues }: Props) {
  const cells = useRef<(HTMLButtonElement | null)[]>([]) // index = t * STEPS + s
  const [focus, setFocus] = useState({ t: 0, s: 0 })
  const register = useCallback((i: number, el: HTMLButtonElement | null) => {
    cells.current[i] = el
  }, [])

  // Playhead + hit flash, driven by real scheduled steps.
  useEffect(() => {
    let current = -1
    const clearColumn = () => {
      if (current < 0) return
      for (let t = 0; t < ROWS; t++) {
        cells.current[t * STEPS + current]?.classList.remove('is-current')
      }
    }
    const offStep = onStep((ev) => {
      clearColumn()
      current = ev.step
      for (let t = 0; t < ROWS; t++) {
        const el = cells.current[t * STEPS + ev.step]
        if (!el) continue
        el.classList.add('is-current')
        if (ev.tracks.includes(TRACKS[t].id)) {
          // Restart the hit animation even if it ran on the previous loop.
          el.classList.remove('is-hit')
          void el.offsetWidth
          el.style.setProperty('--step-ms', `${Math.round(ev.duration * 1000)}ms`)
          el.classList.add('is-hit')
        }
      }
    })
    const offTransport = onTransport((on) => {
      if (!on) {
        clearColumn()
        current = -1
        for (const el of cells.current) el?.classList.remove('is-hit')
      }
    })
    return () => {
      offStep()
      offTransport()
    }
  }, [onStep, onTransport])

  // V2.2 Remix: changed cells get a short stepped "roll" ring (on = ink pop, off = ghost).
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const off = onRemix((changes) => {
      for (const ch of changes) {
        const t = TRACKS.findIndex((tr) => tr.id === ch.track)
        const el = cells.current[t * STEPS + ch.step]
        if (!el) continue
        el.classList.remove('is-rolled')
        void el.offsetWidth // restart the animation on repeated rolls
        el.dataset.rolled = ch.on ? 'on' : 'off'
        el.classList.add('is-rolled')
        const id = setTimeout(() => {
          el.classList.remove('is-rolled')
          timers.delete(id)
        }, 420)
        timers.add(id)
      }
    })
    return () => {
      off()
      for (const id of timers) clearTimeout(id)
    }
  }, [onRemix])

  const moveFocus = useCallback((t: number, s: number) => {
    const nt = Math.min(ROWS - 1, Math.max(0, t))
    const ns = Math.min(STEPS - 1, Math.max(0, s))
    setFocus({ t: nt, s: ns })
    cells.current[nt * STEPS + ns]?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const { t, s } = focus
    const mod = e.ctrlKey || e.metaKey
    switch (e.key) {
      case 'ArrowRight':
        moveFocus(t, s + 1)
        break
      case 'ArrowLeft':
        moveFocus(t, s - 1)
        break
      case 'ArrowDown':
        moveFocus(t + 1, s)
        break
      case 'ArrowUp':
        moveFocus(t - 1, s)
        break
      case 'Home':
        if (mod) moveFocus(0, 0)
        else moveFocus(t, 0)
        break
      case 'End':
        if (mod) moveFocus(ROWS - 1, STEPS - 1)
        else moveFocus(t, STEPS - 1)
        break
      default:
        return
    }
    e.preventDefault()
  }

  return (
    <div
      role="group"
      aria-label={cues ? 'Challenge: the drums of the current bar; your cues are marked' : 'Drum pattern: 4 tracks by 16 steps'}
      aria-describedby="seq-help"
      className="seq"
      onKeyDown={onKeyDown}
    >
      {/* Block headers (mobile only) */}
      <span className="seq-block-label seq-block-label--a retro" aria-hidden="true">
        STEPS 1–8
      </span>
      <span className="seq-block-label seq-block-label--b retro" aria-hidden="true">
        STEPS 9–16
      </span>

      {/* Track labels: a second copy for the mobile lower block */}
      {TRACKS.map((track, t) =>
        (['a', 'b'] as const).map((block) => (
          <span
            key={`${track.id}-${block}`}
            aria-hidden="true"
            className={`seq-label seq-label--${block}`}
            style={
              {
                '--rd': t + 1,
                '--rm': block === 'a' ? t + 2 : t + 7,
                color: `var(--${track.id})`,
              } as CSSProperties
            }
          >
            <TrackGlyph track={track.id} className="seq-label-glyph" />
            <span className="seq-label-name retro">{track.name.toUpperCase()}</span>
          </span>
        )),
      )}

      {/* Beat numbers (desktop/tablet) */}
      {[0, 4, 8, 12].map((s) => (
        <span
          key={s}
          aria-hidden="true"
          className="seq-beat retro"
          style={{ '--cd': col(s) } as CSSProperties}
        >
          {s + 1}
        </span>
      ))}

      {TRACKS.map((track, t) =>
        pattern[track.id].map((on, s) => (
          <StepCell
            key={`${track.id}-${s}`}
            track={track.id}
            trackName={track.name}
            t={t}
            s={s}
            on={on}
            tabbable={focus.t === t && focus.s === s}
            onToggle={onToggle}
            cue={cues?.get(`${track.id}:${s}`)}
            onFocusCell={setFocus}
            register={register}
          />
        )),
      )}
    </div>
  )
}

interface CellProps {
  track: TrackId
  trackName: string
  t: number
  s: number
  on: boolean
  tabbable: boolean
  onToggle: (track: TrackId, step: number) => void
  cue?: 'open' | 'perfect' | 'great' | 'good' | 'miss'
  onFocusCell: (pos: { t: number; s: number }) => void
  register: (i: number, el: HTMLButtonElement | null) => void
}

const StepCell = memo(function StepCell({
  track,
  trackName,
  t,
  s,
  on,
  tabbable,
  onToggle,
  cue,
  onFocusCell,
  register,
}: CellProps) {
  // Mouse toggles on pointerdown (instant). Touch/pen and keyboard toggle on click, so a
  // scroll gesture that starts on a cell never toggles it. Keyboard clicks have detail 0.
  const mouseToggled = useRef(false)
  const beat = s % 4 === 0 ? `, beat ${s / 4 + 1}` : ''

  return (
    <button
      ref={(el) => register(t * STEPS + s, el)}
      type="button"
      className="seq-cell"
      data-track={track}
      data-group={Math.floor(s / 4) % 2}
      data-t={t}
      data-cue={cue}
      style={place(t, s)}
      aria-label={`${trackName}, step ${s + 1}${beat}`}
      aria-pressed={on}
      tabIndex={tabbable ? 0 : -1}
      onFocus={() => onFocusCell({ t, s })}
      onPointerDown={(e) => {
        mouseToggled.current = e.pointerType === 'mouse' && e.button === 0
        if (mouseToggled.current) onToggle(track, s)
      }}
      onClick={(e) => {
        const handled = mouseToggled.current && e.detail > 0
        mouseToggled.current = false
        if (!handled) onToggle(track, s)
      }}
    >
      <TrackGlyph track={track} className="seq-cell-glyph" />
    </button>
  )
})
