// DEV-ONLY Oil 6 studies page: current Signal City vs four Oil 6 light settings, actual size + 4×.
import '@fontsource/press-start-2p/400.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@/index.css'
import { CityScene, readPalette } from '@/scene/city'
import { BIRD_X, CROWD_X, H, ROOF, STOMPER, W } from '@/scene/geometry'
import { OIL6, OIL6_RAMP, WORLDS, type WorldId } from '@/scene/oil6'
import { CHAR_X, CHAR_Y, colourCensus, renderStudy, silhouetteContrast, type Moment } from './study'

const IDS = Object.keys(WORLDS) as WorldId[]
const SCALE = 4

function current(moment: Moment) {
  const cv = document.createElement('canvas')
  const scene = new CityScene(cv, readPalette())
  if (moment === 'beat') {
    scene.cue('start')
    scene.draw(0)
    scene.step(4, ['kick', 'snare', 'hat', 'clap'], 134, 2000 - 20)
  }
  scene.draw(moment === 'beat' ? 2000 : 0)
  return cv
}
function study(id: WorldId, moment: Moment, opts?: { performers?: boolean; character?: boolean }) {
  const cv = document.createElement('canvas')
  renderStudy(cv, id, moment, opts)
  return cv
}
function scaled(src: HTMLCanvasElement, s = SCALE) {
  const cv = document.createElement('canvas')
  cv.width = W * s
  cv.height = H * s
  const c = cv.getContext('2d')!
  c.imageSmoothingEnabled = false
  c.drawImage(src, 0, 0, W * s, H * s)
  return cv
}

const BOXES = {
  character: { x: CHAR_X - 1, y: CHAR_Y - 1, w: 11, h: 16 },
  stomper: { x: STOMPER.x - 3, y: STOMPER.y - 1, w: 15, h: 14 },
  crowd: { x: CROWD_X[0] - 1, y: ROOF - 8, w: 21, h: 10 },
  birds: { x: BIRD_X[0] - 1, y: 11, w: 20, h: 10 },
}

function report(id: WorldId) {
  const out: Record<string, unknown> = {}
  for (const m of ['rest', 'beat'] as Moment[]) {
    const full = study(id, m)
    const census = colourCensus(full)
    const allowed = new Set<string>(OIL6_RAMP)
    out[m] = {
      colours: Object.keys(census).length,
      offPalette: Object.keys(census).filter((k) => !allowed.has(k)),
      share: Object.fromEntries(OIL6_RAMP.map((k) => [k, +(((census[k] ?? 0) / (W * H)) * 100).toFixed(1)])),
      readability: {
        character: silhouetteContrast(full, study(id, m, { character: false }), BOXES.character),
        stomper: silhouetteContrast(full, study(id, m, { performers: false }), BOXES.stomper),
        crowd: silhouetteContrast(full, study(id, m, { performers: false }), BOXES.crowd),
        birds: silhouetteContrast(full, study(id, m, { performers: false }), BOXES.birds),
      },
    }
  }
  return out
}

// ---------------------------------------------------------------- DOM
document.body.style.cssText = `margin:0;background:${OIL6.navy};color:${OIL6.cream};font:14px/1.5 'IBM Plex Sans',system-ui,sans-serif`
const root = document.getElementById('oil6')!
root.style.cssText = 'max-width:1400px;margin:0 auto;padding:24px'
const h = (tag: string, text = '', css = '') => {
  const el = document.createElement(tag)
  el.textContent = text
  if (css) el.style.cssText = css
  return el
}
const pixelFont = "font-family:'Press Start 2P',monospace"
root.append(h('h1', 'BEAT.BIT · OIL 6 SCENE STUDIES', `${pixelFont};font-size:18px;margin:0 0 6px`))
root.append(h('p', 'Dev-only. Same Signal City composition (160×50), six colours only, no alpha. Left: actual size (1×). Right: 4×, at rest and on the beat (every performer on its hit frame).', `color:${OIL6.rose};margin:0 0 16px`))

const sw = h('div', '', 'display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap')
for (const [name, col] of Object.entries(OIL6)) {
  const s = h('div', `${name} ${col}`, `${pixelFont};font-size:8px;padding:28px 8px 6px;min-width:120px;background:${col};color:${OIL6_RAMP.indexOf(col) < 3 ? OIL6.cream : OIL6.navy};outline:1px solid ${OIL6.indigo}`)
  sw.append(s)
}
root.append(sw)

const rows: [string, (m: Moment) => HTMLCanvasElement][] = [
  ['CURRENT · Signal City (production palette)', current],
  ...IDS.map((id) => [`OIL 6 · ${WORLDS[id].label}`, (m: Moment) => study(id, m)] as [string, (m: Moment) => HTMLCanvasElement]),
]
for (const [label, make] of rows) {
  const sec = h('section', '', 'margin-bottom:22px')
  sec.append(h('h2', label, `${pixelFont};font-size:11px;margin:0 0 8px;color:${OIL6.peach}`))
  const line = h('div', '', 'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap')
  const one = make('beat')
  one.style.cssText = `width:${W}px;height:${H}px;image-rendering:pixelated;outline:1px solid ${OIL6.indigo}`
  line.append(one)
  for (const m of ['rest', 'beat'] as Moment[]) {
    const big = scaled(make(m))
    big.style.cssText = `width:${W * SCALE}px;height:${H * SCALE}px;image-rendering:pixelated`
    big.setAttribute('aria-label', `${label}, ${m}`)
    line.append(big)
  }
  sec.append(line)
  root.append(sec)
}

// Dev handle: reports + PNG export (actual size and 4×).
const pngs = () => {
  const out: Record<string, string> = {}
  for (const m of ['rest', 'beat'] as Moment[]) {
    out[`current-${m}-1x`] = current(m).toDataURL('image/png').split(',')[1]
    out[`current-${m}-4x`] = scaled(current(m)).toDataURL('image/png').split(',')[1]
    for (const id of IDS) {
      out[`oil6-${id}-${m}-1x`] = study(id, m).toDataURL('image/png').split(',')[1]
      out[`oil6-${id}-${m}-4x`] = scaled(study(id, m)).toDataURL('image/png').split(',')[1]
    }
  }
  return out
}
;(window as unknown as { oil6: unknown }).oil6 = { report: () => Object.fromEntries(IDS.map((id) => [id, report(id)])), pngs }
document.title = 'ready'
