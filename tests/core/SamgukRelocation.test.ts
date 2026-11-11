import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { maps } from "@openfront/engine-api/game/Maps.gen";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { mapLoader } from "../client/replay/util/ArchiveGame";

const manifest = JSON.parse(
  readFileSync("resources/maps/samguk/manifest.json", "utf8"),
);
const info = JSON.parse(
  readFileSync("map-generator/assets/maps/samguk/info.json", "utf8"),
);
const tribes = [
  { name: "Sabeol", coordinates: [669, 1470] },
  { name: "Ara", coordinates: [713, 1701] },
];

describe("Samguk northward city relocation", () => {
  test("keeps 33 cities and all eight capitals while reserving the former sites for tribes", () => {
    expect(manifest.nations).toEqual(info.nations);
    expect(manifest.nations).toHaveLength(33);
    expect(
      manifest.nations.some((n: { name: string }) =>
        ["Sabeol", "Ara"].includes(n.name),
      ),
    ).toBe(false);
    const capitals = Object.fromEntries(
      [
        ...new Set<string>(
          manifest.nations.map((n: { flag: string }) => n.flag),
        ),
      ].map((flag) => [
        flag,
        manifest.nations.find((n: { flag: string }) => n.flag === flag).name,
      ]),
    );
    expect(capitals).toEqual({
      Goguryeo: "Pyongyang",
      Baekje: "Hanseong",
      Silla: "Geumseong",
      Gaya: "Geumgwan",
      Tamna: "Tamna",
      Wa: "Tsukushi",
      NorthernWei: "NorthernWeiFrontier",
      Balhae: "BalhaeFrontier",
    });
    expect(info.custom_tribes).toEqual(tribes);
    expect(manifest.custom_tribes).toEqual(tribes);
    expect(
      maps.find((m) => m.type === GameMapType.Samguk)?.customTribes,
    ).toEqual(tribes);
  });

  test("new city spawn jitter stays on passable land at every map resolution", () => {
    for (const [file, width, scale] of [
      ["map.bin", 1088, 1],
      ["map4x.bin", 544, 2],
      ["map16x.bin", 272, 4],
    ] as const) {
      const bytes = readFileSync(`resources/maps/samguk/${file}`);
      for (const city of manifest.nations.filter((n: { name: string }) =>
        n.name.endsWith("Outpost"),
      )) {
        for (let dy = -25; dy <= 25; dy++)
          for (let dx = -25; dx <= 25; dx++) {
            const tile =
              bytes[
                Math.floor((city.coordinates[1] + dy) / scale) * width +
                  Math.floor((city.coordinates[0] + dx) / scale)
              ];
            expect(tile & 128).toBe(128);
            expect(tile & 31).not.toBe(31);
          }
      }
    }
  });

  for (const size of [GameMapSize.Normal, GameMapSize.Compact]) {
    for (const difficulty of [Difficulty.Medium, Difficulty.Hard]) {
      test(`spawns both original sites as ordinary bots and both northern cities as nations (${size}, ${difficulty})`, async () => {
        const runner = await createGameRunner(
          {
            gameID: "balance01",
            lobbyCreatedAt: 0,
            players: [],
            config: {
              gameMap: GameMapType.Samguk,
              gameMapSize: size,
              gameMode: GameMode.FFA,
              gameType: GameType.Singleplayer,
              difficulty,
              nations: "default",
              bots: 400,
              donateGold: false,
              donateTroops: false,
              infiniteGold: false,
              infiniteTroops: false,
              instantBuild: false,
              randomSpawn: false,
            },
          },
          undefined,
          await loadMapFiles(mapLoader, GameMapType.Samguk, size),
          () => {},
        );
        for (let i = 0; i < 8; i++) runner.game.executeNextTick();
        const game = runner.game,
          scale = size === GameMapSize.Compact ? 2 : 1;
        for (const tribe of tribes) {
          const matches = game.players().filter((p) => p.name() === tribe.name);
          expect(matches).toHaveLength(1);
          const p = matches[0];
          expect(p.type()).toBe(PlayerType.Bot);
          expect(p.hasSpawned()).toBe(true);
          expect(p.spawnTile()).toBe(
            game.ref(
              Math.floor(tribe.coordinates[0] / scale),
              Math.floor(tribe.coordinates[1] / scale),
            ),
          );
        }
        for (const name of ["NorthernWeiOutpost", "BalhaeOutpost"]) {
          const p = game.players().find((p) => p.name() === name)!;
          expect(p).toBeDefined();
          expect(p.type()).toBe(PlayerType.Nation);
          expect(p.hasSpawned()).toBe(true);
          expect(game.y(p.spawnTile()!)).toBeLessThan(800 / scale);
        }
        expect(
          game.players().filter((p) => p.type() === PlayerType.Bot),
        ).toHaveLength(400);
      }, 30000);
    }
  }
});
