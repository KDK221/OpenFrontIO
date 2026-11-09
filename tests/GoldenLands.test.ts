import {
  GameMapSize,
  GameMapType,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import {
  FERTILE_LANDS,
  goldenLandMask,
  goldenLandsFor,
  goldenShares,
} from "@openfront/engine-lib/game/GoldenLands";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import { setup } from "./util/Setup";

describe("golden lands: placement", () => {
  test("free mode places them at random but repeatably per seed", async () => {
    const game = await setup("plains", {});
    const opts = {
      mapType: GameMapType.Samguk,
      mapSize: GameMapSize.Normal,
      scenario: false,
      seed: 42,
    };
    const a = goldenLandsFor(game.map(), opts);
    const b = goldenLandsFor(game.map(), opts);
    expect(a.map((l) => l.center)).toEqual(b.map((l) => l.center));
    expect(a.length).toBeGreaterThan(0);
    const c = goldenLandsFor(game.map(), { ...opts, seed: 43 });
    expect(c.map((l) => l.center)).not.toEqual(a.map((l) => l.center));
  });

  test("scenario mode starts from the real fertile lands", async () => {
    const game = await setup("plains", {});
    // The plains test map is 100x100, so use a map type with no list to
    // check the fallback, and the fertile table's shape for the rest.
    for (const type of [
      GameMapType.Samguk,
      GameMapType.Sengoku,
      GameMapType.WarringStates,
    ]) {
      expect(FERTILE_LANDS[type]!.length).toBeGreaterThan(10);
    }
    const lands = goldenLandsFor(game.map(), {
      mapType: GameMapType.World,
      mapSize: GameMapSize.Normal,
      scenario: true,
      seed: 1,
    });
    expect(lands.length).toBeGreaterThan(0);
  });

  test("patches are land only, irregular, and never overlap", async () => {
    const game = await setup("half_land_half_ocean", {});
    const lands = goldenLandsFor(game.map(), {
      mapType: GameMapType.World,
      mapSize: GameMapSize.Normal,
      scenario: false,
      seed: 7,
    });
    const seen = new Set<number>();
    for (const land of lands) {
      expect(land.tiles).toContain(land.center);
      for (const t of land.tiles) {
        expect(game.map().isLand(t)).toBe(true);
        expect(seen.has(t)).toBe(false);
        seen.add(t);
      }
    }
    const mask = goldenLandMask(game.map(), lands);
    expect(mask.filter((v) => v === 255).length).toBe(seen.size);
  });
});

describe("golden lands: proportional bonus", () => {
  test("shares split a land by the tiles each player owns", () => {
    const land = { center: 0, tiles: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
    const owner = (t: number) => (t < 6 ? 1 : t < 10 ? 2 : 0);
    const shares = goldenShares([land], owner);
    expect(shares.get(1)).toBeCloseTo(0.6);
    expect(shares.get(2)).toBeCloseTo(0.4);
  });

  test("+10% per whole land, summed, capped at +50%", async () => {
    const game = await setup("plains", {});
    const c = game.config();
    expect(c.goldenLandMultiplier(0)).toBe(1);
    expect(c.goldenLandMultiplier(1)).toBeCloseTo(1.1);
    expect(c.goldenLandMultiplier(0.6)).toBeCloseTo(1.06);
    expect(c.goldenLandMultiplier(2.5)).toBeCloseTo(1.25);
    expect(c.goldenLandMultiplier(9)).toBeCloseTo(1.5);
  });

  test("troop growth follows the share", async () => {
    const game = await setup("plains", {}, [
      new PlayerInfo("a", PlayerType.Human, null, "a_id"),
      new PlayerInfo("b", PlayerType.Human, null, "b_id"),
    ]);
    while (game.inSpawnPhase()) game.executeNextTick();
    const a = game.player("a_id");
    const b = game.player("b_id");
    const tiles: number[] = [];
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        const t = game.ref(x, y);
        tiles.push(t);
        (x < 6 ? a : b).conquer(t);
      }
    }
    // One land split 60/40 between a and b.
    game.setGoldenLands([{ center: tiles[0], tiles }]);
    expect(game.goldenShare(a)).toBeCloseTo(0.6);
    expect(game.goldenShare(b)).toBeCloseTo(0.4);

    // Same troops and similar size: compare growth with and without lands.
    a.setTroops(1000);
    const ea = new PlayerExecution(a);
    ea.init(game, game.ticks());
    ea.tick(game.ticks());
    const withLand = a.troops() - 1000;

    game.setGoldenLands([]);
    a.setTroops(1000);
    ea.tick(game.ticks());
    const without = a.troops() - 1000;
    expect(without).toBeGreaterThan(0);
    expect(withLand / without).toBeCloseTo(1.06, 2);
  });
});
