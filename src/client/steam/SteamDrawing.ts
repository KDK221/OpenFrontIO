// Player-drawn Steam perks: a two-colour territory pattern and a pixel-art
// banner. Pure functions (no DOM) so they can be unit-tested; the editor UI
// lives in components/SteamPerksPanel.ts.

import { decodePatternData } from "@openfront/shared/PatternDecoder";
import { z } from "zod";
import { encodePattern } from "./PatternCodec";

// ---------------------------------------------------------------------------
// base64url (the pattern wire format)
// ---------------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function fromBase64url(input: string): Uint8Array {
  const clean = input.replace(/=+$/, "");
  if (!/^[A-Za-z0-9_-]*$/.test(clean) || clean.length % 4 === 1) {
    throw new Error("invalid base64url");
  }
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : 0);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grids
// ---------------------------------------------------------------------------

/** A grid of small integers: 0/1 for a pattern, palette indexes for a banner. */
export interface Grid {
  width: number;
  height: number;
  cells: Uint8Array; // row-major
}

export function emptyGrid(width: number, height: number, value = 0): Grid {
  return { width, height, cells: new Uint8Array(width * height).fill(value) };
}

export function cloneGrid(g: Grid): Grid {
  return { width: g.width, height: g.height, cells: g.cells.slice() };
}

export function setCell(g: Grid, x: number, y: number, v: number): boolean {
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return false;
  const i = y * g.width + x;
  if (g.cells[i] === v) return false;
  g.cells[i] = v;
  return true;
}

/** Paints a straight line of cells, so a fast drag leaves no gaps. */
export function paintLine(
  g: Grid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  v: number,
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    setCell(g, x, y, v);
  }
}

/** Bucket fill of the 4-connected region under (x, y). */
export function floodFill(g: Grid, x: number, y: number, v: number): void {
  if (x < 0 || y < 0 || x >= g.width || y >= g.height) return;
  const target = g.cells[y * g.width + x];
  if (target === v) return;
  const stack = [y * g.width + x];
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (g.cells[i] !== target) continue;
    g.cells[i] = v;
    const cx = i % g.width;
    const cy = (i - cx) / g.width;
    if (cx > 0) stack.push(i - 1);
    if (cx < g.width - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - g.width);
    if (cy < g.height - 1) stack.push(i + g.width);
  }
}

/** Resizes by nearest neighbour, keeping the drawing when the size changes. */
export function resizeGrid(g: Grid, width: number, height: number): Grid {
  const out = emptyGrid(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x * g.width) / width);
      const sy = Math.floor((y * g.height) / height);
      out.cells[y * width + x] = g.cells[sy * g.width + sx];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawn territory pattern
// ---------------------------------------------------------------------------

/** Square sizes the pattern editor offers (the decoder allows up to 129x65). */
export const PATTERN_SIZES = [8, 16, 24, 32, 48, 64] as const;
/** How many map tiles one drawn cell covers: 1, 2 or 4 (pattern scale 0-2). */
export const PATTERN_SCALES = [0, 1, 2] as const;

export interface DrawnPattern {
  grid: Grid; // 1 = pattern colour, 0 = territory colour
  scale: number;
}

export function encodeDrawnPattern(p: DrawnPattern): string {
  return encodePattern(
    p.grid.width,
    p.grid.height,
    p.scale,
    (x, y) => p.grid.cells[y * p.grid.width + x] === 0,
  );
}

export function decodeDrawnPattern(data: string): DrawnPattern {
  const { width, height, scale, bytes } = decodePatternData(data, fromBase64url);
  const grid = emptyGrid(width, height);
  for (let i = 0; i < width * height; i++) {
    grid.cells[i] = (bytes[3 + (i >> 3)] >> (i & 7)) & 1;
  }
  return { grid, scale };
}

/** A starting pattern for the editor: a simple diamond. */
export function starterPattern(size = 16): DrawnPattern {
  const grid = emptyGrid(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.abs(x + 0.5 - c) + Math.abs(y + 0.5 - c) <= c / 2) {
        grid.cells[y * size + x] = 1;
      }
    }
  }
  return { grid, scale: 0 };
}

// ---------------------------------------------------------------------------
// Drawn banner
// ---------------------------------------------------------------------------

export const FLAG_GRID_W = 30;
export const FLAG_GRID_H = 20;
export const FLAG_PALETTE_SIZE = 8;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const DrawnFlagSchema = z
  .object({
    palette: z.array(Hex).length(FLAG_PALETTE_SIZE),
    // One palette index (0-7) per cell, row-major, 30x20.
    pixels: z
      .string()
      .length(FLAG_GRID_W * FLAG_GRID_H)
      .regex(/^[0-7]+$/),
  })
  .strict();
export type DrawnFlag = z.infer<typeof DrawnFlagSchema>;

export const DEFAULT_FLAG_PALETTE = [
  "#8b1e1e",
  "#efe6d2",
  "#d9a84a",
  "#1a1410",
  "#1f3f7a",
  "#2d5a27",
  "#5b2a86",
  "#ffffff",
];

