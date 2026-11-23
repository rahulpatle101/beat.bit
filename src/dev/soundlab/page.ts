// SOUND LAB page (dev-only, isolated from the product UI). Live playback uses the production
// AudioEngine + Scheduler classes unmodified; every note goes through render.ts `playStep`, the same
// function the offline WAV renders use. Preset changes are read at schedule time (next step).

import { AudioEngine } from '@/audio/engine'
import { Scheduler, stepDuration } from '@/audio/scheduler'
import { STEPS, TRACK_IDS, type Pattern } from '@/data/patterns'
import { GAINS } from '@/audio/synth/calibration'
import { PRESETS, byRole, presetById, type Preset, type Role, type SynthId } from '@/audio/synth/presets'
import * as render from './render'
import { COMBOS, PHRASE_KIT, phraseBars, playStep, type LayerVoice, type VoiceSet } from './render'
import { encodeWav } from '../wav'
import './lab.css'

type Choice = 'off' | 'orig' | string // preset id ('orig' = NEON DRIVE's pre-V3.2a voices)
type Slot = Record<Role, Choice>
const ROLES: Role[] = ['lead', 'bass', 'chords']

const state = {
  slots: {
    A: { lead: 'orig', bass: 'orig', chords: 'orig' } as Slot,
    B: { lead: 'neon', bass: 'funkbass', chords: 'dreampad' } as Slot,
  },
  active: 'A' as 'A' | 'B',
  matched: true,
  drums: true,
  solo: null as Role | null,
  playing: false,
  bar: 0,
  step: -1,
}

const EMPTY = Object.fromEntries(TRACK_IDS.map((t) => [t, Array<boolean>(STEPS).fill(false)])) as Pattern
const engine = new AudioEngine()
const bars = phraseBars()
const BPM = PHRASE_KIT.bpm

function voiceFor(choice: Choice): LayerVoice {
  if (choice === 'off') return { kind: 'off' }
  if (choice === 'orig') return { kind: 'orig' }
  return { kind: 'preset', preset: presetById(choice), gain: state.matched ? GAINS[choice as SynthId] ?? 1 : 1 }
}
function currentSet(): VoiceSet {
  const slot = state.slots[state.active]
  const set = {} as VoiceSet
  for (const r of ROLES) set[r] = state.solo && state.solo !== r ? { kind: 'off' } : voiceFor(slot[r])
  return set
}

// ---- timing log (stability during preset changes) ----
const log: { time: number; scheduledAt: number; bar: number; step: number; set: string }[] = []

const scheduler = new Scheduler({
  now: () => engine.now(),
  getBpm: () => BPM,
  getPattern: () => EMPTY, // drums are played by playStep (with composed velocities)
  trigger: () => {},
  onStepScheduled: (bar, step, time, stepSec) => {
    const v = engine.voices()
    if (!v) return
    const set = currentSet()
    playStep(v, PHRASE_KIT, bars[bar % bars.length], step, time, stepSec, set, state.drums && !state.solo)
    log.push({ time, scheduledAt: v.ctx.currentTime, bar, step, set: state.active + ROLES.map((r) => state.slots[state.active][r]).join(',') })
    if (log.length > 4000) log.splice(0, 1000)
  },
})

let raf = 0
function frame() {
  const now = engine.now() - engine.outputLatency()
  for (const e of scheduler.drain(now)) {
    state.bar = e.bar % bars.length
    state.step = e.step
  }
  paintPlayhead()
  if (state.playing) raf = requestAnimationFrame(frame)
}

async function play() {
  if (state.playing) return
  if (!(await engine.unlock())) {
    setStatus('Audio is blocked by the browser: click Play again.')
    return
  }
  engine.setTempo(stepDuration(BPM))
  if (scheduler.start()) {
    state.playing = true
    raf = requestAnimationFrame(frame)
  }
  paint()
}
function stop() {
  scheduler.stop()
  engine.cut()
  state.playing = false
  state.step = -1
  cancelAnimationFrame(raf)
  paint()
}

