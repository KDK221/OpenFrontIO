import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApiBase } from "../../src/client/ApiBase";
import { ClientEnv } from "../../src/client/ClientEnv";
import {
  backendUnreachableConfirmed,
  ensureServerList,
  resetServerList,
  startServerListPolling,
} from "../../src/client/ServerList";

// Self-hosted: this fork has no OpenFront account/cluster API, only its own
// game server. Multiplayer must not wait on, poll, or be gated by that API.
describe("self-hosted page", () => {
  const fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));

  beforeEach(() => {
    window.BOOTSTRAP_CONFIG = {
      gitCommit: "abc",
      gameEnv: "dev",
      turnstileSiteKey: "k",
      jwtAudience: "localhost",
      cluster: { a: { host: "localhost", numWorkers: 2 } },
      instanceLetter: "a",
      instanceId: "DEV_ID",
      selfHosted: true,
    } as typeof window.BOOTSTRAP_CONFIG;
    ClientEnv.reset();
    resetServerList();
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockClear();
  });

  afterEach(() => {
    resetServerList();
    vi.unstubAllGlobals();
    window.BOOTSTRAP_CONFIG = undefined;
  });

  it("is read from the page", () => {
    expect(ClientEnv.selfHosted()).toBe(true);
    window.BOOTSTRAP_CONFIG = { ...window.BOOTSTRAP_CONFIG!, selfHosted: undefined };
    expect(ClientEnv.selfHosted()).toBe(false);
  });

  it("answers from the page without asking a list API", async () => {
    expect(await ensureServerList()).toBe("fallback");
    startServerListPolling();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never reports a backend outage that would dim multiplayer", () => {
    expect(backendUnreachableConfirmed()).toBe(false);
  });

  it("points account calls at a dead origin, not localhost:8787", () => {
    localStorage.removeItem("apiHost");
    expect(getApiBase()).toBe("https://api.invalid");
  });
});
