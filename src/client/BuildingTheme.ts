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

/** Resolve per game, so switching maps never leaks a previous game's theme. */
export function buildingAtlasUrl(map?: GameMapType): string {
  return assetUrl(
    `atlases/${map === GameMapType.Sengoku ? "japan" : "korea"}-buildings.png`,
  );
}

/** Preserve non-building icons and resolve through the hashed asset manifest. */
export function themedBuildingIcon(icon: string, map?: GameMapType): string {
  if (map !== GameMapType.Sengoku) return icon;
  for (const name of buildings) {
    if (icon === assetUrl(`images/korea/${name}.png`)) {
      return assetUrl(`images/japan/${name}.png`);
    }
  }
  return icon;
}
