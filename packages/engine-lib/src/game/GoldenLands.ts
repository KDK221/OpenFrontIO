import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "../PseudoRandom";

/**
 * Golden lands: rich farmland that speeds up troop growth for whoever holds
 * it. Each is an irregular patch of land grown from a centre tile; a player
 * gets the bonus in proportion to how much of each patch they own.
 *
 * Everything here is pure and deterministic, so the engine, the client and a
 * restored game all derive the same lands from the same inputs.
 */
export interface GoldenLand {
  center: TileRef;
  /** Every land tile of the patch, centre included. */
  tiles: TileRef[];
}

/** Typical patch radius (tiles) on a normal-size map. */
export const GOLDEN_LAND_RADIUS = 18;
/** Free mode: patches keep at least this many radii apart. */
const FREE_MODE_SPACING = 2.5;
/** How far (tiles) to look for land when a centre falls in water. */
const LAND_SEARCH_RADIUS = 10;
/** Free mode: golden lands on a map with no scenario list. */
const FREE_MODE_DEFAULT_COUNT = 12;

/**
 * Real fertile plains and basins of each scenario map (normal-size tile
 * coordinates), projected from latitude/longitude with the same fit as the
 * map's cities. Scenario mode places the golden lands here.
 */
export const FERTILE_LANDS: Partial<Record<GameMapType, [number, number][]>> = {
  // Honam, Naju, Gimpo, Naepo, Nonsan, Gimhae, Angang, Jaeryeong,
  // Daedong, Anju, Hamhung, Jinju, Sangju.
  [GameMapType.Samguk]: [
    [446, 1596],
    [401, 1768],
    [414, 1223],
    [423, 1413],
    [475, 1519],
    [799, 1722],
    [847, 1554],
    [222, 1062],
    [213, 956],
    [230, 803],
    [571, 752],
    [659, 1720],
    [685, 1463],
    // Gameplay resources for the opened northern frontier.
    [160, 390],
    [810, 260],
  ],
  // Kanto, Nobi, Echigo, Kawachi, Nara, Omi, Ise, Kofu, Shonai, Sendai,
  // Tsugaru, Akita, Toyama, Kaga, Izumo, Okayama, Sanuki, Tsukushi,
  // Kumamoto, Miyazaki, Harima, Aizu, Yamagata, Matsumoto, Fukui, Kochi.
  [GameMapType.Sengoku]: [
    [1564, 1180],
    [1274, 1271],
    [1509, 962],
    [1164, 1337],
    [1184, 1355],
    [1214, 1289],
    [1254, 1337],
    [1464, 1222],
    [1589, 835],
    [1699, 914],
    [1644, 599],
    [1614, 732],
    [1319, 1095],
    [1259, 1120],
    [879, 1255],
    [994, 1347],
    [999, 1392],
    [649, 1513],
    [669, 1573],
    [744, 1664],
    [1074, 1319],
    [1594, 992],
    [1634, 902],
    [1399, 1150],
    [1229, 1168],
    [964, 1473],
  ],
  // Guanzhong, Chengdu, Hanzhong, Jianghan, Dongting, Taihu, Ningshao,
  // Huaibei, Central Plain, Luoyang, Hebei, Qi, Fen valley, Hetao, Liao,
  // Pearl delta, Nanyang, Jiaolai, Poyang.
  [GameMapType.WarringStates]: [
    [1436, 1231],
    [1255, 1427],
    [1375, 1305],
    [1624, 1388],
    [1606, 1454],
    [1882, 1283],
    [1928, 1329],
    [1721, 1240],
    [1645, 1185],
    [1563, 1197],
    [1636, 1003],
    [1716, 1056],
    [1507, 1105],
    [1345, 947],
    [1818, 782],
    [1704, 1729],
    [1573, 1279],
    [1803, 1041],
    [1757, 1429],
  ],
};

export interface GoldenLandOptions {
  mapType: GameMapType;
  mapSize: GameMapSize;
  /** Scenario mode uses the real fertile lands; free mode places at random. */
  scenario: boolean;
  /** Free mode's seed (e.g. a hash of the game id). */
  seed: number;
}

