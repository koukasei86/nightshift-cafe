export interface Tile { x: number; y: number }
export interface Grid {
  width: number;
  height: number;
  minY?: number;
  blocked: ReadonlySet<number>;
}

export const tileKey = (tile: Tile, width: number) => tile.y * width + tile.x;
export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

const neighbors = [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
const distance = (a: Tile, b: Tile) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function findPath(grid: Grid, from: Tile, to: Tile, budget = grid.width * grid.height): Tile[] | null {
  const minY = grid.minY ?? 0;
  const valid = (tile: Tile) =>
    tile.x >= 0 && tile.x < grid.width && tile.y >= minY && tile.y < minY + grid.height &&
    !grid.blocked.has(tileKey(tile, grid.width));
  if (!valid(from) || !valid(to)) return null;
  const open = [{ tile: from, steps: 0, score: distance(from, to) }];
  const start = tileKey(from, grid.width);
  const parents = new Map<number, Tile>();
  const best = new Map([[start, 0]]);

  for (let visited = 0; visited < budget && open.length > 0;) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift()!;
    const key = tileKey(current.tile, grid.width);
    if (current.steps !== best.get(key)) continue;
    visited++;
    if (sameTile(current.tile, to)) {
      const route: Tile[] = [];
      for (let tile = to; !sameTile(tile, from); tile = parents.get(tileKey(tile, grid.width))!) {
        route.push(tile);
      }
      return route.reverse();
    }
    for (const offset of neighbors) {
      const next = { x: current.tile.x + offset.x, y: current.tile.y + offset.y };
      if (!valid(next)) continue;
      const nextKey = tileKey(next, grid.width);
      const steps = current.steps + 1;
      if (steps >= (best.get(nextKey) ?? Infinity)) continue;
      best.set(nextKey, steps);
      parents.set(nextKey, current.tile);
      open.push({ tile: next, steps, score: steps + distance(next, to) });
    }
  }
  return null;
}
