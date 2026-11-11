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
  readFileSync("resources/maps/sengoku/manifest.json", "utf8"),
);
const info = JSON.parse(
  readFileSync("map-generator/assets/maps/sengoku/info.json", "utf8"),
);
const tribes = [{ name: "Gifu", coordinates: [1280, 1249] }];

describe("Sengoku northward city relocation", () => {
  test("keeps 46 cities and all 39 capitals while reserving the former sites for tribes", () => {
    expect(manifest.nations).toEqual(info.nations);
    expect(manifest.nations).toHaveLength(46);
    expect(
      manifest.nations.some((n: { name: string }) => ["Gifu"].includes(n.name)),
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
      Oda: "Kiyosu",
      Matsudaira: "Okazaki",
      Imagawa: "Sunpu",
      Takeda: "Kofu",
      Hojo: "Odawara",
      Uesugi: "Kasugayama",
      Satake: "Mito",
      Utsunomiya: "Utsunomiya",
      Satomi: "Tateyama",
      Ashina: "Aizu",
      Date: "Yonezawa",
      Mogami: "Yamagata",
      Nanbu: "Sannohe",
      Ando: "Akita",
      Tsugaru: "Hirosaki",
      Kakizaki: "Matsumae",
      Ikko: "Kanazawa",
      Hatakeyama: "Nanao",
      Asakura: "Ichijodani",
      Azai: "Odani",
      Rokkaku: "Kannonji",
      Ashikaga: "Kyoto",
      Matsunaga: "Shigisan",
      Miyoshi: "Sakai",
      Hatano: "Yakami",
      Bessho: "Miki",
      Ukita: "Okayama",
      Amago: "Gassantoda",
      Mori: "Koriyama",
      Ouchi: "Yamaguchi",
      Sogo: "Takamatsu",
      Kono: "Yuzuki",
      Chosokabe: "Oko",
      Otomo: "Funai",
      Ryuzoji: "Saga",
      Akizuki: "Akizuki",
      Sagara: "Kumamoto",
      Ito: "Miyazaki",
      Shimazu: "Kagoshima",
    });
    expect(info.custom_tribes).toEqual(tribes);
    expect(manifest.custom_tribes).toEqual(tribes);
    expect(
      maps.find((m) => m.type === GameMapType.Sengoku)?.customTribes,
    ).toEqual(tribes);
  });

  test("new city spawn jitter stays on passable land at every map resolution", () => {
    for (const [file, width, scale] of [
      ["map.bin", 2500, 1],
      ["map4x.bin", 1250, 2],
      ["map16x.bin", 625, 4],
    ] as const) {
      const bytes = readFileSync(`resources/maps/sengoku/${file}`);
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
      test(`spawns the original site as ordinary bots and the northern city as nations (${size}, ${difficulty})`, async () => {
        const runner = await createGameRunner(
          {
            gameID: "balance01",
            lobbyCreatedAt: 0,
            players: [],
            config: {
              gameMap: GameMapType.Sengoku,
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
          await loadMapFiles(mapLoader, GameMapType.Sengoku, size),
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
        for (const name of ["EzoEastOutpost"]) {
          const p = game.players().find((p) => p.name() === name)!;
          expect(p).toBeDefined();
          expect(p.type()).toBe(PlayerType.Nation);
          expect(p.hasSpawned()).toBe(true);
          expect(game.y(p.spawnTile()!)).toBeLessThan(500 / scale);
        }
        expect(
          game.players().filter((p) => p.type() === PlayerType.Bot),
        ).toHaveLength(400);
      }, 30000);
    }
  }
});