/** The game's golden lands. Call on the pristine map, before any nukes. */
export function goldenLandsFor(
  map: GameMap,
  opts: GoldenLandOptions,
): GoldenLand[] {
  const scale = opts.mapSize === GameMapSize.Compact ? 0.5 : 1;
  const radius = Math.max(4, Math.round(GOLDEN_LAND_RADIUS * scale));
  const fertile = FERTILE_LANDS[opts.mapType];

  let centers: TileRef[];
  if (opts.scenario && fertile !== undefined) {
    centers = [];
    for (const [x, y] of fertile) {
      const t = nearestLand(map, Math.floor(x * scale), Math.floor(y * scale));
      if (t !== null) centers.push(t);
    }
  } else {
    centers = randomCenters(
      map,
      fertile?.length ?? FREE_MODE_DEFAULT_COUNT,
      radius,
      opts.seed,
    );
  }

  const claimed = new Set<TileRef>();
  const lands: GoldenLand[] = [];
  for (const center of centers) {
    if (claimed.has(center)) continue;
    const tiles = growPatch(map, center, radius, claimed);
    if (tiles.length === 0) continue;
    for (const t of tiles) claimed.add(t);
    lands.push({ center, tiles });
  }
  return lands;
}

/**
 * Each player's golden-land share: for every land, the fraction of its tiles
 * the player owns, summed over the lands. Keyed by owner small id (0, no
 * owner, is skipped).
 */
export function goldenShares(
  lands: readonly GoldenLand[],
  ownerID: (t: TileRef) => number,
): Map<number, number> {
  const shares = new Map<number, number>();
  for (const land of lands) {
    const counts = new Map<number, number>();
    for (const t of land.tiles) {
      const o = ownerID(t);
      if (o === 0) continue;
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }
    for (const [o, n] of counts) {
      shares.set(o, (shares.get(o) ?? 0) + n / land.tiles.length);
    }
  }
  return shares;
}

/** A 1-bit-per-tile mask (0 or 255) of every golden-land tile, for drawing. */
export function goldenLandMask(
  map: { width(): number; height(): number },
  lands: readonly GoldenLand[],
): Uint8Array {
  const mask = new Uint8Array(map.width() * map.height());
  for (const land of lands) {
    for (const t of land.tiles) mask[t] = 255;
  }
  return mask;
}

/**
 * Land a golden field can cover: not water, and not impassable terrain (the
 * void a map uses to close off its edges, e.g. Samguk above its northern
 * frontier).
 */
function isFarmland(map: GameMap, t: TileRef): boolean {
  return map.isLand(t) && !map.isImpassable(t);
}

/**
 * Grows an irregular patch from `center` across connected land: a tile joins
 * while within the radius, stretched or shrunk by smooth value noise so the
 * edge wanders like a field boundary instead of a circle.
 */
function growPatch(
  map: GameMap,
  center: TileRef,
  radius: number,
  claimed: Set<TileRef>,
): TileRef[] {
  const cx = map.x(center);
  const cy = map.y(center);
  const seed = cx * 73856093 + cy * 19349663;
  const tiles: TileRef[] = [];
  const seen = new Set<TileRef>([center]);
  const queue: TileRef[] = [center];
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head];
    tiles.push(t);
    const x = map.x(t);
    const y = map.y(t);
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (!map.isValidCoord(nx, ny)) continue;
      const n = map.ref(nx, ny);
      if (seen.has(n)) continue;
      seen.add(n);
      if (!isFarmland(map, n) || claimed.has(n)) continue;
      const reach = radius * (0.45 + 1.1 * valueNoise(nx, ny, 7, seed));
      const dx = nx - cx;
      const dy = ny - cy;
      if (dx * dx + dy * dy > reach * reach) continue;
      queue.push(n);
    }
  }
  return tiles;
}

/** Smooth noise in [0, 1]: bilinear blend of hashed values on a grid. */
function valueNoise(x: number, y: number, cell: number, seed: number): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = (x - gx * cell) / cell;
  const fy = (y - gy * cell) / cell;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(gx, gy, seed);
  const b = hash01(gx + 1, gy, seed);
  const c = hash01(gx, gy + 1, seed);
  const d = hash01(gx + 1, gy + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

/** Integer hash of a grid point to [0, 1). */
function hash01(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function randomCenters(
  map: GameMap,
  count: number,
  radius: number,
  seed: number,
): TileRef[] {
  const random = new PseudoRandom(seed);
  const spacing2 = (FREE_MODE_SPACING * radius) ** 2;
  const centers: TileRef[] = [];
  const maxTries = count * 200;
  for (let i = 0; i < maxTries && centers.length < count; i++) {
    const x = random.nextInt(0, map.width());
    const y = random.nextInt(0, map.height());
    const t = map.ref(x, y);
    if (!isFarmland(map, t)) continue;
    if (
      centers.some((c) => {
        const dx = map.x(c) - x;
        const dy = map.y(c) - y;
        return dx * dx + dy * dy < spacing2;
      })
    ) {
      continue;
    }
    centers.push(t);
  }
  return centers;
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
        if (isFarmland(map, t)) return t;
      }
    }
  }
  return null;
}
