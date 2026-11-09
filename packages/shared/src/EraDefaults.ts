import { UnitType } from "@openfront/engine-api/game/GameTypes";

/**
 * Units that don't fit the historical-era setting (Three Kingdoms, Sengoku,
 * Warring States). They are disabled by default in every lobby type.
 * Hosts can still re-enable them in private lobbies / singleplayer.
 *
 * MissileSilo (Siege Camp) and AtomBomb (Fire Attack) are re-themed rather
 * than removed, so they are enabled. HydrogenBomb is reserved for the
 * Flood Attack and MIRV/SAM stay off.
 */
export const ERA_DISABLED_UNITS: readonly UnitType[] = [
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.SAMLauncher,
];
