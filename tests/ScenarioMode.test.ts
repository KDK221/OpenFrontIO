import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { Nation as ManifestNation } from "@openfront/engine-api/game/MapFiles";
import { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { ScenarioSpawnExecution } from "@openfront/engine/execution/ScenarioSpawnExecution";
import { SpawnExecution } from "@openfront/engine/execution/SpawnExecution";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const manifest: ManifestNation[] = [
  { name: "Pyongyang", flag: "Goguryeo", coordinates: [10, 10] },
  { name: "Gungnae", flag: "Goguryeo", coordinates: [40, 10] },
  { name: "Hanseong", flag: "Baekje", coordinates: [10, 40] },
  { name: "Gyeongju", flag: "Silla", coordinates: [40, 40] },
];

function gameStart(config: Partial<GameConfig>): GameStartInfo {
  return {
    gameID: "scenario1",
    lobbyCreatedAt: 0,
    players: [],
    config: {
      gameMap: GameMapType.Samguk,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Singleplayer,
      difficulty: Difficulty.Medium,
      nations: "default",
      donateGold: false,
      donateTroops: false,
      bots: 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      ...config,
    },
  };
}

describe("scenario mode: nations", () => {
  test("only the played faction's capital leaves the AI", () => {
    const nations = createNationsForGame(
      gameStart({ scenarioFaction: "Goguryeo" }),
      manifest,
      [],
      1,
      new PseudoRandom(1),
    );
    expect(nations.map((n) => n.playerInfo.name)).toEqual([
      "Gungnae",
      "Hanseong",
      "Gyeongju",
    ]);
  });

  test("free mode keeps every city", () => {
    const nations = createNationsForGame(
      gameStart({}),
      manifest,
      [],
      1,
      new PseudoRandom(1),
    );
    expect(nations).toHaveLength(4);
  });
});

describe("free mode: extra nations", () => {
  test("get era names and banners on the historical maps", () => {
    const nations = createNationsForGame(
      gameStart({ nations: 10 }),
      manifest,
      [],
      1,
      new PseudoRandom(3),
    );
    expect(nations).toHaveLength(10);
    const extras = nations.filter(
      (n) => !manifest.some((m) => m.name === n.playerInfo.name),
    );
    expect(extras).toHaveLength(6);
    for (const n of extras) {
      expect(n.playerInfo.name).toMatch(
        / (Kingdom|Confederacy|Chiefdom|Realm)( \d+)?$/,
      );
      expect(n.playerInfo.nationFlag).toMatch(/^era_banner_(0[1-9]|1[0-6])$/);
    }
    expect(new Set(nations.map((n) => n.playerInfo.name)).size).toBe(10);
  });

  test("other maps keep the procedural names", () => {
    const nations = createNationsForGame(
      gameStart({ nations: 6, gameMap: GameMapType.World }),
      manifest,
      [],
      1,
      new PseudoRandom(3),
    );
    const extras = nations.filter(
      (n) => !manifest.some((m) => m.name === n.playerInfo.name),
    );
    expect(extras).toHaveLength(2);
    for (const n of extras) expect(n.playerInfo.nationFlag).toBeNull();
  });
});

describe("scenario mode: spawn", () => {
  const human = new PlayerInfo(
    "Goguryeo",
    PlayerType.Human,
    "client1",
    "human_id",
    false,
    null,
    [],
    null,
    "Goguryeo",
  );

  async function scenarioGame() {
    return setup(
      "plains",
      { scenarioFaction: "Goguryeo" },
      [human],
      undefined,
      undefined,
      false, // keep the spawn phase running
    );
  }

  test("the player starts on every faction city, capital first", async () => {
    const game = await scenarioGame();
    const capital = game.ref(10, 10);
    const second = game.ref(40, 10);
    game.addExecution(new ScenarioSpawnExecution(human, [capital, second]));
    executeTicks(game, ScenarioSpawnExecution.DELAY + 2);

    const player = game.player("human_id");
    expect(player.hasSpawned()).toBe(true);
    expect(game.owner(capital)).toBe(player);
    expect(game.owner(second)).toBe(player);
    expect(player.spawnTile()).toBe(capital);
    expect(player.info().nationFlag).toBe("Goguryeo");
    // Singleplayer: placing the player ends the spawn phase.
    expect(game.inSpawnPhase()).toBe(false);
  });

  test("a city on taken land moves to the nearest free land", async () => {
    const game = await scenarioGame();
    const other = game.addPlayer(
      new PlayerInfo("Baekje", PlayerType.Nation, null, "other_id"),
    );
    const city = game.ref(20, 20);
    other.conquer(city);
    game.addExecution(new ScenarioSpawnExecution(human, [city]));
    executeTicks(game, ScenarioSpawnExecution.DELAY + 2);

    const player = game.player("human_id");
    expect(game.owner(city)).toBe(other);
    expect(player.spawnTile()).not.toBe(city);
    expect(player.numTilesOwned()).toBeGreaterThan(0);
  });

  test("the player can't pick another spawn", async () => {
    const game = await scenarioGame();
    game.addExecution(
      new ScenarioSpawnExecution(human, [game.ref(10, 10)]),
      new SpawnExecution("scenario1", human, game.ref(60, 60), true),
    );
    executeTicks(game, ScenarioSpawnExecution.DELAY + 2);
    const player = game.player("human_id");
    expect(game.owner(game.ref(10, 10))).toBe(player);
    expect(game.hasOwner(game.ref(60, 60))).toBe(false);
  });

  test("spawn is assigned in scenario mode, chosen in free mode", async () => {
    const scenario = await scenarioGame();
    expect(scenario.config().scenarioFaction()).toBe("Goguryeo");
    expect(scenario.config().isSpawnAssigned()).toBe(true);
    const free = await setup("plains", {});
    expect(free.config().scenarioFaction()).toBeNull();
    expect(free.config().isSpawnAssigned()).toBe(false);
  });
});
