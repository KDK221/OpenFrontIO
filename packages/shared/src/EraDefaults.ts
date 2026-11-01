import { UnitType } from "@openfront/engine-api/game/GameTypes";

/**
 * Units that don't fit the historical-era setting (Three Kingdoms, Sengoku,
 * Warring States). They are disabled by default in every lobby type.
 * Hosts can still re-enable them in private lobbies / singleplayer.
 */
export const ERA_DISABLED_UNITS: readonly UnitType[] = [
  UnitType.MissileSilo,
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.SAMLauncher,
];
