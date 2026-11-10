import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { mapLoader } from "../client/replay/util/ArchiveGame";

const source = JSON.parse(
  readFileSync("resources/maps/samguk/manifest.json", "utf8"),
);
describe("Northern factions on the actual Samguk map", () => {
  for (const faction of ["NorthernWei", "Balhae", "Gaya"]) {
    for (const size of [GameMapSize.Normal, GameMapSize.Compact]) {
      test(`${faction} starts at its marked city (${size})`, async () => {
        const errors: string[] = [];
        const runner = await createGameRunner(
          {
            gameID: "NORTH001",
            lobbyCreatedAt: 0,
            players: [
              { clientID: "client001", username: "Tester", clanTag: null },
            ],
            config: {
              gameMap: GameMapType.Samguk,
              gameMapSize: size,
              gameMode: GameMode.FFA,
              gameType: GameType.Singleplayer,
              difficulty: Difficulty.Easy,
              nations: "default",
              bots: 0,
              donateGold: false,
              donateTroops: false,
              infiniteGold: false,
              infiniteTroops: false,
              instantBuild: false,
              randomSpawn: false,
              scenarioFaction: faction,
            },
          },
          "client001",
          await loadMapFiles(mapLoader, GameMapType.Samguk, size),
          (update) => {
            if ("errMsg" in update) errors.push(update.errMsg);
          },
        );
        for (let t = 0; t < 9; t++) {
          runner.addTurn({ turnNumber: t, intents: [] });
          expect(runner.executeNextTick()).toBe(true);
        }
        const game = runner.game;
        const player = game.playerByClientID("client001")!;
        const city = source.nations.find(
          (n: { flag: string }) => n.flag === faction,
        );
        const scale = size === GameMapSize.Compact ? 2 : 1;
        expect(errors).toEqual([]);
        expect(player.hasSpawned()).toBe(true);
        expect(player.spawnTile()).toBe(
          game.ref(
            Math.floor(city.coordinates[0] / scale),
            Math.floor(city.coordinates[1] / scale),
          ),
        );
        expect(player.info().nationFlag).toBe(faction);
        expect(game.inSpawnPhase()).toBe(false);
      });
    }
  }
});
