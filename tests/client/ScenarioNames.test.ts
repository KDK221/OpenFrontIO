import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
import { expect, it, vi } from "vitest";
import en from "../../resources/lang/en.json";
import ja from "../../resources/lang/ja.json";
import ko from "../../resources/lang/ko.json";
import cn from "../../resources/lang/zh-CN.json";
import tw from "../../resources/lang/zh-TW.json";
import manifest from "../../resources/maps/warringstates/manifest.json";
import { scenarioDisplayName } from "../../src/client/ScenarioNames";
const state = vi.hoisted(() => ({ lang: {} as Record<string, any> }));
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string>) => {
    let value: any = state.lang;
    for (const part of key.split(".")) value = value?.[part];
    return typeof value === "string"
      ? value.replace("{name}", params?.name ?? "")
      : key;
  },
}));
it.each([
  [ko, "하내", "하비", "관우군"],
  [en, "Henei", "Xiapi", "Guan Yu Army"],
  [ja, "河内", "下邳", "関羽軍"],
  [cn, "河内", "下邳", "关羽军"],
  [tw, "河內", "下邳", "關羽軍"],
])("localizes city and generated force names", (lang, henei, xiapi, guan) => {
  state.lang = lang as any;
  expect(
    scenarioDisplayName("Henei", PlayerType.Nation, GameMapType.WarringStates),
  ).toBe(henei);
  expect(
    scenarioDisplayName("Xiapi", PlayerType.Nation, GameMapType.WarringStates),
  ).toBe(xiapi);
  expect(
    scenarioDisplayName("Guan Army", PlayerType.Bot, GameMapType.WarringStates),
  ).toBe(guan);
  expect(
    scenarioDisplayName(
      "Guan Army",
      PlayerType.Human,
      GameMapType.WarringStates,
    ),
  ).toBe("Guan Army");
  expect(
    scenarioDisplayName("Guan Army", PlayerType.Bot, GameMapType.Sengoku),
  ).toBe("Guan Army");
  for (const n of manifest.nations)
    expect((lang as any).capital[n.name]).toBeTruthy();
});
it("falls back for unknown names and resolves language on each call", () => {
  state.lang = ko;
  expect(
    scenarioDisplayName(
      "Unknown City",
      PlayerType.Nation,
      GameMapType.WarringStates,
    ),
  ).toBe("Unknown City");
  expect(
    scenarioDisplayName(
      "Sun Volunteers",
      PlayerType.Bot,
      GameMapType.WarringStates,
    ),
  ).toBe("손권 의용군");
  state.lang = ja;
  expect(
    scenarioDisplayName(
      "Sun Volunteers",
      PlayerType.Bot,
      GameMapType.WarringStates,
    ),
  ).toBe("孫権義勇軍");
});

it("localizes Korean and Japanese regional forces and full-name Chinese commanders", () => {
  state.lang = ko;
  expect(
    scenarioDisplayName(
      "Sun Quan Army",
      PlayerType.Bot,
      GameMapType.WarringStates,
    ),
  ).toBe("손권군");
  expect(
    scenarioDisplayName("Sanada Clan", PlayerType.Bot, GameMapType.Sengoku),
  ).toBe("사나다 가문");
  expect(
    scenarioDisplayName("Buyeo Fortress", PlayerType.Bot, GameMapType.Samguk),
  ).toBe("부여성");
  state.lang = ja;
  expect(
    scenarioDisplayName("Sanada Clan", PlayerType.Bot, GameMapType.Sengoku),
  ).toBe("真田家");
  expect(
    scenarioDisplayName("Pyongyang", PlayerType.Nation, GameMapType.Samguk),
  ).toBe("平壌");
  state.lang = cn;
  expect(
    scenarioDisplayName(
      "Sun Quan Army",
      PlayerType.Bot,
      GameMapType.WarringStates,
    ),
  ).toBe("孙权军");
});

it("localizes the former Samguk cities as tribes and the new northern outposts", () => {
  state.lang = ko;
  expect(
    scenarioDisplayName("Sabeol", PlayerType.Bot, GameMapType.Samguk),
  ).toBe("사벌");
  expect(scenarioDisplayName("Ara", PlayerType.Bot, GameMapType.Samguk)).toBe(
    "아라",
  );
  expect(
    scenarioDisplayName(
      "NorthernWeiOutpost",
      PlayerType.Nation,
      GameMapType.Samguk,
    ),
  ).toBe("북서 변경성");
  expect(
    scenarioDisplayName("BalhaeOutpost", PlayerType.Nation, GameMapType.Samguk),
  ).toBe("북동 변경성");
});
