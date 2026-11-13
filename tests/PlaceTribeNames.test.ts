import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  PLACE_TRIBE_SUFFIXES,
  placeTribeName,
} from "@openfront/engine-lib/execution/utils/PlaceTribeNames";
import { SpawnExecution } from "@openfront/engine/execution/SpawnExecution";
import { TribeSpawner } from "@openfront/engine/execution/TribeSpawner";
import { Game } from "@openfront/engine/game/Game";
import { describe, expect, it } from "vitest";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const PLACES = [
  { name: "Gyeongju", coordinates: [10, 10] as [number, number] },
  { name: "Pohang", coordinates: [40, 10] as [number, number] },
  { name: "St. George", coordinates: [10, 40] as [number, number] },
];

describe("placeTribeName", () => {
  it("names a tribe after the nearest place, starting at the given suffix", () => {
    expect(placeTribeName(PLACES, 38, 12, new Set(), 0)).toBe("Pohang Village");
    expect(placeTribeName(PLACES, 12, 37, new Set(), 2)).toBe(
      `St. George ${PLACE_TRIBE_SUFFIXES[2]}`,
    );
  });

  it("moves to the next suffix, then the next place, when names are taken", () => {
    const allGyeongju = new Set(
      PLACE_TRIBE_SUFFIXES.map((s) => `Gyeongju ${s}`),
    );
    expect(placeTribeName(PLACES, 11, 11, new Set(["Gyeongju Village"]), 0)).toBe(
      "Gyeongju Town",
    );
    expect(placeTribeName(PLACES, 11, 11, allGyeongju, 0)).toMatch(
      /^(Pohang|St\. George) /,
    );
  });

  it("is null without places and wraps any start index", () => {
    expect(placeTribeName([], 0, 0, new Set(), 0)).toBeNull();
    expect(placeTribeName(PLACES, 10, 10, new Set(), -1)).toBe(
      `Gyeongju ${PLACE_TRIBE_SUFFIXES[PLACE_TRIBE_SUFFIXES.length - 1]}`,
    );
  });
});

describe("tribes on a map with places", () => {
  let game: Game;

  async function freshGame(places = PLACES): Promise<Game> {
    const g = await setup("big_plains", {}, [], undefined, undefined, false);
    g.setPlaces(places);
    return g;
  }

  function spawnAt(g: Game, id: string, x: number, y: number, byPlace: boolean) {
    g.addExecution(
      new SpawnExecution(
        "game_id",
        new PlayerInfo(`Theme ${id}`, PlayerType.Bot, null, id),
        g.ref(x, y),
        false,
        byPlace,
      ),
    );
  }

  it("renames a place-named tribe after where it lands, and keeps others' names", async () => {
    game = await freshGame();
    spawnAt(game, "a", 12, 12, true);
    spawnAt(game, "b", 13, 12, true);
    spawnAt(game, "c", 40, 40, false);
    executeTicks(game, 3);

    const a = game.player("a").name();
    const b = game.player("b").name();
    expect(a).toMatch(/^Gyeongju /);
    expect(b).toMatch(/^Gyeongju /);
    expect(a).not.toBe(b);
    expect(game.player("c").name()).toBe("Theme c");
  });

  it("only asks for place names when the map has places", async () => {
    const byPlace = (g: Game) =>
      new TribeSpawner(g, "game_id")
        .spawnTribes(3)
        .map((e) => (e as unknown as { nameByPlace: boolean }).nameByPlace);
    expect(byPlace(await freshGame())).toEqual([true, true, true]);
    expect(byPlace(await freshGame([]))).toEqual([false, false, false]);
  });

  it("draws the same theme names with or without places, so spawns don't move", async () => {
    const names = (g: Game) =>
      new TribeSpawner(g, "game_id")
        .spawnTribes(5)
        .map(
          (e) => (e as unknown as { playerInfo: PlayerInfo }).playerInfo.name,
        );
    expect(names(await freshGame())).toEqual(names(await freshGame([])));
  });
});
