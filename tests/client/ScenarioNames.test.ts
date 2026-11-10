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
  [ko, "하내", "하비", "관씨군"],
  [en, "Henei", "Xiapi", "Guan Army"],
  [ja, "河内", "下邳", "関軍"],
  [cn, "河内", "下邳", "关军"],
  [tw, "河內", "下邳", "關軍"],
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
  ).toBe("손씨 의용군");
  state.lang = ja;
  expect(
    scenarioDisplayName(
      "Sun Volunteers",
      PlayerType.Bot,
      GameMapType.WarringStates,
    ),
  ).toBe("孫義勇軍");
});
