// 8×8 pixel glyphs: each track's non-color identity (ART_DIRECTION.md, Track identity).
// Drawn as SVG rects so they stay crisp at any size and don't depend on font coverage.

import type { TrackId } from '@/data/patterns'

type Rect = [x: number, y: number, w: number, h: number]

const GLYPHS: Record<TrackId, Rect[]> = {
  // ▮ solid block
  kick: [[2, 1, 4, 6]],
  // ▚ checker
  snare: [
    [1, 1, 2, 2],
    [5, 1, 2, 2],
    [3, 3, 2, 2],
    [1, 5, 2, 2],
    [5, 5, 2, 2],
  ],
  // ▴ triangle
  hat: [
    [3, 2, 2, 1],
    [2, 3, 4, 1],
    [1, 4, 6, 1],
    [0, 5, 8, 1],
  ],
  // ✚ cross
  clap: [
    [3, 1, 2, 6],
    [1, 3, 6, 2],
  ],
}

export function TrackGlyph({ track, className }: { track: TrackId; className?: string }) {
  return (
    <svg
      viewBox="0 0 8 8"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      className={className}
    >
      {GLYPHS[track].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </svg>
  )
}
