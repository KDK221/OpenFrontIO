import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { MirvExecution } from "@openfront/engine/execution/MIRVExecution";
import { PlagueExecution } from "@openfront/engine/execution/PlagueExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

function conquerRect(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let x = x0; x < x1; x++) {
    for (let y = y0; y < y1; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}

async function threePlayers(map: string) {
  const game = await setup(map, { infiniteGold: true, instantBuild: true }, [
    new PlayerInfo("a", PlayerType.Human, null, "a_id"),
    new PlayerInfo("b", PlayerType.Human, null, "b_id"),
    new PlayerInfo("c", PlayerType.Human, null, "c_id"),
  ]);
  while (game.inSpawnPhase()) game.executeNextTick();
  return {
    game,
    a: game.player("a_id"),
    b: game.player("b_id"),
    c: game.player("c_id"),
  };
}

describe("Flood Attack (hydrogen bomb slot)", () => {
  test("needs water near the target", async () => {
    const { game, a } = await threePlayers("plains");
    vi.spyOn(game.config(), "floodNeedsWater").mockReturnValue(true);
    conquerRect(game, a, 0, 0, 10, 10);
    const silo = a.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
    // An all-land map has no water anywhere.
    expect(a.canBuild(UnitType.HydrogenBomb, game.ref(40, 40))).toBe(false);
    vi.spyOn(game.config(), "floodNeedsWater").mockReturnValue(false);
    expect(a.canBuild(UnitType.HydrogenBomb, game.ref(40, 40))).toBe(
      silo.tile(),
    );
  });

  test("can strike land next to the sea", async () => {
    const { game, a } = await threePlayers("half_land_half_ocean");
    vi.spyOn(game.config(), "floodNeedsWater").mockReturnValue(true);
    let land = -1;
    for (let i = 0; i < game.width() * game.height(); i++) {
      if (game.isLand(i)) {
        land = i;
        break;
      }
    }
    expect(land).toBeGreaterThanOrEqual(0);
    a.conquer(land);
    const silo = a.buildUnit(UnitType.MissileSilo, land, {});
    expect(a.canBuild(UnitType.HydrogenBomb, land)).toBe(silo.tile());
  });

  test("defaults: water required, 250 tile reach, 25 tile water check", async () => {
    const { Config } = await import(
      "@openfront/engine-lib/configuration/Config"
    );
    const proto = Config.prototype;
    expect(proto.floodNeedsWater.call({})).toBe(true);
    expect(proto.floodRange.call({})).toBe(250);
    expect(proto.floodWaterRange.call({})).toBe(25);
  });
});

describe("Plague (MIRV slot)", () => {
  async function plagueGame() {
    const p = await threePlayers("plains");
    // a | b | c side by side: a borders b, b borders c, a doesn't border c.
    conquerRect(p.game, p.a, 0, 0, 10, 10);
    conquerRect(p.game, p.b, 10, 0, 20, 10);
    conquerRect(p.game, p.c, 20, 0, 30, 10);
    p.a.buildUnit(UnitType.MissileSilo, p.game.ref(5, 5), {});
    for (const pl of [p.a, p.b, p.c]) pl.setTroops(100_000);
    return p;
  }

  test("drains the target's troops but not its land", async () => {
    const { game, a, b } = await plagueGame();
    const tiles = b.numTilesOwned();
    const plague = new PlagueExecution(a, game.ref(15, 5));
    game.addExecution(plague);
    executeTicks(game, 101);
    expect(plague.infectedPlayers()).toContain(b);
    expect(b.troops()).toBeLessThan(100_000 * 0.95);
    expect(b.numTilesOwned()).toBe(tiles);
  });

  test("spreads to neighbors but never to the one who released it", async () => {
    const { game, a, b, c } = await plagueGame();
    const plague = new PlagueExecution(a, game.ref(15, 5));
    game.addExecution(plague);
    executeTicks(game, PlagueExecution.DURATION);
    expect(plague.infectedPlayers()).toContain(c);
    expect(plague.infectedPlayers()).not.toContain(a);
    expect(a.troops()).toBeGreaterThanOrEqual(100_000);
    expect(b.troops()).toBeLessThan(100_000 * 0.6);
  });

  test("ends after its duration and puts the Siege Camp on cooldown", async () => {
    const { game, a } = await plagueGame();
    const plague = new PlagueExecution(a, game.ref(15, 5));
    game.addExecution(plague);
    executeTicks(game, 3);
    expect(a.units(UnitType.MissileSilo)[0].isInCooldown()).toBe(true);
    executeTicks(game, PlagueExecution.DURATION + 5);
    expect(plague.isActive()).toBe(false);
  });

  test("needs a ready Siege Camp", async () => {
    const { game, a } = await plagueGame();
    a.units(UnitType.MissileSilo)[0].delete(false);
    const plague = new PlagueExecution(a, game.ref(15, 5));
    game.addExecution(plague);
    executeTicks(game, 3);
    expect(plague.isActive()).toBe(false);
    expect(plague.infectedPlayers()).toHaveLength(0);
  });

  test("the MIRV build becomes a plague when the config says so", async () => {
    const { game, a } = await plagueGame();
    vi.spyOn(game.config(), "plagueReplacesMirv").mockReturnValue(true);
    game.addExecution(new ConstructionExecution(a, UnitType.MIRV, game.ref(15, 5)));
    executeTicks(game, 4);
    const execs = (
      game as unknown as { executions(): object[] }
    ).executions();
    expect(execs.some((e) => e instanceof PlagueExecution)).toBe(true);
    expect(execs.some((e) => e instanceof MirvExecution)).toBe(false);
    expect(a.units(UnitType.MIRV)).toHaveLength(0);
  });
});
