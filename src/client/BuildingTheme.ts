import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
import { assetUrl } from "@openfront/shared/AssetUrls";

const buildings = [
  "house",
  "port",
  "market",
  "fortress",
  "tower",
  "trebuchet",
] as const;

function buildingTheme(map?: GameMapType): "korea" | "japan" | "china" {
  if (map === GameMapType.Sengoku) return "japan";
  if (map === GameMapType.WarringStates) return "china";
  return "korea";
}

/** Resolve per game, so switching maps never leaks a previous game's theme. */
export function buildingAtlasUrl(map?: GameMapType): string {
  return assetUrl(
    `atlases/${buildingTheme(map)}-buildings.png`,
  );
}

/** Preserve non-building icons and resolve through the hashed asset manifest. */
export function themedBuildingIcon(icon: string, map?: GameMapType): string {
  const theme = buildingTheme(map);
  if (theme === "korea") return icon;
  for (const name of buildings) {
    if (icon === assetUrl(`images/korea/${name}.png`)) {
      return assetUrl(`images/${theme}/${name}.png`);
    }
  }
  return icon;
}

/** High-contrast action glyphs; world structures keep their colored atlas. */
export function buildingButtonIcon(icon: string): string {
  for (const name of buildings) {
    if (
      ["korea", "japan", "china"].some(
        (theme) => icon === assetUrl(`images/${theme}/${name}.png`),
      )
    ) {
      return assetUrl(`images/buildings-ui/${name}.svg`);
    }
  }
  return icon;
}
