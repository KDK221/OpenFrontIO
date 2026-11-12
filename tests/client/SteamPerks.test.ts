import { PatternDataSchema } from "@openfront/shared/CosmeticSchemas";
import { PatternDecoder } from "@openfront/shared/PatternDecoder";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySteamCosmetics,
  loadPerks,
  recordSteamGameEnd,
  savePerks,
  steamTitleId,
} from "../../src/client/steam/SteamPerkStore";
import {
  ACHIEVEMENT_IDS,
  DEFAULT_FLAG,
  EMPTY_PROGRESS,
  EMPTY_STATE,
  PATTERN_IDS,
  activeTitle,
  encodePattern,
  flagDataUrl,
  parseState,
  patternCells,
  recordGameEnd,
  renderFlagSvg,
  singleGlyph,
  steamPattern,
  summarizeStats,
  toBase64url,
  type GameEndSummary,
} from "../../src/client/steam/SteamPerks";

const decode = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const game = (over: Partial<GameEndSummary> = {}): GameEndSummary => ({
  won: false,
  difficulty: "Medium",
  map: "Samguk",
  scenario: true,
  fireAttacks: 0,
  thunderCatapults: 0,
  plagues: 0,
  conquests: 0,
  ...over,
});

describe("territory patterns", () => {
  it("encodes base64url without padding", () => {
    expect(toBase64url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
    expect(toBase64url(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });

  it.each(PATTERN_IDS)("%s is valid pattern data that decodes to its bitmap", (id) => {
    const pattern = steamPattern(id, null);
    expect(PatternDataSchema.safeParse(pattern.patternData).success).toBe(true);
    expect(pattern.name).toMatch(/^[a-z0-9_]+$/);

    const cells = patternCells(id);
    const decoder = new PatternDecoder(pattern, decode);
    expect(decoder.width).toBe(cells[0].length);
    expect(decoder.height).toBe(cells.length);
    for (let y = 0; y < cells.length; y++) {
      for (let x = 0; x < cells[0].length; x++) {
        expect(decoder.isPrimary(x, y)).toBe(cells[y][x]);
      }
    }
    // Both colours actually appear, or it would not read as a pattern.
    const flat = cells.flat();
    expect(flat.includes(true) && flat.includes(false)).toBe(true);
  });

  it("carries chosen colours as the pattern's palette", () => {
    const p = steamPattern("wave", { primary: "#112233", secondary: "#445566" });
    expect(p.colorPalette).toEqual({
      name: "steam_custom",
      primaryColor: "#112233",
      secondaryColor: "#445566",
    });
    expect(steamPattern("wave", null).colorPalette).toBeUndefined();
  });

  it("rejects sizes the decoder cannot express", () => {
    expect(() => encodePattern(1, 4, 0, () => true)).toThrow();
    expect(() => encodePattern(130, 4, 0, () => true)).toThrow();
    expect(() => encodePattern(4, 66, 0, () => true)).toThrow();
  });
});

describe("banner maker", () => {
  it("draws a 3:2 SVG with the chosen glyph", () => {
    const svg = renderFlagSvg(DEFAULT_FLAG);
    expect(svg).toContain('viewBox="0 0 300 200"');
    expect(svg).toContain(">王</text>");
  });

  it("keeps only one character and escapes markup", () => {
    expect(singleGlyph("  龍虎 ")).toBe("龍");
    expect(singleGlyph("")).toBe("");
    const svg = renderFlagSvg({ ...DEFAULT_FLAG, glyph: "<script>" });
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;</text>");
  });

  it("has no text element without a glyph", () => {
    expect(renderFlagSvg({ ...DEFAULT_FLAG, glyph: "" })).not.toContain("<text");
  });

  it("refuses colours that are not hex", () => {
    expect(() =>
      renderFlagSvg({ ...DEFAULT_FLAG, field: "red;stroke:url(x)" }),
    ).toThrow();
  });

  it("is a data URL", () => {
    expect(flagDataUrl(DEFAULT_FLAG)).toMatch(/^data:image\/svg\+xml;/);
  });
});

describe("achievements", () => {
  it("unlocks the first win once", () => {
    const first = recordGameEnd(EMPTY_PROGRESS, game({ won: true }));
    expect(first.unlocked).toEqual(["first_win"]);
    const second = recordGameEnd(first.progress, game({ won: true }));
    expect(second.unlocked).toEqual([]);
  });

  it("counts hard and impossible wins, not losses", () => {
    expect(
      recordGameEnd(EMPTY_PROGRESS, game({ difficulty: "Impossible" })).unlocked,
    ).toEqual([]);
    expect(
      recordGameEnd(
        EMPTY_PROGRESS,
        game({ won: true, difficulty: "Impossible" }),
      ).unlocked.sort(),
    ).toEqual(["first_win", "hard_win", "impossible_win"]);
  });

  it("needs a scenario win on all three maps", () => {
    let p = EMPTY_PROGRESS;
    for (const map of ["Samguk", "Sengoku"]) {
      p = recordGameEnd(p, game({ won: true, map })).progress;
    }
    // A free-mode win does not count toward it.
    p = recordGameEnd(p, game({ won: true, map: "WarringStates", scenario: false }))
      .progress;
    expect(activeTitle({ ...EMPTY_STATE, title: "all_scenarios", progress: p })).toBe(
      null,
    );
    const last = recordGameEnd(p, game({ won: true, map: "WarringStates" }));
    expect(last.unlocked).toEqual(["all_scenarios"]);
  });

  it("adds weapon use across games, won or lost", () => {
    let p = EMPTY_PROGRESS;
    for (let i = 0; i < 2; i++) {
      p = recordGameEnd(p, game({ fireAttacks: 5, plagues: 2 })).progress;
    }
    expect(p.fireAttacks).toBe(10);
    expect(p.plagues).toBe(4);
  });

  it("keeps the best single-game conquest count", () => {
    let r = recordGameEnd(EMPTY_PROGRESS, game({ conquests: 9 }));
    r = recordGameEnd(r.progress, game({ conquests: 4 }));
    expect(r.progress.bestConquests).toBe(9);
    expect(recordGameEnd(r.progress, game({ conquests: 15 })).unlocked).toEqual([
      "conqueror",
    ]);
  });

  it("reads the player's own numbers from end-of-game stats", () => {
    expect(
      summarizeStats({
        bombs: { abomb: [3n, 2n], hbomb: ["1"], mirv: [2] },
        conquests: [4n, "2"],
      }),
    ).toEqual({ fireAttacks: 3, thunderCatapults: 1, plagues: 2, conquests: 6 });
    expect(summarizeStats(undefined)).toEqual({
      fireAttacks: 0,
      thunderCatapults: 0,
      plagues: 0,
      conquests: 0,
    });
  });

  it("only shows a title that has been earned", () => {
    expect(activeTitle({ ...EMPTY_STATE, title: "first_win" })).toBe(null);
    const progress = recordGameEnd(EMPTY_PROGRESS, game({ won: true })).progress;
    expect(activeTitle({ ...EMPTY_STATE, title: "first_win", progress })).toBe(
      "first_win",
    );
  });

  it("has a title for every achievement", () => {
    expect(ACHIEVEMENT_IDS.length).toBe(8);
  });
});

describe("saved state", () => {
  it("falls back to defaults on unreadable data", () => {
    expect(parseState(null)).toEqual(EMPTY_STATE);
    expect(parseState("not json")).toEqual(EMPTY_STATE);
    expect(parseState(JSON.stringify({ pattern: "nope" }))).toEqual(EMPTY_STATE);
  });

  it("fills in fields an older save lacks", () => {
    const s = parseState(JSON.stringify({ pattern: "silk" }));
    expect(s.pattern).toBe("silk");
    expect(s.progress).toEqual(EMPTY_PROGRESS);
  });
});

describe("SteamPerkStore", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    window.BOOTSTRAP_CONFIG = undefined;
  });

  const steam = () => {
    window.BOOTSTRAP_CONFIG = {
      gitCommit: "abc",
      gameEnv: "prod",
      turnstileSiteKey: "k",
      jwtAudience: "invalid",
      edition: "steam",
    } as typeof window.BOOTSTRAP_CONFIG;
  };

  it("does nothing outside the Steam edition", () => {
    savePerks({ ...EMPTY_STATE, pattern: "silk", flag: DEFAULT_FLAG });
    expect(applySteamCosmetics({})).toEqual({});
    expect(recordSteamGameEnd(game({ won: true }))).toEqual([]);
    expect(loadPerks().progress.wins).toBe(0);
  });

  it("applies the pattern and banner in the Steam edition", () => {
    steam();
    savePerks({ ...EMPTY_STATE, pattern: "silk", flag: DEFAULT_FLAG });
    const c = applySteamCosmetics({ flag: "/flags/x.svg" });
    expect(c.pattern?.name).toBe("steam_silk");
    expect(c.flag).toMatch(/^data:image\/svg\+xml;/);
  });

  it("records games and hands out the chosen title once earned", () => {
    steam();
    savePerks({ ...EMPTY_STATE, title: "first_win" });
    expect(steamTitleId()).toBe(null);
    expect(recordSteamGameEnd(game({ won: true }))).toEqual(["first_win"]);
    expect(steamTitleId()).toBe("first_win");
  });
});
