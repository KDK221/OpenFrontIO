// Saves the Steam perks (chosen pattern, banner, title and achievement
// progress) in this browser. Stage 1 keeps everything local; multiplayer will
// move progress to the player's account so others can trust it.

import { ClientEnv } from "../ClientEnv";
import {
  activeTitle,
  flagDataUrl,
  parseState,
  recordGameEnd,
  steamPattern,
  type AchievementId,
  type GameEndSummary,
  type SteamPerksState,
} from "./SteamPerks";
import type { PlayerCosmetics } from "@openfront/shared/WireSchemas";

const STORAGE_KEY = "steamPerks.v1";
export const STEAM_PERKS_CHANGED = "steam-perks-changed";

export function loadPerks(): SteamPerksState {
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseState(null);
  }
}

export function savePerks(state: SteamPerksState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the choice lasts for this page only.
  }
  window.dispatchEvent(new CustomEvent(STEAM_PERKS_CHANGED));
}

export function updatePerks(
  change: (s: SteamPerksState) => SteamPerksState,
): SteamPerksState {
  const next = change(loadPerks());
  savePerks(next);
  return next;
}

/**
 * The local player's own cosmetics with the Steam perks applied over them.
 * A no-op outside the Steam edition.
 */
export function applySteamCosmetics(base: PlayerCosmetics): PlayerCosmetics {
  if (!ClientEnv.isSteamEdition()) return base;
  const s = loadPerks();
  const out: PlayerCosmetics = { ...base };
  if (s.pattern !== null) out.pattern = steamPattern(s.pattern, s.patternColors);
  if (s.flag !== null) out.flag = flagDataUrl(s.flag);
  return out;
}

/** The earned title shown in the name-tag slot, or null. */
export function steamTitleId(): AchievementId | null {
  if (!ClientEnv.isSteamEdition()) return null;
  return activeTitle(loadPerks());
}

/** Records a finished game; returns the achievements it just unlocked. */
export function recordSteamGameEnd(end: GameEndSummary): AchievementId[] {
  if (!ClientEnv.isSteamEdition()) return [];
  const before = loadPerks();
  const { progress, unlocked } = recordGameEnd(before.progress, end);
  savePerks({ ...before, progress });
  return unlocked;
}
