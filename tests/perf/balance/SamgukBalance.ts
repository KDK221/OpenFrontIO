import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import { goldenLandsFor } from "@openfront/engine-lib/game/GoldenLands";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { createGame } from "@openfront/engine/game/GameImpl";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
/** AI-only geographical benchmark. Cities sharing a flag are independent lords,
 * not a united team. Capital outcomes are proxies, not human win probabilities.
 * Usage: node --import tsx tests/perf/balance/SamgukBalance.ts seed easy 6000 output.json
 */
import fs from "node:fs";
import path from "node:path";
import { NodeGameMapLoader } from "../fullgame/NodeGameMapLoader";

const [
  seed = "balance01",
  difficulty = "easy",
  ticksArg = "6000",
  out = "/tmp/balance-pilot.json",
] = process.argv.slice(2);
const ticks = Number(ticksArg);
const config: GameStartInfo["config"] = {
  gameMap: GameMapType.Samguk,
  gameMapSize: GameMapSize.Normal,
  gameMode: GameMode.FFA,
  gameType: GameType.Singleplayer,
  difficulty: ({ easy: Difficulty.Easy, medium: Difficulty.Medium, hard: Difficulty.Hard } as Record<string, Difficulty>)[difficulty] ?? (() => { throw new Error("Unsupported difficulty: " + difficulty); })(),
  nations: "default",
  bots: 400,
  donateGold: false,
  donateTroops: false,
  infiniteGold: false,
  infiniteTroops: false,
  instantBuild: false,
  randomSpawn: false,
  disabledUnits: [],
};
const start: GameStartInfo = {
  gameID: seed,
  lobbyCreatedAt: 0,
  config,
  players: [],
};
const terrain = await loadTerrainMap(
  await loadMapFiles(
    new NodeGameMapLoader(path.resolve("resources/maps")),
    config.gameMap,
    config.gameMapSize,
  ),
);
const manifest = JSON.parse(
  fs.readFileSync("resources/maps/samguk/manifest.json", "utf8"),
);
const capitals = new Map<string, string>();
for (const n of manifest.nations)
  if (!capitals.has(n.flag)) capitals.set(n.flag, n.name);
const nations = createNationsForGame(
  start,
  terrain.nations,
  terrain.additionalNations,
  0,
  new PseudoRandom(simpleHash(seed)),
);
const game = createGame(
  [],
  nations,
  terrain.gameMap,
  terrain.miniGameMap,
  new EngineConfig(config, false),
  terrain.teamGameSpawnAreas,
);
game.setGoldenLands(
  goldenLandsFor(terrain.gameMap, {
    mapType: config.gameMap,
    mapSize: config.gameMapSize,
    scenario: true,
    seed: simpleHash(seed),
  }),
);
const runner = new GameRunner(
  game,
  new Executor(game, seed, undefined),
  () => {},
);
runner.init();
// Scenario humans end placement after a few ticks. Do the same with all cities
// represented by stock Nation AI, keeping the 400 tribes and resource rules.
for (let i = 0; i < 8; i++) game.executeNextTick();
game.endSpawnPhase();
const snapshots: any[] = [];
const capture = (tick: number) => ({
  tick,
  players: game
    .players()
    .map((p) => ({
      id: p.id(),
      name: p.name(),
      flag: p.info().nationFlag,
      type: p.type(),
      alive: p.isAlive(),
      spawned: p.hasSpawned(),
      land: p.numTilesOwned(),
      troops: Math.round(p.troops()),
      gold: Number(p.gold()),
      spawn: p.hasSpawned()
        ? [game.x(p.spawnTile()!), game.y(p.spawnTile()!)]
        : null,
    })),
});
snapshots.push(capture(0));
const before = performance.now();
for (let i = 1; i <= ticks; i++) {
  game.executeNextTick();
  if (i % 600 === 0 || i === ticks) snapshots.push(capture(i));
}
const result = {
  seed,
  difficulty,
  ticks,
  seconds: (ticks * game.config().msPerTick()) / 1000,
  wallSeconds: (performance.now() - before) / 1000,
  capitalNames: Object.fromEntries(capitals),
  landTiles: manifest.map.num_land_tiles,
  config,
  method:
    "AI-only, 33 independent nation cities, 400 tribes; scenario golden lands; end placement after 8 ticks; stock AI spawn jitter +/-25 tiles; capital results are not human win rates",
  snapshots,
};
fs.writeFileSync(out, JSON.stringify(result));
console.log(
  JSON.stringify({
    seed,
    difficulty,
    wallSeconds: result.wallSeconds,
    capitals: snapshots[snapshots.length - 1].players
      .filter((p: any) => capitals.get(p.flag) === p.name)
      .map((p: any) => ({ name: p.name, alive: p.alive, land: p.land })),
  }),
);
