// Steam-edition perks: territory patterns, a custom banner and achievement
// titles. Everything here is pure (no DOM, no Lit) so it can be unit-tested;
// SteamPerkStore.ts persists the player's choices and progress.
//
// Stage 1 (now): singleplayer only. The perks apply to the local player's own
// game. Stage 2 (multiplayer) needs the game server to confirm Steam ownership
// before other players are shown them.

import type { PlayerPattern } from "@openfront/shared/WireSchemas";
import { z } from "zod";
import { encodePattern } from "./PatternCodec";
import { decodeDrawnPattern, DrawnFlagSchema } from "./SteamDrawing";

export { encodePattern, toBase64url } from "./PatternCodec";

// ---------------------------------------------------------------------------
// Territory patterns
// ---------------------------------------------------------------------------

export type PatternId =
  | "silk"
  | "lattice"
  | "wave"
  | "scales"
  | "stonewall"
  | "dots"
  | "diagonal"
  | "brocade";

interface PatternDef {
  id: PatternId;
  width: number; // 2..129
  height: number; // 2..65
  scale: number; // 0..7: each cell covers 2^scale tiles
  /** true = territory colour, false = the second (border) colour. */
  primary: (x: number, y: number) => boolean;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

const PATTERN_DEFS: readonly PatternDef[] = [
  // 비단: a fine checkerboard, like woven silk.
  {
    id: "silk",
    width: 8,
    height: 8,
    scale: 0,
    primary: (x, y) => (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0,
  },
  // 문살: a window-lattice grid.
  {
    id: "lattice",
    width: 12,
    height: 12,
    scale: 0,
    primary: (x, y) => x % 6 !== 0 && y % 6 !== 0,
  },
  // 물결: rolling waves.
  {
    id: "wave",
    width: 16,
    height: 8,
    scale: 0,
    primary: (x, y) => {
      const crest = Math.round(3 + 2.2 * Math.sin((x / 16) * 2 * Math.PI));
      const d = mod(y - crest, 8);
      return d !== 0 && d !== 1;
    },
  },
  // 기와: overlapping roof-tile scales.
  {
    id: "scales",
    width: 16,
    height: 8,
    scale: 0,
    primary: (x, y) => {
      const ring = (cx: number, cy: number) => {
        const d = Math.hypot(x - cx, (y - cy) * 1.0);
        return d >= 6.5 && d < 8;
      };
      return !(ring(8, 0) || ring(0, 8) || ring(16, 8));
    },
  },
  // 돌담: a stone wall of offset blocks.
  {
    id: "stonewall",
    width: 12,
    height: 12,
    scale: 0,
    primary: (x, y) => {
      if (y % 6 === 0) return false;
      const offset = Math.floor(y / 6) % 2 === 0 ? 0 : 6;
      return mod(x - offset, 12) !== 0;
    },
  },
  // 점박이: a scatter of dots.
  {
    id: "dots",
    width: 10,
    height: 10,
    scale: 0,
    primary: (x, y) => {
      const near = (cx: number, cy: number) =>
        Math.hypot(x - cx, y - cy) < 1.6;
      return !(near(2, 2) || near(7, 7));
    },
  },
  // 빗살: diagonal hatching.
  {
    id: "diagonal",
    width: 8,
    height: 8,
    scale: 0,
    primary: (x, y) => mod(x - y, 8) > 1,
  },
  // 금박: a brocade of diamonds.
  {
    id: "brocade",
    width: 16,
    height: 16,
    scale: 0,
    primary: (x, y) => {
      const d = Math.abs(x - 8) + Math.abs(y - 8);
      return !(d === 6 || d === 7 || d <= 1);
    },
  },
];

export const PATTERN_IDS: readonly PatternId[] = PATTERN_DEFS.map((p) => p.id);

function patternDef(id: PatternId): PatternDef {
  const def = PATTERN_DEFS.find((p) => p.id === id);
  if (def === undefined) throw new Error(`unknown pattern ${id}`);
  return def;
}

export interface PatternColors {
  primary: string;
  secondary: string;
}

/**
 * The PlayerPattern cosmetic for a pattern. Without colours it is drawn in
 * the player's own territory and border colours.
 */
export function steamPattern(
  id: PatternId,
  colors: PatternColors | null,
): PlayerPattern {
  const def = patternDef(id);
  return {
    name: `steam_${id}`,
    patternData: encodePattern(def.width, def.height, def.scale, def.primary),
    colorPalette:
      colors === null
        ? undefined
        : {
            name: "steam_custom",
            primaryColor: colors.primary,
            secondaryColor: colors.secondary,
          },
  };
}

/** The bitmap as rows of booleans (true = primary), for previews. */
export function patternCells(id: PatternId): boolean[][] {
  const def = patternDef(id);
  return Array.from({ length: def.height }, (_, y) =>
    Array.from({ length: def.width }, (_, x) => def.primary(x, y)),
  );
}

// ---------------------------------------------------------------------------
// Banner maker
// ---------------------------------------------------------------------------

export const FLAG_LAYOUTS = [
  "plain",
  "hsplit",
  "vsplit",
  "diagonal",
  "border",
  "band",
  "quarters",
] as const;
export const FLAG_EMBLEMS = [
  "none",
  "sun",
  "moon",
  "ring",
  "diamond",
  "flower",
  "star",
] as const;

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const FlagDesignSchema = z.object({
  layout: z.enum(FLAG_LAYOUTS),
  field: HexColor,
  accent: HexColor,
  emblem: z.enum(FLAG_EMBLEMS),
  emblemColor: HexColor,
  // One character (a Hanja or Hangul syllable reads best), or empty.
  glyph: z.string().max(8),
});
export type FlagDesign = z.infer<typeof FlagDesignSchema>;

export const DEFAULT_FLAG: FlagDesign = {
  layout: "border",
  field: "#8b1e1e",
  accent: "#d9b44a",
  emblem: "ring",
  emblemColor: "#f4ead5",
  glyph: "王",
};

/** The first user-perceived character, or "" — never more than one. */
export function singleGlyph(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        l?: string,
        o?: { granularity: "grapheme" },
      ) => { segment(s: string): Iterable<{ segment: string }> };
    }
  ).Segmenter;
  if (Segmenter !== undefined) {
    for (const s of new Segmenter(undefined, { granularity: "grapheme" })
      .segment(trimmed)) {
      return s.segment;
    }
  }
  return Array.from(trimmed)[0] ?? "";
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Banners are 3:2 like the nation flags in resources/flags.
const W = 300;
const H = 200;

