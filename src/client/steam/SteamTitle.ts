// The Steam-edition title as it appears in a player's "[tag]" slot.

import { PlayerTagSchema } from "@openfront/engine-api/Schemas";
import { translateText } from "../Utils";
import type { AchievementId } from "./SteamPerks";
import { steamTitleId } from "./SteamPerkStore";

/** The short tag text for a title, in the current language. */
export function titleTagText(id: AchievementId): string {
  return translateText(`steam_perks.title_tag.${id}`);
}

/**
 * The earned title to carry into a game this client starts, or null. A
 * translation that would not fit the tag slot (2-8 letters, no spaces) is
 * dropped rather than breaking the game start.
 */
export function steamTitleTag(): string | null {
  const id = steamTitleId();
  if (id === null) return null;
  const tag = titleTagText(id);
  return PlayerTagSchema.safeParse(tag).success ? tag : null;
}
