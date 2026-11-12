import { PatternDataSchema } from "@openfront/shared/CosmeticSchemas";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  blankFlag,
  decodeDrawnPattern,
  DEFAULT_FLAG_PALETTE,
  drawnFlagDataUrl,
  DrawnFlagSchema,
  emptyGrid,
  encodeDrawnPattern,
  FLAG_GRID_H,
  FLAG_GRID_W,
  flagToGrid,
  floodFill,
  fromBase64url,
  gridToFlag,
  imageToFlag,
  imageToPatternGrid,
  paintLine,
  PATTERN_SIZES,
  renderDrawnFlagSvg,
  resizeGrid,
  starterPattern,
} from "../../src/client/steam/SteamDrawing";
import { EMPTY_STATE, parseState, toBase64url } from "../../src/client/steam/SteamPerks";
import { applySteamCosmetics, savePerks } from "../../src/client/steam/SteamPerkStore";

const rgba = (pixels: [number, number, number, number][]) =>
  new Uint8ClampedArray(pixels.flat());

describe("base64url", () => {
  it("round-trips every length", () => {
    for (let n = 0; n < 12; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
      expect(fromBase64url(toBase64url(bytes))).toEqual(bytes);
    }
  });

  it("rejects malformed input", () => {
    expect(() => fromBase64url("a")).toThrow();
    expect(() => fromBase64url("ab$c")).toThrow();
  });
});

describe("grid editing", () => {
  it("draws a gapless line", () => {
    const g = emptyGrid(8, 8);
    paintLine(g, 0, 0, 7, 3, 1);
    expect(g.cells[0]).toBe(1);
    expect(g.cells[3 * 8 + 7]).toBe(1);
    // Every column got at least one cell.
    for (let x = 0; x < 8; x++) {
      expect([0, 1, 2, 3].some((y) => g.cells[y * 8 + x] === 1)).toBe(true);
    }
  });

  it("fills only the connected region", () => {
    const g = emptyGrid(5, 5);
    for (let y = 0; y < 5; y++) g.cells[y * 5 + 2] = 1; // a wall in column 2
    floodFill(g, 0, 0, 2);
    expect(g.cells[0]).toBe(2);
    expect(g.cells[1 * 5 + 1]).toBe(2);
    expect(g.cells[4]).toBe(0); // the other side of the wall
    expect(g.cells[2]).toBe(1);
  });

  it("keeps the drawing when resized", () => {
    const g = emptyGrid(2, 2);
    g.cells[3] = 1;
    const r = resizeGrid(g, 4, 4);
    expect(r.cells[3 * 4 + 3]).toBe(1);
    expect(r.cells[0]).toBe(0);
  });
});

describe("drawn pattern", () => {
  it.each(PATTERN_SIZES)("a %i x %i drawing is valid pattern data", (size) => {
    const p = starterPattern(size);
    p.scale = 2;
    const data = encodeDrawnPattern(p);
    expect(PatternDataSchema.safeParse(data).success).toBe(true);
    const back = decodeDrawnPattern(data);
    expect(back.scale).toBe(2);
    expect(back.grid.width).toBe(size);
    expect(Array.from(back.grid.cells)).toEqual(Array.from(p.grid.cells));
  });

  it("fits the renderer's 1024 bytes per player", () => {
    const biggest = Math.max(...PATTERN_SIZES);
    expect(Math.ceil((biggest * biggest) / 8)).toBeLessThanOrEqual(1024);
  });

  it("turns a picture into two colours by brightness", () => {
    const g = imageToPatternGrid(
      rgba([
        [0, 0, 0, 255],
        [255, 255, 255, 255],
        [20, 20, 20, 255],
        [30, 30, 30, 0], // transparent: territory colour
      ]),
      2,
      2,
    );
    expect(Array.from(g.cells)).toEqual([1, 0, 1, 0]);
  });
});

describe("drawn banner", () => {
  it("is a 30x20 grid of palette indexes", () => {
    const f = blankFlag();
    expect(f.pixels.length).toBe(FLAG_GRID_W * FLAG_GRID_H);
    expect(DrawnFlagSchema.safeParse({ ...f, pixels: "9".repeat(600) }).success).toBe(
      false,
    );
  });

  it("round-trips through a grid", () => {
    const g = flagToGrid(blankFlag());
    floodFill(g, 0, 0, 3);
    g.cells[5] = 6;
    const f = gridToFlag(g, DEFAULT_FLAG_PALETTE);
    expect(Array.from(flagToGrid(f).cells)).toEqual(Array.from(g.cells));
  });

  it("renders runs of colour as rects", () => {
    const svg = renderDrawnFlagSvg(blankFlag());
    // A blank banner is one run per row.
    expect(svg.match(/<rect /g)?.length).toBe(FLAG_GRID_H);
    expect(drawnFlagDataUrl(blankFlag())).toMatch(/^data:image\/svg\+xml;/);
  });

  it("refuses palette entries that are not colours", () => {
    const bad = { ...blankFlag(), palette: [...DEFAULT_FLAG_PALETTE] };
    bad.palette[0] = "red\"/><script>";
    expect(() => renderDrawnFlagSvg(bad)).toThrow();
  });

  it("picks a palette from a picture", () => {
    const w = FLAG_GRID_W;
    const h = FLAG_GRID_H;
    const pixels: [number, number, number, number][] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        pixels.push(x < w / 2 ? [200, 0, 0, 255] : [0, 0, 200, 255]);
      }
    }
    const f = imageToFlag(rgba(pixels), w, h);
    const g = flagToGrid(f);
    const left = f.palette[g.cells[0]];
    const right = f.palette[g.cells[w - 1]];
    expect(left).toBe("#c80000");
    expect(right).toBe("#0000c8");
  });
});

describe("drawn perks in saved state and cosmetics", () => {
  beforeEach(() => {
    localStorage.clear();
    window.BOOTSTRAP_CONFIG = {
      gitCommit: "abc",
      gameEnv: "prod",
      turnstileSiteKey: "k",
      jwtAudience: "invalid",
      edition: "steam",
    } as typeof window.BOOTSTRAP_CONFIG;
  });
  afterEach(() => {
    window.BOOTSTRAP_CONFIG = undefined;
  });

  it("drops a drawn pattern that no longer decodes", () => {
    const s = parseState(JSON.stringify({ pattern: "custom", customPattern: "xx" }));
    expect(s).toEqual(EMPTY_STATE);
  });

  it("uses the drawn pattern and banner", () => {
    const data = encodeDrawnPattern(starterPattern(16));
    savePerks({
      ...EMPTY_STATE,
      pattern: "custom",
      customPattern: data,
      drawnFlag: blankFlag(),
      useDrawnFlag: true,
    });
    const c = applySteamCosmetics({});
    expect(c.pattern?.patternData).toBe(data);
    expect(c.pattern?.name).toBe("steam_drawn");
    expect(c.flag).toBe(drawnFlagDataUrl(blankFlag()));
  });

  it("falls back to the banner-maker design when the drawing is not in use", () => {
    savePerks({ ...EMPTY_STATE, drawnFlag: blankFlag(), useDrawnFlag: false });
    expect(applySteamCosmetics({}).flag).toBeUndefined();
  });
});
