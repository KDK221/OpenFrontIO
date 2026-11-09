import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { ERA_DISABLED_UNITS } from "@openfront/shared/EraDefaults";
import { SpawnExecution } from "@openfront/engine/execution/SpawnExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "./util/Setup";
import { constructionExecution } from "./util/utils";

// Fire Attack = AtomBomb, Siege Camp = MissileSilo (re-themed for the era).
describe("Fire Attack siege range", () => {
  let game: Game;
  let attacker: Player;

  beforeEach(async () => {
    game = await setup("plains", { infiniteGold: true, instantBuild: true });
    const info = new PlayerInfo(
      "attacker_id",
      PlayerType.Human,
      null,
      "attacker_id",
    );
    game.addPlayer(info);
    game.addExecution(
      new SpawnExecution("game_id", game.player(info.id).info(), game.ref(1, 1)),
    );
    attacker = game.player("attacker_id");
    constructionExecution(game, attacker, 1, 1, UnitType.MissileSilo);
  });

  test("siege range is 120 tiles", () => {
    expect(Config.prototype.siegeRange.call({})).toBe(120);
  });

  test("a target inside siege range can be hit from the Siege Camp", () => {
    vi.spyOn(game.config(), "siegeRange").mockReturnValue(120);
    const silo = attacker.units(UnitType.MissileSilo)[0];
    const target = game.ref(30, 30);
    expect(attacker.canBuild(UnitType.AtomBomb, target)).toBe(silo.tile());
  });

  test("a target beyond siege range cannot be hit", () => {
    // The test map is only 100 wide, so shrink the range instead.
    vi.spyOn(game.config(), "siegeRange").mockReturnValue(10);
    expect(attacker.canBuild(UnitType.AtomBomb, game.ref(30, 30))).toBe(false);
    expect(attacker.canBuild(UnitType.AtomBomb, game.ref(8, 8))).not.toBe(
      false,
    );
  });

  test("flood attacks reach further than fire attacks", () => {
    const silo = attacker.units(UnitType.MissileSilo)[0];
    vi.spyOn(game.config(), "siegeRange").mockReturnValue(10);
    vi.spyOn(game.config(), "floodRange").mockReturnValue(100);
    expect(attacker.canBuild(UnitType.AtomBomb, game.ref(30, 30))).toBe(false);
    expect(attacker.canBuild(UnitType.HydrogenBomb, game.ref(30, 30))).toBe(
      silo.tile(),
    );
  });
});

describe("era defaults", () => {
  test("every unit is on: the SAM is the Ballista Tower", () => {
    expect(ERA_DISABLED_UNITS).toEqual([]);
  });
});
