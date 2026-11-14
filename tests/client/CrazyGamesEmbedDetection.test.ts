import { describe, expect, it } from "vitest";
import { crossOriginFrameIsCrazyGames } from "../../src/client/CrazyGamesSDK";

describe("crossOriginFrameIsCrazyGames", () => {
  it("trusts the embedding origins when the browser lists them", () => {
    expect(
      crossOriginFrameIsCrazyGames(["https://www.crazygames.com"], ""),
    ).toBe(true);
    expect(crossOriginFrameIsCrazyGames(["https://somusoft.com"], "")).toBe(
      false,
    );
  });

  it("falls back to the referrer", () => {
    expect(
      crossOriginFrameIsCrazyGames(undefined, "https://games.crazygames.com/x"),
    ).toBe(true);
    expect(
      crossOriginFrameIsCrazyGames([], "https://somusoft.com/games/g_1"),
    ).toBe(false);
  });

  it("assumes CrazyGames only when nothing identifies the embedder", () => {
    expect(crossOriginFrameIsCrazyGames(undefined, "")).toBe(true);
  });
});