function layoutSvg(d: FlagDesign): string {
  const f = d.field;
  const a = d.accent;
  switch (d.layout) {
    case "plain":
      return `<rect width="${W}" height="${H}" fill="${f}"/>`;
    case "hsplit":
      return `<rect width="${W}" height="${H}" fill="${f}"/><rect y="${H / 2}" width="${W}" height="${H / 2}" fill="${a}"/>`;
    case "vsplit":
      return `<rect width="${W}" height="${H}" fill="${f}"/><rect x="${W / 2}" width="${W / 2}" height="${H}" fill="${a}"/>`;
    case "diagonal":
      return `<rect width="${W}" height="${H}" fill="${f}"/><path d="M${W} 0L${W} ${H}L0 ${H}Z" fill="${a}"/>`;
    case "border":
      return `<rect width="${W}" height="${H}" fill="${a}"/><rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="${f}"/>`;
    case "band":
      return `<rect width="${W}" height="${H}" fill="${f}"/><rect y="${H / 3}" width="${W}" height="${H / 3}" fill="${a}"/>`;
    case "quarters":
      return `<rect width="${W}" height="${H}" fill="${f}"/><rect x="${W / 2}" width="${W / 2}" height="${H / 2}" fill="${a}"/><rect y="${H / 2}" width="${W / 2}" height="${H / 2}" fill="${a}"/>`;
  }
  return `<rect width="${W}" height="${H}" fill="${f}"/>`;
}

