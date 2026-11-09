import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";

/** Radius (tiles) of the gold ring drawn around a golden land. */
export const GOLDEN_LAND_RADIUS = 10;
/** Golden lands keep at least this far (tiles) apart. */
const MIN_GOLDEN_SPACING = 24;
/** A golden land keeps at least this far (tiles) from every city. */
const MIN_CITY_DISTANCE = 10;
/** How far (tiles) to look for land when a midpoint falls in water. */
const LAND_SEARCH_RADIUS = 8;

interface CityLike {
  coordinates?: [number, number] | number[];
}

/**
 * The map's golden lands: rich ground between neighbouring cities, worth
 * fighting over. For each city, the midpoint to its nearest neighbour becomes
 * a candidate; candidates on water move to the nearest land, and ones too
 * close to a city (a spawn) or to another golden land are dropped.
 *
 * Pure and deterministic, so the engine and the client derive the same list
 * from the same map and manifest. A player holds a golden land by owning its
 * centre tile.
 */
export function computeGoldenLands(
  map: GameMap,
  cities: readonly CityLike[],
): TileRef[] {
  const pts: [number, number][] = [];
  for (const c of cities) {
    const xy = c.coordinates;
    if (xy === undefined || xy.length < 2) continue;
    if (!map.isValidCoord(xy[0], xy[1])) continue;
    pts.push([xy[0], xy[1]]);
  }
  if (pts.length < 2) return [];

  const d2 = (ax: number, ay: number, bx: number, by: number) =>
    (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

  const seenPairs = new Set<number>();
  const result: TileRef[] = [];
  const minCity2 = MIN_CITY_DISTANCE * MIN_CITY_DISTANCE;
  const minGold2 = MIN_GOLDEN_SPACING * MIN_GOLDEN_SPACING;

  for (let i = 0; i < pts.length; i++) {
    let best = -1;
    let bestD = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      const d = d2(pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    const key = Math.min(i, best) * pts.length + Math.max(i, best);
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    const mx = (pts[i][0] + pts[best][0]) >> 1;
    const my = (pts[i][1] + pts[best][1]) >> 1;
    const tile = nearestLand(map, mx, my);
    if (tile === null) continue;
    const tx = map.x(tile);
    const ty = map.y(tile);
    if (pts.some(([cx, cy]) => d2(tx, ty, cx, cy) < minCity2)) continue;
    if (result.some((g) => d2(tx, ty, map.x(g), map.y(g)) < minGold2)) {
      continue;
    }
    result.push(tile);
  }
  return result;
}

function nearestLand(map: GameMap, cx: number, cy: number): TileRef | null {
  for (let r = 0; r <= LAND_SEARCH_RADIUS; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!map.isValidCoord(x, y)) continue;
        const t = map.ref(x, y);
        if (map.isLand(t)) return t;
      }
    }
  }
  return null;
}
