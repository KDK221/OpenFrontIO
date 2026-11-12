import {
  ClanTagSchema,
  PlayerSchema,
  PlayerTagSchema,
} from "@openfront/engine-api/Schemas";
import { formatPlayerDisplayName } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it } from "vitest";

// The in-game player record carries a clan tag or a Steam-edition title in
// the same "[tag]" slot; clan tags themselves stay narrow.
describe("PlayerTagSchema", () => {
  it.each(["명장", "천하인", "覇者", "General", "Warlord", "AB12", "OF"])(
    "accepts the tag %s",
    (tag) => {
      expect(PlayerTagSchema.safeParse(tag).success).toBe(true);
    },
  );

  it.each(["a", "", "a b", "Conquerors", "명장!", "[x]"])(
    "rejects the tag %j",
    (tag) => {
      expect(PlayerTagSchema.safeParse(tag).success).toBe(false);
    },
  );

  it("accepts no tag", () => {
    expect(PlayerTagSchema.safeParse(null).success).toBe(true);
  });

  it("leaves clan tags as they were", () => {
    expect(ClanTagSchema.safeParse("명장").success).toBe(false);
    expect(ClanTagSchema.safeParse("General").success).toBe(false);
    expect(ClanTagSchema.safeParse("OF").success).toBe(true);
  });

  it("lets a game's player carry a title", () => {
    const player = {
      clientID: "abcdefgh",
      username: "Player",
      clanTag: "명장",
    };
    expect(PlayerSchema.safeParse(player).success).toBe(true);
    expect(formatPlayerDisplayName("고구려", "명장")).toBe("[명장] 고구려");
  });
});
