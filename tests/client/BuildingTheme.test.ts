import { describe, expect, it, vi } from "vitest";
vi.mock("@openfront/shared/AssetUrls", () => ({ assetUrl: (path: string) => `/${path}` }));
import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
import { buildingAtlasUrl, themedBuildingIcon, buildingButtonIcon } from "../../src/client/BuildingTheme";

describe("scenario building themes", () => {
  it("uses the boat icon in Korea and preserves other scenario warships", () => {
    const icon = "/images/BattleshipIconWhite.svg";
    expect(themedBuildingIcon(icon, GameMapType.Samguk)).toBe("/images/BoatIconWhite.svg");
    expect(themedBuildingIcon(icon, GameMapType.Sengoku)).toBe(icon);
    expect(themedBuildingIcon(icon, GameMapType.WarringStates)).toBe(icon);
  });
  it("selects Chinese buildings for Three Kingdoms without leaking across maps", () => {
    expect(buildingAtlasUrl(GameMapType.WarringStates)).toBe("/atlases/china-buildings.png");
    expect(buildingAtlasUrl(GameMapType.Samguk)).toBe("/atlases/korea-buildings.png");
    expect(buildingAtlasUrl(GameMapType.Sengoku)).toBe("/atlases/japan-buildings.png");
  });
  it.each(["house", "port", "market", "fortress", "tower", "trebuchet"])("uses the Chinese %s picture while retaining the white action icon", (name) => {
    const icon = themedBuildingIcon(`/images/korea/${name}.png`, GameMapType.WarringStates);
    expect(icon).toBe(`/images/china/${name}.png`);
    expect(buildingButtonIcon(icon)).toBe(`/images/buildings-ui/${name}.svg`);
  });
});
