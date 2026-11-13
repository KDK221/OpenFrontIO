import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
import { PLACE_TRIBE_SUFFIXES } from "@openfront/engine-lib/execution/utils/PlaceTribeNames";
import { placeName } from "./PlaceNames";
import { scenarioNameGroups } from "./ScenarioNameGroups";
import { translateText } from "./Utils";
export function scenarioDisplayName(
  name: string,
  type: PlayerType,
  map: GameMapType,
): string {
  if (type === PlayerType.Human) return name;
  // Positioned former cities remain ordinary tribes, with their city names.
  if (
    type === PlayerType.Nation ||
    (type === PlayerType.Bot &&
      ((map === GameMapType.Samguk && (name === "Sabeol" || name === "Ara")) ||
        (map === GameMapType.Sengoku && name === "Gifu") ||
        (map === GameMapType.WarringStates &&
          [
            "Jiangxia",
            "Nanpi",
            "Jinyang",
            "Shangyong",
            "Chenliu",
            "Runan",
            "Pingyuan",
            "Hongnong",
            "Jiangling",
            "Lujiang",
          ].includes(name))))
  ) {
    const key = `capital.${name}`;
    const localized = translateText(key);
    return localized === key ? name : localized;
  }
  const group =
    map === GameMapType.WarringStates
      ? "three_kingdoms"
      : map === GameMapType.Samguk
        ? "samguk"
        : map === GameMapType.Sengoku
          ? "sengoku"
          : null;
  if (!group) return realMapName(name, type);
  const { prefixes, suffixes } = scenarioNameGroups[group];
  const namespace =
    group === "three_kingdoms" ? "scenario_names" : `scenario_names.${group}`;
  const split = name.lastIndexOf(" ");
  const prefix = name.slice(0, split),
    suffix = name.slice(split + 1);
  if (!prefixes.includes(prefix) || !suffixes.includes(suffix)) return name;
  const prefixKey = `${namespace}.prefix.${prefix}`;
  const localized = translateText(prefixKey);
  const key = `${namespace}.suffix.${suffix}`;
  const result = translateText(key, {
    name: localized === prefixKey ? prefix : localized,
  });
  return result === key ? name : result;
}

const PLACE_SUFFIXES: ReadonlySet<string> = new Set(PLACE_TRIBE_SUFFIXES);

// The real-world maps: AI nations carry real place names, and tribes are
// "<nearest place> <suffix>" (engine PlaceTribeNames), both shown in the
// player's language when there is a translation.
function realMapName(name: string, type: PlayerType): string {
  if (type === PlayerType.Nation) return placeName(name);
  if (type !== PlayerType.Bot) return name;
  const split = name.lastIndexOf(" ");
  if (split <= 0) return name;
  const suffix = name.slice(split + 1);
  if (!PLACE_SUFFIXES.has(suffix)) return name;
  const key = `place_tribe.${suffix}`;
  const result = translateText(key, { name: placeName(name.slice(0, split)) });
  return result === key ? name : result;
}
