import { beforeEach, describe, expect, it, vi } from "vitest";

const portal = vi.hoisted(() => ({
  singleplayerOnly: false,
  onPortal: true,
  invite: null as string | null,
  instant: false,
  gamesPlayed: 0,
}));

vi.mock("../../src/client/ClientEnv", () => ({
  ClientEnv: { singleplayerOnly: () => portal.singleplayerOnly },
}));

vi.mock("../../src/client/GamePortal", () => ({
  gamePortal: {
    isOnGamePortal: () => portal.onPortal,
    getInviteGameId: async () => portal.invite,
    isInstantMultiplayer: async () => portal.instant,
  },
}));

vi.mock("../../src/client/Utils", () => ({
  getGamesPlayed: () => portal.gamesPlayed,
}));

import { crazyGamesSDK } from "../../src/client/CrazyGamesSDK";
import { shouldStartPortalTutorial } from "../../src/client/PortalTutorial";

describe("shouldStartPortalTutorial", () => {
  beforeEach(() => {
    portal.singleplayerOnly = false;
    portal.onPortal = true;
    portal.invite = null;
    portal.instant = false;
    portal.gamesPlayed = 0;
  });

  it("never auto-starts in an embedded static game, including first-time visitors", async () => {
    portal.singleplayerOnly = true;
    expect(await shouldStartPortalTutorial()).toBe(false);
  });

  it("does not misidentify a static cross-origin iframe as CrazyGames", () => {
    portal.singleplayerOnly = true;
    const probe = vi.spyOn(window, "self", "get").mockImplementation(() => {
      throw new DOMException("Cross origin", "SecurityError");
    });
    try {
      expect(crazyGamesSDK.isOnCrazyGames()).toBe(false);
    } finally {
      probe.mockRestore();
    }
  });

  it("starts for a new player on a portal", async () => {
    expect(await shouldStartPortalTutorial()).toBe(true);
  });

  it("doesn't start on the open web", async () => {
    portal.onPortal = false;
    expect(await shouldStartPortalTutorial()).toBe(false);
  });

  it("doesn't start once a game has been played", async () => {
    portal.gamesPlayed = 1;
    expect(await shouldStartPortalTutorial()).toBe(false);
  });

  it("leaves an invite or instant multiplayer to its lobby", async () => {
    portal.invite = "abcd1234";
    expect(await shouldStartPortalTutorial()).toBe(false);
    portal.invite = null;
    portal.instant = true;
    expect(await shouldStartPortalTutorial()).toBe(false);
  });
});