// ---- timing stress: flip A/B every 150–400 ms while playing, then verify the step grid ----
async function swapTest(seconds = 8) {
  if (!state.playing) await play()
  const from = log.length
  const t0 = performance.now()
  let flips = 0
  while (performance.now() - t0 < seconds * 1000) {
    state.active = state.active === 'A' ? 'B' : 'A'
    flips++
    paint()
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 250))
  }
  const ev = log.slice(from)
  const step = stepDuration(BPM)
  let maxDev = 0
  let gaps = 0
  for (let i = 1; i < ev.length; i++) {
    const d = ev[i].time - ev[i - 1].time
    maxDev = Math.max(maxDev, Math.abs(d - step))
    const expected = (ev[i - 1].step + 1) % 16
    if (ev[i].step !== expected) gaps++
  }
  const late = ev.filter((e) => e.time < e.scheduledAt).length
  const minLead = Math.min(...ev.map((e) => e.time - e.scheduledAt))
  const sets = new Set(ev.map((e) => e.set)).size
  const result = { flips, steps: ev.length, distinctSets: sets, maxIntervalErrorMs: +(maxDev * 1000).toFixed(6), missingSteps: gaps, lateSchedules: late, minLookaheadMs: +(minLead * 1000).toFixed(1) }
  setStatus(`Swap test: ${flips} flips over ${ev.length} steps · interval error ${result.maxIntervalErrorMs} ms · missing ${gaps} · late ${late}`)
  return result
}

