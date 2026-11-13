import type { MapPlace } from "@openfront/engine-api/game/MapFiles";

/**
 * Words that follow a place name in a tribe's name on maps with real places
 * ("Gyeongju Village"). The client localizes both halves.
 */
export const PLACE_TRIBE_SUFFIXES = [
  "Village",
  "Town",
  "Militia",
  "Guard",
  "Clan",
  "Union",
  "Commune",
  "Rebels",
] as const;

// How many of the nearest places a tribe may be named after before names
// start repeating: near enough to still say where it is.
const NEAREST = 6;

/**
 * The name for a tribe that spawned at (x, y): the nearest place with a
 * suffix no player has taken yet, trying the closest few places in turn.
 * `start` picks which suffix to try first, so tribes at one place don't all
 * come out as "… Village". When every combination nearby is taken the
 * nearest place's first choice is reused. Null without places.
 *
 * Pure: the same places, position, taken names and start give the same name
 * on every client.
 */
export function placeTribeName(
  places: readonly MapPlace[],
  x: number,
  y: number,
  taken: ReadonlySet<string>,
  start: number,
): string | null {
  if (places.length === 0) return null;
  const nearest = places
    .map((p, i) => ({
      p,
      i,
      d: (p.coordinates[0] - x) ** 2 + (p.coordinates[1] - y) ** 2,
    }))
    // Index breaks ties, so equal distances never depend on sort stability.
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, NEAREST);
  const n = PLACE_TRIBE_SUFFIXES.length;
  const first = ((start % n) + n) % n;
  for (const { p } of nearest) {
    for (let k = 0; k < n; k++) {
      const name = `${p.name} ${PLACE_TRIBE_SUFFIXES[(first + k) % n]}`;
      if (!taken.has(name)) return name;
    }
  }
  return `${nearest[0].p.name} ${PLACE_TRIBE_SUFFIXES[first]}`;
}
