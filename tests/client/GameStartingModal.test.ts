import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { START_TIPS, pickStartTip } from "../../src/client/GameStartingModal";

const en = JSON.parse(
  readFileSync(path.join(__dirname, "../../resources/lang/en.json"), "utf8"),
);

describe("game starting tips", () => {
  it("has English text for every tip", () => {
    for (const tip of START_TIPS) {
      expect(en.game_starting_modal[`tip_${tip}`], tip).toBeTruthy();
    }
    expect(en.game_starting_modal.tip_label).toBeTruthy();
  });

  it("picks every tip across the random range and never runs off the end", () => {
    const seen = new Set<string>();
    for (let i = 0; i < START_TIPS.length; i++) {
      seen.add(pickStartTip(() => i / START_TIPS.length));
    }
    expect(seen.size).toBe(START_TIPS.length);
    expect(START_TIPS).toContain(pickStartTip(() => 0.999999999));
  });
});
