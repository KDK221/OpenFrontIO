import { UnitType } from "@openfront/engine-api/game/GameTypes";

/**
 * Units that don't fit the historical-era setting (Three Kingdoms, Sengoku,
 * Warring States). They are disabled by default in every lobby type.
 * Hosts can still re-enable them in private lobbies / singleplayer.
 *
 * The former nukes are re-themed instead of removed:
 *   MissileSilo -> Siege Camp, AtomBomb -> Fire Attack,
 *   HydrogenBomb -> Flood Attack, MIRV -> Plague.
 * Only the SAM launcher (no missiles to shoot down) stays off.
 */
export const ERA_DISABLED_UNITS: readonly UnitType[] = [UnitType.SAMLauncher];
