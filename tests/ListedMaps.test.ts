import {
  DEFAULT_MAP,
  GameMapType,
  listedMaps,
  maps,
  SCENARIO_MAPS,
} from "@openfront/engine-api/game/GameTypes";
import { describe, expect, test } from "vitest";

describe("listedMaps", () => {
  test("leaves out the hidden tutorial map", () => {
    expect(maps.find((m) => m.type === GameMapType.Tutorial)?.hidden).toBe(
      true,
    );
    expect(listedMaps.some((m) => m.type === GameMapType.Tutorial)).toBe(false);
  });

  test("lists exactly the scenario maps", () => {
    expect(listedMaps.map((m) => m.type).sort()).toEqual(
      [...SCENARIO_MAPS].sort(),
    );
    expect(listedMaps.some((m) => m.type === GameMapType.World)).toBe(false);
  });

  test("every scenario map exists and the default map is one of them", () => {
    for (const type of SCENARIO_MAPS) {
      expect(maps.some((m) => m.type === type)).toBe(true);
    }
    expect(SCENARIO_MAPS).toContain(DEFAULT_MAP);
  });
});