function emblemSvg(d: FlagDesign): string {
  const c = d.emblemColor;
  const cx = W / 2;
  const cy = H / 2;
  switch (d.emblem) {
    case "none":
      return "";
    case "sun":
      return `<circle cx="${cx}" cy="${cy}" r="58" fill="${c}"/>`;
    case "moon":
      return `<path d="M${cx + 20} ${cy - 56}A58 58 0 1 0 ${cx + 20} ${cy + 56}A46 46 0 1 1 ${cx + 20} ${cy - 56}Z" fill="${c}"/>`;
    case "ring":
      return `<circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${c}" stroke-width="10"/>`;
    case "diamond":
      return `<path d="M${cx} ${cy - 66}L${cx + 66} ${cy}L${cx} ${cy + 66}L${cx - 66} ${cy}Z" fill="${c}"/>`;
    case "flower": {
      const petals = Array.from({ length: 8 }, (_, i) => {
        const t = (i * Math.PI) / 4;
        const px = cx + Math.cos(t) * 34;
        const py = cy + Math.sin(t) * 34;
        return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="22" fill="${c}"/>`;
      }).join("");
      return `${petals}<circle cx="${cx}" cy="${cy}" r="24" fill="${c}"/>`;
    }
    case "star": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? 64 : 26;
        const t = -Math.PI / 2 + (i * Math.PI) / 5;
        return `${(cx + Math.cos(t) * r).toFixed(1)} ${(cy + Math.sin(t) * r).toFixed(1)}`;
      }).join("L");
      return `<path d="M${pts}Z" fill="${c}"/>`;
    }
  }
  return "";
}

/** A dark or light ink for the glyph, whichever reads on the emblem/field. */
function glyphInk(d: FlagDesign): string {
  const bg = d.emblem === "none" || d.emblem === "ring" ? d.field : d.emblemColor;
  const n = parseInt(bg.slice(1), 16);
  const lum =
    0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? "#1a1410" : "#f8f1e3";
}

export function renderFlagSvg(design: FlagDesign): string {
  const d = FlagDesignSchema.parse(design);
  const glyph = singleGlyph(d.glyph);
  const text =
    glyph === ""
      ? ""
      : `<text x="${W / 2}" y="${H / 2}" dy="0.35em" text-anchor="middle" font-size="76" font-weight="700" font-family="'Noto Serif KR','Noto Serif CJK KR','Batang','Songti SC','Hiragino Mincho ProN',serif" fill="${glyphInk(d)}">${escapeXml(glyph)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${layoutSvg(d)}${emblemSvg(d)}${text}</svg>`;
}

/** The banner as a data: URL, usable anywhere a flag image URL is. */
export function flagDataUrl(design: FlagDesign): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderFlagSvg(design))}`;
}

// ---------------------------------------------------------------------------
// Achievements and titles
// ---------------------------------------------------------------------------

export type AchievementId =
  | "first_win"
  | "hard_win"
  | "impossible_win"
  | "all_scenarios"
  | "fire_master"
  | "thunder_master"
  | "plague_master"
  | "conqueror";

export const ProgressSchema = z.object({
  wins: z.number().int().nonnegative().default(0),
  scenarioWinMaps: z.array(z.string()).default([]),
  fireAttacks: z.number().int().nonnegative().default(0),
  thunderCatapults: z.number().int().nonnegative().default(0),
  plagues: z.number().int().nonnegative().default(0),
  bestConquests: z.number().int().nonnegative().default(0),
  hardWin: z.boolean().default(false),
  impossibleWin: z.boolean().default(false),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const EMPTY_PROGRESS: Progress = ProgressSchema.parse({});

/** The three maps a scenario win counts toward "all_scenarios" on. */
export const SCENARIO_MAP_IDS = ["Samguk", "Sengoku", "WarringStates"];

export interface AchievementDef {
  id: AchievementId;
  /** How far along the player is, and the target. */
  progress: (p: Progress) => { value: number; target: number };
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first_win", progress: (p) => ({ value: Math.min(p.wins, 1), target: 1 }) },
  { id: "hard_win", progress: (p) => ({ value: p.hardWin ? 1 : 0, target: 1 }) },
  {
    id: "impossible_win",
    progress: (p) => ({ value: p.impossibleWin ? 1 : 0, target: 1 }),
  },
  {
    id: "all_scenarios",
    progress: (p) => ({
      value: SCENARIO_MAP_IDS.filter((m) => p.scenarioWinMaps.includes(m))
        .length,
      target: SCENARIO_MAP_IDS.length,
    }),
  },
  {
    id: "fire_master",
    progress: (p) => ({ value: Math.min(p.fireAttacks, 10), target: 10 }),
  },
  {
    id: "thunder_master",
    progress: (p) => ({ value: Math.min(p.thunderCatapults, 5), target: 5 }),
  },
  {
    id: "plague_master",
    progress: (p) => ({ value: Math.min(p.plagues, 3), target: 3 }),
  },
  {
    id: "conqueror",
    progress: (p) => ({ value: Math.min(p.bestConquests, 15), target: 15 }),
  },
];

export const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map(
  (a) => a.id,
);

export function isUnlocked(id: AchievementId, p: Progress): boolean {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (a === undefined) return false;
  const { value, target } = a.progress(p);
  return value >= target;
}

export function unlockedAchievements(p: Progress): AchievementId[] {
  return ACHIEVEMENT_IDS.filter((id) => isUnlocked(id, p));
}

/** What a finished singleplayer game contributes to the player's progress. */
export interface GameEndSummary {
  won: boolean;
  difficulty: string; // Difficulty enum value
  map: string; // GameMapType enum value
  scenario: boolean;
  fireAttacks: number; // atom-bomb slot launches
  thunderCatapults: number; // hydrogen-bomb slot launches
  plagues: number; // MIRV slot launches
  conquests: number;
}

export function recordGameEnd(
  before: Progress,
  end: GameEndSummary,
): { progress: Progress; unlocked: AchievementId[] } {
  const p: Progress = {
    ...before,
    scenarioWinMaps: [...before.scenarioWinMaps],
  };
  p.fireAttacks += Math.max(0, Math.floor(end.fireAttacks));
  p.thunderCatapults += Math.max(0, Math.floor(end.thunderCatapults));
  p.plagues += Math.max(0, Math.floor(end.plagues));
  p.bestConquests = Math.max(p.bestConquests, Math.floor(end.conquests));
  if (end.won) {
    p.wins += 1;
    if (end.difficulty === "Hard" || end.difficulty === "Impossible") {
      p.hardWin = true;
    }
    if (end.difficulty === "Impossible") p.impossibleWin = true;
    if (end.scenario && !p.scenarioWinMaps.includes(end.map)) {
      p.scenarioWinMaps.push(end.map);
    }
  }
  const had = new Set(unlockedAchievements(before));
  const unlocked = unlockedAchievements(p).filter((id) => !had.has(id));
  return { progress: p, unlocked };
}

/** Sums a stats counter that may arrive as bigints, numeric strings or numbers. */
export function statCount(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return 0;
}

/** The player's own numbers out of the end-of-game stats record. */
export function summarizeStats(stats: unknown): {
  fireAttacks: number;
  thunderCatapults: number;
  plagues: number;
  conquests: number;
} {
  const s = (stats ?? {}) as {
    bombs?: Record<string, unknown[] | undefined>;
    conquests?: unknown[];
  };
  const launched = (k: string) => statCount(s.bombs?.[k]?.[0]);
  return {
    fireAttacks: launched("abomb"),
    thunderCatapults: launched("hbomb"),
    plagues: launched("mirv"),
    conquests: (s.conquests ?? []).reduce<number>(
      (sum, v) => sum + statCount(v),
      0,
    ),
  };
}

// ---------------------------------------------------------------------------
// Saved choices
// ---------------------------------------------------------------------------

/** Pattern data the player drew, kept only if it still decodes. */
const DrawnPatternDataSchema = z.string().max(1403).refine((data) => {
  try {
    decodeDrawnPattern(data);
    return true;
  } catch {
    return false;
  }
});

export const SteamPerksStateSchema = z.object({
  // A preset pattern, "custom" for the one the player drew, or none.
  pattern: z
    .enum(["custom", ...PATTERN_IDS] as ["custom", ...PatternId[]])
    .nullable()
    .default(null),
  customPattern: DrawnPatternDataSchema.nullable().default(null),
  patternColors: z
    .object({ primary: HexColor, secondary: HexColor })
    .nullable()
    .default(null),
  flag: FlagDesignSchema.nullable().default(null),
  // A pixel banner the player drew, and whether it is the one in use (over
  // the banner-maker design in `flag`).
  drawnFlag: DrawnFlagSchema.nullable().default(null),
  useDrawnFlag: z.boolean().default(false),
  title: z.enum(ACHIEVEMENT_IDS as [AchievementId, ...AchievementId[]]).nullable().default(null),
  progress: ProgressSchema.default(EMPTY_PROGRESS),
});
export type SteamPerksState = z.infer<typeof SteamPerksStateSchema>;

export const EMPTY_STATE: SteamPerksState = SteamPerksStateSchema.parse({});

/** Reads saved state, falling back to defaults for anything unreadable. */
export function parseState(raw: string | null): SteamPerksState {
  if (raw === null) return EMPTY_STATE;
  try {
    const parsed = SteamPerksStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

/** The title to show only once it has actually been earned. */
export function activeTitle(state: SteamPerksState): AchievementId | null {
  return state.title !== null && isUnlocked(state.title, state.progress)
    ? state.title
    : null;
}
