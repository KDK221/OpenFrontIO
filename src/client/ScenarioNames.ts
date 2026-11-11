import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
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
      map === GameMapType.Samguk &&
      (name === "Sabeol" || name === "Ara"))
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
  if (!group) return name;
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
