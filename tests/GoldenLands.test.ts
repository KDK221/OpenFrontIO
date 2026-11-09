import {
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import {
  computeGoldenLands,
  GOLDEN_LAND_RADIUS,
} from "@openfront/engine-lib/game/GoldenLands";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import { setup } from "./util/Setup";

describe("golden lands", () => {
  test("sit between neighbouring cities, away from the cities", async () => {
    const game = await setup("plains", {});
    const cities = [
      { coordinates: [10, 50] },
      { coordinates: [50, 50] },
      { coordinates: [90, 50] },
    ];
    const golden = computeGoldenLands(game.map(), cities);
    expect(golden.map((t) => [game.x(t), game.y(t)])).toEqual([
      [30, 50],
      [70, 50],
    ]);
  });

  test("drop candidates too close to a city or to each other", async () => {
    const game = await setup("plains", {});
    // Two cities 8 tiles apart: their midpoint is 4 from each city.
    expect(
      computeGoldenLands(game.map(), [
        { coordinates: [10, 10] },
        { coordinates: [18, 10] },
      ]),
    ).toEqual([]);
    // Mirror pairs share one midpoint, so it is kept once.
    const twice = computeGoldenLands(game.map(), [
      { coordinates: [10, 60] },
      { coordinates: [60, 60] },
    ]);
    expect(twice).toHaveLength(1);
  });

  test("are deterministic", async () => {
    const game = await setup("plains", {});
    const cities = [
      { coordinates: [5, 5] },
      { coordinates: [40, 12] },
      { coordinates: [80, 70] },
      { coordinates: [30, 90] },
    ];
    expect(computeGoldenLands(game.map(), cities)).toEqual(
      computeGoldenLands(game.map(), cities),
    );
    expect(GOLDEN_LAND_RADIUS).toBeGreaterThan(0);
  });

  test("holding one multiplies troop growth by 1.3", async () => {
    const game = await setup("plains", {}, [
      new PlayerInfo("a", PlayerType.Human, null, "a_id"),
      new PlayerInfo("b", PlayerType.Human, null, "b_id"),
    ]);
    while (game.inSpawnPhase()) game.executeNextTick();
    const a = game.player("a_id");
    const b = game.player("b_id");
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        a.conquer(game.ref(x, y));
        b.conquer(game.ref(x + 20, y));
      }
    }
    game.setGoldenLands([game.ref(5, 5)]);
    expect(game.holdsGoldenLand(a)).toBe(true);
    expect(game.holdsGoldenLand(b)).toBe(false);
    expect(game.config().goldenLandTroopMultiplier()).toBe(1.3);

    a.setTroops(1000);
    b.setTroops(1000);
    const ea = new PlayerExecution(a);
    const eb = new PlayerExecution(b);
    ea.init(game, game.ticks());
    eb.init(game, game.ticks());
    ea.tick(game.ticks());
    eb.tick(game.ticks());
    const gainA = a.troops() - 1000;
    const gainB = b.troops() - 1000;
    expect(gainB).toBeGreaterThan(0);
    expect(gainA / gainB).toBeCloseTo(1.3, 1);
  });
});
