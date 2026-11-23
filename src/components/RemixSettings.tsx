// Remix settings (V3.4): temperature, which parts Remix may change, the last seed, and
// RESTORE ORIGINAL. Secondary to the REMIX button: collapsed by default. Built from 8bitcn
// Slider, Toggle Group and Button.

import { Button } from '@/components/ui/8bit/button'
import { Slider } from '@/components/ui/8bit/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/8bit/toggle-group'
import { BAND_LABEL, PARTS, bandOf, type Part } from '@/data/remixMusic'

interface Props {
  id: string
  open: boolean
  temperature: number
  parts: Part[]
  /** Parts this kit can't remix safely (e.g. sustained chords), with the reason. */
  unavailable: Partial<Record<Part, string>>
  /** Seed of the last roll (null before the first roll). */
  seed: number | null
  /** True when anything differs from the kit's original composition and grid. */
  modified: boolean
  onTemperature: (t: number) => void
  onParts: (parts: Part[]) => void
  onRestore: () => void
}

export const formatSeed = (seed: number) => seed.toString(16).toUpperCase().padStart(8, '0').replace(/^(.{4})/, '$1-')

export function RemixSettings({ id, open, temperature, parts, unavailable, seed, modified, onTemperature, onParts, onRestore }: Props) {
  if (!open) return null
  const band = BAND_LABEL[bandOf(temperature)]
  return (
    <section id={id} aria-label="Remix settings" className="flex flex-col gap-6 border-2 border-cell-edge p-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span id="temp-label" className="retro text-[10px] text-ink-dim">
          TEMPERATURE
        </span>
        <Slider
          className="min-w-48 flex-1"
          min={0}
          max={100}
          step={1}
          value={[temperature]}
          onValueChange={([v]) => onTemperature(v)}
          thumbProps={{ 'aria-labelledby': 'temp-label', 'aria-valuetext': `${temperature}, ${band.toLowerCase()}` }}
        />
        <output aria-hidden="true" className="retro w-[13ch] text-right text-[10px] text-ink tabular-nums">
          {String(temperature).padStart(3, '0')} · {band}
        </output>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span id="parts-label" className="retro text-[10px] text-ink-dim">
          CHANGE
        </span>
        <ToggleGroup
          type="multiple"
          variant="outline"
          aria-labelledby="parts-label"
          value={parts}
          // Keep at least one part selected.
          onValueChange={(v) => v.length && onParts(v as Part[])}
          className="flex-wrap gap-x-5 gap-y-5 px-1.5"
        >
          {PARTS.map((p) => (
            <ToggleGroupItem
              key={p}
              value={p}
              variant="outline"
              disabled={!!unavailable[p]}
              title={unavailable[p]}
              aria-label={unavailable[p] ? `${p}, unavailable: ${unavailable[p]}` : p}
              className="h-10 px-3 text-[10px] uppercase disabled:opacity-45"
            >
              {p}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <p className="retro text-[10px] text-ink-dim">
          SEED <span className="text-ink">{seed === null ? '—' : formatSeed(seed)}</span>
        </p>
        <Button variant="outline" className="h-10" onClick={onRestore} disabled={!modified}>
          RESTORE ORIGINAL
        </Button>
      </div>
    </section>
  )
}
