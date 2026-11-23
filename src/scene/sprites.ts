// Pixel sprites for the V2.1 performers (ART_DIRECTION.md → V2.1 "Performers: sprites").
// Each sprite is an array of equal-length strings; one character = one logical pixel.
// '.' is transparent. Other characters are mapped to colors at draw time.

export type Sprite = readonly string[]
export type ColorMap = Record<string, string | undefined>

export const SPRITES = {
  // Stomper 9×12. 'd'/'c'/'C' = visor (idle / ready / hit).
  stomperIdle: [
    '.........', '...###...', '..#ddd#..', '..#####..', '.#######.', '#.#####.#',
    '#.#####.#', '..#####..', '..##.##..', '..##.##..', '..##.##..', '.###.###.',
  ],
  stomperReady: [
    '...###...', '..#####..', '..#ccc#..', '..#####..', '.#######.', '#.#####.#',
    '#.#####.#', '..#####..', '..##.##..', '..##.##..', '..##.##..', '.###.###.',
  ],
  stomperHit: [
    '.........', '...###...', '..#CCC#..', '..#####..', '#########', '..#####..',
    '..#####..', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '###...###',
  ],
  stomperLand: [
    '.........', '...###...', '..#ccc#..', '..#####..', '.#######.', '#.#####.#',
    '..#####..', '..#####..', '.##..##..', '.##..##..', '.##..##..', '.###.###.',
  ],
  // Resident 6×6 (void silhouette on a lit window).
  residentRest: ['......', '..##..', '..##..', '......', '.####.', '.####.'],
  residentCheer: ['#.##.#', '#.##.#', '.#..#.', '.####.', '.####.', '......'],
  // Wire bird 4×3. 'e' = eye.
  birdAsleep: ['....', '.##.', '####'],
  birdAwake: ['.##.', '#e##', '.#..'],
  // Crowd figure, 4 wide. 'V' = violet hand.
  crowdSit: ['....', '.##.', '####'],
  crowdReady: ['.##.', '.##.', '####', '####'],
  crowdHalf: ['V..V', '.##.', '.##.', '####', '####'],
  crowdFull: ['V..V', '#..#', '.##.', '.##.', '####', '####'],
} as const satisfies Record<string, Sprite>

/** Draw a sprite; unmapped characters are skipped. */
export function drawSprite(c: CanvasRenderingContext2D, rows: Sprite, x: number, y: number, map: ColorMap) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      const col = map[row[i]]
      if (!col) continue
      c.fillStyle = col
      c.fillRect(x + i, y + j, 1, 1)
    }
  }
}

/**
 * Draw a silhouette: '#' pixels use `body`, except pixels whose top or left neighbour is
 * empty, which get the 1 px `rim` light. Other characters use `map`.
 */
export function drawSilhouette(
  c: CanvasRenderingContext2D,
  rows: Sprite,
  x: number,
  y: number,
  body: string,
  rim: string,
  map: ColorMap = {},
) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      let col: string | undefined
      if (ch === '#') {
        const edge = j === 0 || rows[j - 1][i] !== '#' || i === 0 || row[i - 1] !== '#'
        col = edge ? rim : body
      } else col = map[ch]
      if (!col) continue
      c.fillStyle = col
      c.fillRect(x + i, y + j, 1, 1)
    }
  }
}
