import { afterEach, describe, expect, test, vi } from "vitest";

// ServerEnv reads GAME_ENV once at module load, so each case loads a fresh
// copy under its own environment.
async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const { ServerEnv } = await import("../../src/server/ServerEnv");
  const { verifyClientToken } = await import("../../src/server/jwt");
  return { ServerEnv, verifyClientToken };
}

const PERSISTENT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("self-hosted server", () => {
  test("prod with SELF_HOSTED=1 has no API and admits guests by persistent ID", async () => {
    const { ServerEnv, verifyClientToken } = await load({
      GAME_ENV: "prod",
      SELF_HOSTED: "1",
      DOMAIN: "1-2-3-4.sslip.io",
      TURNSTILE_SITE_KEY: "",
    });
    expect(ServerEnv.selfHosted()).toBe(true);
    expect(ServerEnv.hasApi()).toBe(false);
    // Cloudflare's public always-pass test key, never a real one.
    expect(ServerEnv.turnstileSiteKey()).toBe("1x00000000000000000000AA");
    expect(await verifyClientToken(PERSISTENT_ID)).toEqual({
      type: "success",
      persistentId: PERSISTENT_ID,
      claims: null,
    });
  });

  test("plain prod still needs the API and refuses bare persistent IDs", async () => {
    const { ServerEnv, verifyClientToken } = await load({
      GAME_ENV: "prod",
      SELF_HOSTED: "",
      DOMAIN: "openfront.io",
      TURNSTILE_SITE_KEY: "",
    });
    expect(ServerEnv.selfHosted()).toBe(false);
    expect(ServerEnv.hasApi()).toBe(true);
    expect(() => ServerEnv.turnstileSiteKey()).toThrow(
      "TURNSTILE_SITE_KEY not set",
    );
    expect(await verifyClientToken(PERSISTENT_ID)).toEqual({
      type: "error",
      message: "persistent ID not allowed in production",
    });
  });

  test("dev has no API either", async () => {
    const { ServerEnv } = await load({ GAME_ENV: "dev", SELF_HOSTED: "" });
    expect(ServerEnv.hasApi()).toBe(false);
    expect(ServerEnv.selfHosted()).toBe(false);
  });
});
