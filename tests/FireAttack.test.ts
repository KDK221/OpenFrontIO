import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
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
    expect(game.config().siegeRange()).toBe(120);
  });

  test("a target inside siege range can be hit from the Siege Camp", () => {
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

  test("hydrogen bombs keep the unlimited silo reach", () => {
    const silo = attacker.units(UnitType.MissileSilo)[0];
    expect(attacker.canBuild(UnitType.HydrogenBomb, game.ref(30, 30))).toBe(
      silo.tile(),
    );
  });
});

describe("era defaults", () => {
  test("Siege Camp and Fire Attack are enabled by default", () => {
    expect(ERA_DISABLED_UNITS).not.toContain(UnitType.MissileSilo);
    expect(ERA_DISABLED_UNITS).not.toContain(UnitType.AtomBomb);
  });

  test("hydrogen bomb, MIRV and SAM stay disabled", () => {
    expect(ERA_DISABLED_UNITS).toEqual(
      expect.arrayContaining([
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.SAMLauncher,
      ]),
    );
  });
});
