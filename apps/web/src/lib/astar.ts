export interface Tile { col: number; row: number }
export interface PixelPos { x: number; y: number }

interface Node {
  col: number; row: number;
  g: number; h: number; f: number;
  parent: Node | null;
}

// 4-directional A* on a boolean walkability grid.
// Returns pixel-centre positions (tile * tileSize + tileSize/2).
export function astar(
  from: Tile,
  to: Tile,
  walkable: boolean[][],
  tileSize: number,
): PixelPos[] {
  const rows = walkable.length;
  const cols = walkable[0]?.length ?? 0;
  if (!rows || !cols) return [];

  const tCol = clamp(to.col, 0, cols - 1);
  const tRow = clamp(to.row, 0, rows - 1);

  // If target cell is blocked, find nearest walkable neighbour
  const dest = walkable[tRow]?.[tCol]
    ? { col: tCol, row: tRow }
    : nearestWalkable({ col: tCol, row: tRow }, walkable);

  if (!dest) return [];

  const key = (c: number, r: number) => r * cols + c;
  const h = (c: number, r: number) => Math.abs(c - dest.col) + Math.abs(r - dest.row);

  const open: Node[] = [];
  const closed = new Set<number>();
  const bestG = new Map<number, number>();

  const start: Node = {
    col: clamp(from.col, 0, cols - 1),
    row: clamp(from.row, 0, rows - 1),
    g: 0, h: h(from.col, from.row),
    f: h(from.col, from.row),
    parent: null,
  };
  open.push(start);
  bestG.set(key(start.col, start.row), 0);

  while (open.length > 0) {
    // Pop node with lowest f
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bi]!.f) bi = i;
    }
    const cur = open.splice(bi, 1)[0]!;
    const curKey = key(cur.col, cur.row);

    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (cur.col === dest.col && cur.row === dest.row) {
      return reconstructPath(cur, tileSize);
    }

    for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as [number, number][]) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (!walkable[nr]?.[nc]) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;

      const ng = cur.g + 1;
      if ((bestG.get(nk) ?? Infinity) <= ng) continue;
      bestG.set(nk, ng);

      const nh = h(nc, nr);
      open.push({ col: nc, row: nr, g: ng, h: nh, f: ng + nh, parent: cur });
    }
  }

  // No path — return direct target
  return [tileCenter(dest.col, dest.row, tileSize)];
}

function reconstructPath(node: Node, tileSize: number): PixelPos[] {
  const path: PixelPos[] = [];
  let n: Node | null = node;
  while (n) {
    path.unshift(tileCenter(n.col, n.row, tileSize));
    n = n.parent;
  }
  return path;
}

function tileCenter(col: number, row: number, tileSize: number): PixelPos {
  return { x: col * tileSize + tileSize / 2, y: row * tileSize + tileSize / 2 };
}

function nearestWalkable(from: Tile, walkable: boolean[][]): Tile | null {
  const rows = walkable.length;
  const cols = walkable[0]?.length ?? 0;
  for (let r = 1; r < Math.max(rows, cols); r++) {
    for (let dr = -r; dr <= r; dr++) {
      for (const dc of [-r, r]) {
        const nc = from.col + dc, nr = from.row + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && walkable[nr]?.[nc]) {
          return { col: nc, row: nr };
        }
      }
    }
    for (let dc = -r + 1; dc < r; dc++) {
      for (const dr of [-r, r]) {
        const nc = from.col + dc, nr = from.row + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && walkable[nr]?.[nc]) {
          return { col: nc, row: nr };
        }
      }
    }
  }
  return null;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