export function flagToGrid(f: DrawnFlag): Grid {
  const grid = emptyGrid(FLAG_GRID_W, FLAG_GRID_H);
  for (let i = 0; i < grid.cells.length; i++) {
    grid.cells[i] = f.pixels.charCodeAt(i) - 48;
  }
  return grid;
}

export function gridToFlag(grid: Grid, palette: string[]): DrawnFlag {
  const g =
    grid.width === FLAG_GRID_W && grid.height === FLAG_GRID_H
      ? grid
      : resizeGrid(grid, FLAG_GRID_W, FLAG_GRID_H);
  let pixels = "";
  for (const c of g.cells) pixels += String(Math.min(7, c));
  return DrawnFlagSchema.parse({ palette, pixels });
}

export function blankFlag(): DrawnFlag {
  return gridToFlag(emptyGrid(FLAG_GRID_W, FLAG_GRID_H), DEFAULT_FLAG_PALETTE);
}

/** The pixel banner as a 3:2 SVG, one rect per horizontal run of a colour. */
export function renderDrawnFlagSvg(flag: DrawnFlag): string {
  const f = DrawnFlagSchema.parse(flag);
  const cell = 10;
  let rects = "";
  for (let y = 0; y < FLAG_GRID_H; y++) {
    let x = 0;
    while (x < FLAG_GRID_W) {
      const v = f.pixels[y * FLAG_GRID_W + x];
      let run = 1;
      while (
        x + run < FLAG_GRID_W &&
        f.pixels[y * FLAG_GRID_W + x + run] === v
      ) {
        run++;
      }
      rects += `<rect x="${x * cell}" y="${y * cell}" width="${run * cell}" height="${cell}" fill="${f.palette[Number(v)]}"/>`;
      x += run;
    }
  }
  const w = FLAG_GRID_W * cell;
  const h = FLAG_GRID_H * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

export function drawnFlagDataUrl(flag: DrawnFlag): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderDrawnFlagSvg(flag))}`;
}

// ---------------------------------------------------------------------------
// Importing a picture (RGBA pixels already scaled to the grid)
// ---------------------------------------------------------------------------

const luminance = (r: number, g: number, b: number) =>
  0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Two colours from a picture: darker-than-average cells become the pattern
 * colour. Transparent cells stay the territory colour.
 */
export function imageToPatternGrid(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Grid {
  const grid = emptyGrid(width, height);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    sum += luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    count++;
  }
  const threshold = count > 0 ? sum / count : 128;
  for (let i = 0; i < width * height; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const l = luminance(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    grid.cells[i] = l < threshold ? 1 : 0;
  }
  return grid;
}

const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * A banner from a picture: picks up to eight colours from the picture
 * (median cut) and maps every cell to the nearest one.
 */
export function imageToFlag(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  background = DEFAULT_FLAG_PALETTE[1],
): DrawnFlag {
  const bg = parseHex(background);
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // Blend transparency onto the background colour.
    pixels.push([
      rgba[i * 4] * a + bg[0] * (1 - a),
      rgba[i * 4 + 1] * a + bg[1] * (1 - a),
      rgba[i * 4 + 2] * a + bg[2] * (1 - a),
    ]);
  }
  const palette = medianCut(pixels, FLAG_PALETTE_SIZE).map((c) =>
    toHex(c[0], c[1], c[2]),
  );
  while (palette.length < FLAG_PALETTE_SIZE) {
    palette.push(DEFAULT_FLAG_PALETTE[palette.length]);
  }
  const rgbPalette = palette.map(parseHex);
  const grid = emptyGrid(width, height);
  pixels.forEach((p, i) => {
    let best = 0;
    let bestD = Infinity;
    rgbPalette.forEach((c, k) => {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    grid.cells[i] = best;
  });
  return gridToFlag(grid, palette);
}

function medianCut(
  pixels: [number, number, number][],
  colors: number,
): [number, number, number][] {
  if (pixels.length === 0) return [];
  let boxes: [number, number, number][][] = [pixels];
  while (boxes.length < colors) {
    // Split the box with the widest channel range.
    let pick = -1;
    let pickRange = 0;
    let pickChannel = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          lo = Math.min(lo, p[ch]);
          hi = Math.max(hi, p[ch]);
        }
        if (hi - lo > pickRange) {
          pickRange = hi - lo;
          pick = i;
          pickChannel = ch;
        }
      }
    });
    if (pick < 0 || pickRange < 8) break;
    const box = [...boxes[pick]].sort((a, b) => a[pickChannel] - b[pickChannel]);
    const mid = box.length >> 1;
    boxes = [...boxes.slice(0, pick), box.slice(0, mid), box.slice(mid), ...boxes.slice(pick + 1)];
  }
  return boxes.map((box) => {
    const s = box.reduce(
      (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
      [0, 0, 0],
    );
    return [s[0] / box.length, s[1] / box.length, s[2] / box.length] as [
      number,
      number,
      number,
    ];
  });
}
