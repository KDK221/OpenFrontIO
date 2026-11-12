import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { MirvExecution } from "@openfront/engine/execution/MIRVExecution";
import { PlagueExecution } from "@openfront/engine/execution/PlagueExecution";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
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

  test("defaults: no water needed, 250 tile reach", async () => {
    const { Config } = await import(
      "@openfront/engine-lib/configuration/Config"
    );
    const proto = Config.prototype;
    expect(proto.floodNeedsWater.call({})).toBe(false);
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

  // With troop growth running, as in a real game. At 1% a step the target
  // regrew nearly everything and the plague looked like it did nothing.
  test("still takes a big bite out of a growing army", async () => {
    async function run(withPlague: boolean) {
      const game = await setup("plains", { infiniteGold: true, instantBuild: true });
      const a = game.addPlayer(new PlayerInfo("a", PlayerType.Human, null, "a"));
      const b = game.addPlayer(new PlayerInfo("b", PlayerType.Human, null, "b"));
      conquerRect(game, a, 0, 0, 30, 30);
      conquerRect(game, b, 40, 0, 90, 60);
      game.addExecution(new PlayerExecution(a), new PlayerExecution(b));
      while (game.inSpawnPhase()) game.executeNextTick();
      a.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
      executeTicks(game, 600);
      if (withPlague) game.addExecution(new PlagueExecution(a, game.ref(60, 30)));
      executeTicks(game, PlagueExecution.DURATION);
      return b.troops();
    }
    const healthy = await run(false);
    const plagued = await run(true);
    expect(plagued).toBeLessThan(healthy * 0.7);
  });

  test("reports the troops it took when it ends", async () => {
    const { game, a, b } = await plagueGame();
    const spy = vi.spyOn(game, "displayMessage");
    const plague = new PlagueExecution(a, game.ref(15, 5));
    game.addExecution(plague);
    executeTicks(game, PlagueExecution.DURATION + 5);
    expect(plague.troopsLost(b)).toBeGreaterThan(0);
    const keys = spy.mock.calls.map((c) => c[0]);
    expect(keys).toContain("events_display.plague_ended");
    expect(keys).toContain("events_display.plague_ended_victim");
    const toCaster = spy.mock.calls.find(
      (c) => c[0] === "events_display.plague_ended" && c[2] === a.id(),
    );
    expect(toCaster?.[4]).toMatchObject({ name: b.displayName() });
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

  test("costs 15M, +5M per plague already released", async () => {
    const { game, a } = await plagueGame();
    vi.spyOn(game.config(), "plagueReplacesMirv").mockReturnValue(true);
    vi.spyOn(game.config(), "infiniteGold").mockReturnValue(false);
    const cost = () => game.config().unitInfo(UnitType.MIRV).cost(game, a);
    expect(cost()).toBe(15_000_000n);
    a.addGold(100_000_000n);
    game.addExecution(new PlagueExecution(a, game.ref(15, 5)));
    executeTicks(game, 3);
    expect(cost()).toBe(20_000_000n);
  });

  test("UI construction charges once, confirms release, and drains troops", async () => {
    const { game, a, b } = await plagueGame();
    vi.spyOn(game.config(), "plagueReplacesMirv").mockReturnValue(true);
    vi.spyOn(game.config(), "infiniteGold").mockReturnValue(false);
    a.addGold(100_000_000n);
    const charge = vi.spyOn(a, "removeGold");
    const message = vi.spyOn(game, "displayMessage");
    game.addExecution(new ConstructionExecution(a, UnitType.MIRV, game.ref(15, 5)));
    executeTicks(game, 25);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith(15_000_000n);
    expect(b.troops()).toBeLessThan(100_000);
    expect(message).toHaveBeenCalledWith(
      "events_display.plague_released", MessageType.MIRV_INBOUND,
      a.id(), undefined, { name: b.displayName(), seconds: 90 }, undefined, b.id(),
    );
  });

  test("a rejected release does not charge or increase the next price", async () => {
    const { game, a } = await plagueGame();
    vi.spyOn(game.config(), "plagueReplacesMirv").mockReturnValue(true);
    vi.spyOn(game.config(), "infiniteGold").mockReturnValue(false);
    a.addGold(100_000_000n);
    a.units(UnitType.MissileSilo)[0].delete(false);
    const charge = vi.spyOn(a, "removeGold");
    game.addExecution(new ConstructionExecution(a, UnitType.MIRV, game.ref(15, 5)));
    executeTicks(game, 4);
    expect(charge).not.toHaveBeenCalled();
    expect(game.unitInfo(UnitType.MIRV).cost(game, a)).toBe(15_000_000n);
  });

  test("fire and flood attacks cost 1.5M and 8M in the eras", async () => {
    const { game, a } = await plagueGame();
    vi.spyOn(game.config(), "plagueReplacesMirv").mockReturnValue(true);
    vi.spyOn(game.config(), "infiniteGold").mockReturnValue(false);
    const cost = (t: UnitType) => game.config().unitInfo(t).cost(game, a);
    expect(cost(UnitType.AtomBomb)).toBe(1_500_000n);
    expect(cost(UnitType.HydrogenBomb)).toBe(8_000_000n);
  });
});
