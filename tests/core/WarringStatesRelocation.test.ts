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
  readFileSync("resources/maps/warringstates/manifest.json", "utf8"),
);
const info = JSON.parse(
  readFileSync("map-generator/assets/maps/warringstates/info.json", "utf8"),
);
const tribes = [
  { name: "Chenliu", coordinates: [1665, 1180] },
  { name: "Runan", coordinates: [1653, 1260] },
  { name: "Pingyuan", coordinates: [1670, 1049] },
  { name: "Hongnong", coordinates: [1490, 1218] },
  { name: "Jiangling", coordinates: [1588, 1398] },
  { name: "Lujiang", coordinates: [1740, 1328] },
];

describe("WarringStates western city redistribution", () => {
  test("keeps 41 cities and all 21 capitals while reserving the former sites for tribes", () => {
    expect(manifest.nations).toEqual(info.nations);
    expect(manifest.nations).toHaveLength(41);
    expect(
      manifest.nations.some((n: { name: string }) =>
        [
          "Chenliu",
          "Runan",
          "Pingyuan",
          "Hongnong",
          "Jiangling",
          "Lujiang",
        ].includes(n.name),
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
      LiuBei: "Xinye",
      CaoCao: "Xuchang",
      SunQuan: "Jianye",
      YuanShao: "Ye",
      YuanShu: "Shouchun",
      DongZhuo: "Luoyang",
      LuBu: "Puyang",
      LiuBiao: "Xiangyang",
      LiuZhang: "Chengdu",
      ZhangLu: "Hanzhong",
      MaTeng: "Wuwei",
      HanSui: "Jincheng",
      GongsunZan: "Beiping",
      GongsunDu: "Xiangping",
      TaoQian: "Xiapi",
      KongRong: "Beihai",
      ZhangXiu: "Wan",
      ZhangYang: "Henei",
      ZhangJiao: "Julu",
      WangLang: "Kuaiji",
      ShiXie: "Guangxin",
    });
    for (const capital of [
      { flag: "LiuBei", name: "Xinye", coordinates: [1585, 1306] },
      { flag: "CaoCao", name: "Xuchang", coordinates: [1634, 1218] },
      { flag: "SunQuan", name: "Jianye", coordinates: [1820, 1295] },
      { flag: "YuanShao", name: "Ye", coordinates: [1608, 1092] },
      { flag: "YuanShu", name: "Shouchun", coordinates: [1736, 1255] },
      { flag: "DongZhuo", name: "Luoyang", coordinates: [1554, 1197] },
      { flag: "LuBu", name: "Puyang", coordinates: [1665, 1127] },
      { flag: "LiuBiao", name: "Xiangyang", coordinates: [1573, 1340] },
      { flag: "LiuZhang", name: "Chengdu", coordinates: [1267, 1437] },
      { flag: "ZhangLu", name: "Hanzhong", coordinates: [1365, 1309] },
      { flag: "MaTeng", name: "Wuwei", coordinates: [1175, 1060] },
      { flag: "HanSui", name: "Jincheng", coordinates: [1235, 1164] },
      { flag: "GongsunZan", name: "Beiping", coordinates: [1684, 900] },
      { flag: "GongsunDu", name: "Xiangping", coordinates: [1845, 796] },
      { flag: "TaoQian", name: "Xiapi", coordinates: [1785, 1195] },
      { flag: "KongRong", name: "Beihai", coordinates: [1790, 1048] },
      { flag: "ZhangXiu", name: "Wan", coordinates: [1573, 1274] },
      { flag: "ZhangYang", name: "Henei", coordinates: [1550, 1157] },
      { flag: "ZhangJiao", name: "Julu", coordinates: [1635, 1030] },
      { flag: "WangLang", name: "Kuaiji", coordinates: [1913, 1333] },
      { flag: "ShiXie", name: "Guangxin", coordinates: [1555, 1745] },
    ]) {
      expect(
        manifest.nations.find((n: { flag: string }) => n.flag === capital.flag),
      ).toEqual(capital);
    }
    expect(info.custom_tribes).toEqual(tribes);
    expect(manifest.custom_tribes).toEqual(tribes);
    expect(
      maps.find((m) => m.type === GameMapType.WarringStates)?.customTribes,
    ).toEqual(tribes);
  });

  test("new city spawn jitter stays on passable land at every map resolution", () => {
    for (const [file, width, scale] of [
      ["map.bin", 2248, 1],
      ["map4x.bin", 1124, 2],
      ["map16x.bin", 562, 4],
    ] as const) {
      const bytes = readFileSync(`resources/maps/warringstates/${file}`);
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
      test(`spawns all six original sites as ordinary bots and all six western cities as nations (${size}, ${difficulty})`, async () => {
        const runner = await createGameRunner(
          {
            gameID: "balance01",
            lobbyCreatedAt: 0,
            players: [],
            config: {
              gameMap: GameMapType.WarringStates,
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
          await loadMapFiles(mapLoader, GameMapType.WarringStates, size),
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
        for (const name of [
          "ChinaNorthwestWestOutpost",
          "ChinaNorthwestNorthOutpost",
          "ChinaNorthwestSouthOutpost",
          "ChinaSouthwestNorthOutpost",
          "ChinaSouthwestWestOutpost",
          "ChinaSouthwestSouthOutpost",
        ]) {
          const p = game.players().find((p) => p.name() === name)!;
          expect(p).toBeDefined();
          expect(p.type()).toBe(PlayerType.Nation);
          expect(p.hasSpawned()).toBe(true);
          const expected = manifest.nations.find(
            (n: { name: string }) => n.name === name,
          ).coordinates;
          expect(
            Math.abs(game.x(p.spawnTile()!) - Math.floor(expected[0] / scale)),
          ).toBeLessThanOrEqual(25);
          expect(
            Math.abs(game.y(p.spawnTile()!) - Math.floor(expected[1] / scale)),
          ).toBeLessThanOrEqual(25);
        }
        expect(
          game.players().filter((p) => p.type() === PlayerType.Bot),
        ).toHaveLength(400);
      }, 30000);
    }
  }
});
