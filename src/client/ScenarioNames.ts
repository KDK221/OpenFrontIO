import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameMapType } from "@openfront/engine-api/game/Maps.gen";
import { translateText } from "./Utils";
const prefixes = new Set([
  "Xiahou",
  "Guan",
  "Zhang",
  "Zhao",
  "Huang",
  "Zhou",
  "Lu",
  "Xu",
  "Yu",
  "Taishi",
  "Gan",
  "Wei",
  "Cheng",
  "Han",
  "Jiang",
  "Ding",
  "Yan",
  "Wen",
  "Cao",
  "Sun",
]);
const suffixes = new Set([
  "Clan",
  "Army",
  "Garrison",
  "Commandery",
  "Volunteers",
  "Retainers",
]);
export function scenarioDisplayName(
  name: string,
  type: PlayerType,
  map: GameMapType,
): string {
  if (type === PlayerType.Human) return name;
  if (type === PlayerType.Nation) {
    const key = `capital.${name}`;
    const localized = translateText(key);
    return localized === key ? name : localized;
  }
  if (map !== GameMapType.WarringStates) return name;
  const split = name.lastIndexOf(" ");
  const prefix = name.slice(0, split),
    suffix = name.slice(split + 1);
  if (!prefixes.has(prefix) || !suffixes.has(suffix)) return name;
  const prefixKey = `scenario_names.prefix.${prefix}`;
  const localized = translateText(prefixKey);
  const key = `scenario_names.suffix.${suffix}`;
  const result = translateText(key, {
    name: localized === prefixKey ? prefix : localized,
  });
  return result === key ? name : result;
}