// ---- WAV download of the active set ----
async function download(kind: 'phrase' | 'full') {
  setStatus('Rendering…')
  const set = currentSet()
  const buf = await render.renderBars(PHRASE_KIT, kind === 'phrase' ? bars : render.arrangementBars(), set, { drums: state.drums && !state.solo })
  const blob = new Blob([encodeWav(buf)], { type: 'audio/wav' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const s = state.slots[state.active]
  a.download = `beatbit-lab-${kind}-${state.solo ?? 'mix'}-${s.lead}-${s.bass}-${s.chords}.wav`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  setStatus(`Rendered ${buf.duration.toFixed(1)} s WAV.`)
}

// ---- QA table ----
async function runQa() {
  setStatus('Running QA (offline renders, ~20 s)…')
  const rows = []
  for (const p of PRESETS) rows.push(await render.qaPreset(p, GAINS[p.id]))
  qaEl.innerHTML = `<table><thead><tr><th>Preset</th><th>Gain</th><th>LUFS</th><th>Peak</th><th>Edge×</th><th>HF &gt;6k</th><th>Laptop band</th><th>&lt;120 Hz</th><th>Tail</th><th></th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td>${r.gain}</td><td>${r.matchedLufs}</td><td>${r.peak}</td><td>${r.onsetEdge}</td><td>${r.hfDb}</td><td>${r.laptopDb}</td><td>${r.lowDb}</td><td>${r.tailDb}</td><td class="${r.pass ? 'ok' : 'bad'}">${r.pass ? 'PASS' : r.notes.join('; ')}</td></tr>`,
    )
    .join('')}</tbody></table>`
  setStatus(`QA: ${rows.filter((r) => r.pass).length}/${rows.length} presets pass.`)
  return rows
}

// ---------------------------------------------------------------- DOM
const root = document.getElementById('lab')!
root.innerHTML = `
<header>
  <h1>BEAT.BIT <span>SOUND LAB</span></h1>
  <p>Dev-only. Same composition (${PHRASE_KIT.name} main hook, ${BPM} BPM, ${PHRASE_KIT.key}), different timbre. Changes land on the next step.</p>
</header>
<section class="transport">
  <button id="play" class="big">PLAY</button>
  <div class="ab" role="radiogroup" aria-label="Active set">
    <button data-ab="A" role="radio">A</button><button data-ab="B" role="radio">B</button>
  </div>
  <label><input type="checkbox" id="matched" checked> Loudness matched</label>
  <label><input type="checkbox" id="drums" checked> Drums</label>
  <div class="solo" role="radiogroup" aria-label="Solo"><span>Solo</span>
    <button data-solo="">MIX</button>${ROLES.map((r) => `<button data-solo="${r}">${r.toUpperCase()}</button>`).join('')}
  </div>
  <div class="playhead" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i data-s="${i}"></i>`).join('')}</div>
</section>
<section class="quick">
  <span>Load into active set:</span>
  <button data-combo="orig">ORIGINAL</button>
  ${COMBOS.map((c) => `<button data-combo="${c.id}">${c.name.split(' (')[0]}</button>`).join('')}
</section>
<section class="slots">
  ${(['A', 'B'] as const)
    .map(
      (slot) => `<div class="slot" data-slot="${slot}"><h2>SET ${slot}</h2>${ROLES.map(
        (r) => `<div class="role"><h3>${r.toUpperCase()}</h3><div class="chips">
          <button data-pick="${slot}:${r}:off">OFF</button><button data-pick="${slot}:${r}:orig">ORIGINAL</button>
          ${byRole(r).map((p) => `<button data-pick="${slot}:${r}:${p.id}" title="${p.character}">${p.name}</button>`).join('')}
        </div></div>`,
      ).join('')}</div>`,
    )
    .join('')}
</section>
<section class="specs" id="specs"></section>
<section class="tools">
  <button id="wav-phrase">Download WAV · phrase (active set)</button>
  <button id="wav-full">Download WAV · full arrangement (active set)</button>
  <button id="swap">Timing test · rapid A/B flips</button>
  <button id="qa">Run QA</button>
</section>
<p id="status" role="status" aria-live="polite"></p>
<section id="qa-out"></section>
<footer>Keys: <kbd>Space</kbd> play/stop · <kbd>X</kbd> flip A/B · <kbd>M</kbd> loudness match · <kbd>D</kbd> drums</footer>
`
const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!
const qaEl = $('#qa-out')
const setStatus = (t: string) => ($('#status').textContent = t)

function specCard(p: Preset) {
  const o = p.oscs.map((x) => `${x.wave === 'pulse' ? `pulse ${x.duty! * 100}%` : x.wave}${x.octave ? ` ${x.octave > 0 ? '+' : ''}${x.octave} oct` : ''}${x.detune ? ` ${x.detune > 0 ? '+' : ''}${x.detune}¢` : ''} ×${x.level}`).join(' + ')
  const f = p.filter ? `${p.filter.type} ${p.filter.cutoff} Hz, Q ${p.filter.q} dB, env +${p.filter.envAmount} Hz (a ${p.filter.env.a}s d ${p.filter.env.d}s s ${p.filter.env.s}), keytrack ${p.filter.keytrack}${p.filter.lfo ? `, LFO ${p.filter.lfo.rate} Hz ±${p.filter.lfo.depth}` : ''}` : 'none'
  const mods = [
    p.unison && `unison ${p.unison.voices}×±${p.unison.spread}¢`,
    p.pitch && `pitch env ${p.pitch.semitones > 0 ? '+' : ''}${p.pitch.semitones} st → 0 in ${p.pitch.time * 1000} ms`,
    p.vibrato && `vibrato ${p.vibrato.rate} Hz ±${p.vibrato.depth}¢ after ${p.vibrato.delay * 1000} ms`,
    p.glide && `glide ${p.glide * 1000} ms`,
    p.drive && `drive ${p.drive}`,
    p.arp && `arp ${p.arp.pattern} ${p.arp.octaves} oct, ${p.arp.perStep}/step`,
    p.noise && `noise pick ${p.noise}`,
    p.hp && `HP ${p.hp} Hz`,
  ].filter(Boolean)
  return `<article><h3>${p.name} <small>${p.role}</small></h3><p>${p.purpose}</p><p class="char">${p.character}</p>
  <dl><dt>Osc</dt><dd>${o}</dd><dt>Amp</dt><dd>A ${p.amp.a * 1000} ms · D ${p.amp.d * 1000} ms · S ${p.amp.s} · R ${p.amp.r * 1000} ms · gate ${p.gate}</dd>
  <dt>Filter</dt><dd>${f}</dd><dt>Mod</dt><dd>${mods.join(' · ') || '—'}</dd><dt>Level</dt><dd>${p.loudness} LUFS target · gain ${GAINS[p.id]}</dd></dl></article>`
}

function paint() {
  $('#play').textContent = state.playing ? 'STOP' : 'PLAY'
  $('#play').setAttribute('aria-pressed', String(state.playing))
  root.querySelectorAll<HTMLButtonElement>('[data-ab]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ab === state.active)))
  root.querySelectorAll<HTMLButtonElement>('[data-solo]').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.solo || null) === state.solo)))
  root.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => el.classList.toggle('active', el.dataset.slot === state.active))
  root.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => {
    const [slot, role, id] = b.dataset.pick!.split(':')
    b.setAttribute('aria-pressed', String(state.slots[slot as 'A' | 'B'][role as Role] === id))
  })
  ;($('#matched') as HTMLInputElement).checked = state.matched
  ;($('#drums') as HTMLInputElement).checked = state.drums
  const slot = state.slots[state.active]
  $('#specs').innerHTML = ROLES.map((r) => (slot[r] === 'off' || slot[r] === 'orig' ? `<article><h3>${slot[r] === 'off' ? 'OFF' : 'ORIGINAL voice'} <small>${r}</small></h3><p>${slot[r] === 'orig' ? `NEON DRIVE's voice before V3.2a (${render.ORIGINAL[r]}).` : 'Muted.'}</p></article>` : specCard(presetById(slot[r])))).join('')
}
function paintPlayhead() {
  root.querySelectorAll<HTMLElement>('.playhead i').forEach((el) => el.classList.toggle('on', Number(el.dataset.s) === state.step))
}

root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button')
  if (!t) return
  if (t.id === 'play') return void (state.playing ? stop() : play())
  if (t.dataset.ab) state.active = t.dataset.ab as 'A' | 'B'
  if (t.dataset.solo !== undefined) state.solo = (t.dataset.solo || null) as Role | null
  if (t.dataset.pick) {
    const [slot, role, id] = t.dataset.pick.split(':')
    state.slots[slot as 'A' | 'B'][role as Role] = id
    state.active = slot as 'A' | 'B'
  }
  if (t.dataset.combo) {
    const c = COMBOS.find((x) => x.id === t.dataset.combo)
    state.slots[state.active] = c ? { lead: c.lead, bass: c.bass, chords: c.chords } : { lead: 'orig', bass: 'orig', chords: 'orig' }
  }
  if (t.id === 'wav-phrase') void download('phrase')
  if (t.id === 'wav-full') void download('full')
  if (t.id === 'swap') void swapTest()
  if (t.id === 'qa') void runQa()
  paint()
})
$('#matched').addEventListener('change', (e) => ((state.matched = (e.target as HTMLInputElement).checked), paint()))
$('#drums').addEventListener('change', (e) => ((state.drums = (e.target as HTMLInputElement).checked), paint()))
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return
  if (e.key === ' ') {
    e.preventDefault()
    void (state.playing ? stop() : play())
  } else if (e.key === 'x' || e.key === 'X') state.active = state.active === 'A' ? 'B' : 'A'
  else if (e.key === 'm' || e.key === 'M') state.matched = !state.matched
  else if (e.key === 'd' || e.key === 'D') state.drums = !state.drums
  else return
  paint()
})
paint()

// Dev handle for automated checks / WAV export (CDP).
;(window as unknown as { lab: unknown }).lab = { ...render, GAINS, state, play, stop, swapTest, runQa, paint, log }
document.title = 'ready'
