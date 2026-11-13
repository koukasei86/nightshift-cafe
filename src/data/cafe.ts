import { characterLooks } from './characters';
import { balance } from './balance';
import { tileKey, type Grid, type Tile } from '../core/pathfinding/grid';

export const WIDTH = 9;
export const ROOM_DEPTH = 7;
export const STREET_DEPTH = 3;
export const DOOR = { x: 6, y: 0 };
export const DOOR_OUTSIDE = { x: DOOR.x, y: -1 };
export const EXIT = { x: 8, y: -3 };
export const STOVE = { x: 0, y: 4 };
export const STOVE_WORK = { x: 1, y: 4 };
export const FOOD_COUNTER = { x: 2, y: 4 };
export const COUNTER_WORK = { x: 3, y: 4 };
export const GUEST_SPEED = balance.guestWalkSpeed;
export const CHEF_SPEED = balance.staffWalkSpeed;
export const STAFF_LIMIT = 3;
export const LEVEL_XP = 24;

export type PropKind = 'stove' | 'sink' | 'counter' | 'table' | 'chair' | 'fridge';
const initialFurniture: ReadonlyArray<Tile & { kind: PropKind }> = [
  { ...STOVE, kind: 'stove' }, { x: 0, y: 3, kind: 'sink' },
  { x: 0, y: 2, kind: 'fridge' },
  { ...FOOD_COUNTER, kind: 'counter' }, { x: 2, y: 5, kind: 'counter' },
  { x: 4, y: 1, kind: 'table' }, { x: 5, y: 1, kind: 'chair' },
  { x: 6, y: 3, kind: 'table' }, { x: 5, y: 3, kind: 'chair' },
  { x: 3, y: 2, kind: 'table' }, { x: 2, y: 2, kind: 'chair' },
  { x: 7, y: 5, kind: 'table' }, { x: 6, y: 5, kind: 'chair' },
];

export const furniture = initialFurniture.map((item, index) => ({
  ...item, id: `${item.kind}-${index}`, rotation: (item.kind === 'chair' && item.x===5 && item.y===1 ? 2 : 0) as number,
  occupiedTiles: [{ x: item.x, y: item.y }],
  blocking: item.kind !== 'chair', renderKey: item.kind,
}));
export const counters = [
  { id: 'counter-3', name: '配膳台 A', tile: FOOD_COUNTER, work: COUNTER_WORK },
  { id: 'counter-4', name: '配膳台 B', tile: { x: 2, y: 5 }, work: { x: 3, y: 5 } },
] as const;

export const seats = [
  { position: { x: 2, y: 2 }, service: { x: 4, y: 2 }, table: { x: 3, y: 2 } },
  { position: { x: 5, y: 1 }, service: { x: 4, y: 2 }, table: { x: 4, y: 1 } },
  { position: { x: 5, y: 3 }, service: { x: 6, y: 4 }, table: { x: 6, y: 3 } },
  { position: { x: 6, y: 5 }, service: { x: 7, y: 4 }, table: { x: 7, y: 5 } },
] as const;

export const cafeGrid: Grid = {
  width: WIDTH,
  height: ROOM_DEPTH + STREET_DEPTH,
  minY: -STREET_DEPTH,
  blocked: new Set([
    ...furniture.filter(prop => prop.kind !== 'chair').map(prop => tileKey(prop, WIDTH)),
    // The entrance is the only connection between the pavement and the interior.
    ...Array.from({ length: WIDTH }, (_, x) => ({ x, y: DOOR_OUTSIDE.y }))
      .filter(tile => tile.x !== DOOR.x).map(tile => tileKey(tile, WIDTH)),
  ]),
};

export interface Recipe {
  id: string;
  name: string;
  cost: number;
  cookMs: number;
  portions: number;
  price: number;
  xp: number;
  requiredLevel: number;
  keepMs: number;
  animation: string;
  energy: number;
}

export const recipes: readonly Recipe[] = [
  { id: 'moon-stew', name: '沼のポタージュ', cost: 8, cookMs: 5000, portions: 2,
    price: 10, xp: 3, requiredLevel: 1, keepMs: 180000, animation: 'stew', energy: 14 },
  { id: 'fang-toast', name: 'キバのトースト', cost: 16, cookMs: 10500, portions: 5,
    price: 13, xp: 4, requiredLevel: 1, keepMs: 180000, animation: 'toast', energy: 26 },
  { id: 'crypt-pie', name: '墓場のミートパイ', cost: 32, cookMs: 17500, portions: 3,
    price: 26, xp: 7, requiredLevel: 1, keepMs: 180000, animation: 'pie', energy: 33 },
  { id: 'green-curry', name: 'ドクロカレー', cost: 38, cookMs: 21000, portions: 6,
    price: 22, xp: 7, requiredLevel: 2, keepMs: 180000, animation: 'curry', energy: 40 },
];

export const archetypes = [
  { name: '配達員', energy: 68, speed: 1.3, tip: 2, toxin: 1, temper: 17 },
  { name: '常連客', energy: 94, speed: 0.85, tip: 5, toxin: 2, temper: 14 },
  { name: '整備士', energy: 110, speed: 1.05, tip: 3, toxin: 2, temper: 20 },
  ...characterLooks.slice(3).map(look=>({name:look.name,energy:look.broad?110:look.old?94:80,speed:look.old?.85:look.broad?1.05:1,tip:3,toxin:1,temper:17})),
] as const;
