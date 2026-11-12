import { findPath, type Grid, type Tile } from '../pathfinding/grid';

export type Facing = 'se' | 'sw' | 'ne' | 'nw';
export const facings: readonly Facing[] = ['se', 'sw', 'ne', 'nw'];

export interface Movement {
  tile: Tile;
  path: Tile[];
  fraction: number;
  speed: number;
  facing: Facing;
  distance?: number;
}

export function direction(from: Tile, to: Tile): Facing {
  if (from.x !== to.x) return to.x > from.x ? 'se' : 'nw';
  return to.y > from.y ? 'sw' : 'ne';
}

export function route(actor: Movement, grid: Grid, target: Tile) {
  const path = findPath(grid, actor.tile, target);
  actor.path = path ?? [];
  actor.fraction = 0;
  return path !== null;
}

export function walk(actor: Movement, dt: number) {
  if (!actor.path.length) return true;
  actor.facing = direction(actor.tile, actor.path[0]);
  const travel = Math.min(actor.speed * dt / 1000, actor.path.length - actor.fraction);
  actor.distance = (actor.distance ?? 0) + travel;
  actor.fraction += travel;
  while (actor.path.length && actor.fraction >= 1) {
    actor.tile = actor.path.shift()!;
    actor.fraction -= 1;
  }
  if (actor.path.length) return false;
  actor.fraction = 0;
  return true;
}

export function position(actor: Movement): Tile {
  const next = actor.path[0] ?? actor.tile;
  return {
    x: actor.tile.x + (next.x - actor.tile.x) * actor.fraction,
    y: actor.tile.y + (next.y - actor.tile.y) * actor.fraction,
  };
}
