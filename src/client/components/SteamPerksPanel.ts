import { html, LitElement, nothing, svg, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ClientEnv } from "../ClientEnv";
import {
  blankFlag,
  cloneGrid,
  decodeDrawnPattern,
  DEFAULT_FLAG_PALETTE,
  drawnFlagDataUrl,
  emptyGrid,
  encodeDrawnPattern,
  FLAG_GRID_H,
  FLAG_GRID_W,
  flagToGrid,
  gridToFlag,
  imageToFlag,
  imageToPatternGrid,
  PATTERN_SCALES,
  PATTERN_SIZES,
  resizeGrid,
  starterPattern,
  type DrawnPattern,
  type Grid,
} from "../steam/SteamDrawing";
import "./PixelEditor";
import type { PixelEditor } from "./PixelEditor";
import {
  ACHIEVEMENTS,
  DEFAULT_FLAG,
  FLAG_EMBLEMS,
  FLAG_LAYOUTS,
  PATTERN_IDS,
  flagDataUrl,
  isUnlocked,
  patternCells,
  singleGlyph,
  type FlagDesign,
  type PatternId,
  type SteamPerksState,
} from "../steam/SteamPerks";
import {
  loadPerks,
  STEAM_PERKS_CHANGED,
  updatePerks,
} from "../steam/SteamPerkStore";
import { titleTagText } from "../steam/SteamTitle";
import { translateText } from "../Utils";

type Tab = "pattern" | "flag" | "title";

// Preview colours when the player keeps their own territory colours.
const OWN_PRIMARY = "#b5543c";
const OWN_SECONDARY = "#3a281c";

/** The drawn pattern to start the editor from: the saved one, or a starter. */
function savedDrawnPattern(s: SteamPerksState): DrawnPattern {
  if (s.customPattern !== null) {
    try {
      return decodeDrawnPattern(s.customPattern);
    } catch {
      // Unreadable: start fresh.
    }
  }
  return starterPattern(16);
}

/**
 * Reads a picture file as RGBA pixels at width x height, cropped to fill
 * (like CSS object-fit: cover) so it is not squashed.
 */
async function pictureToPixels(
  file: File,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const sw = width / scale;
    const sh = height / scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      (img.naturalWidth - sw) / 2,
      (img.naturalHeight - sh) / 2,
      sw,
      sh,
      0,
      0,
      width,
      height,
    );
    return ctx.getImageData(0, 0, width, height).data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The tile as a PNG data URL, for a repeating CSS background preview. */
function tileDataUrl(grid: Grid, primary: string, secondary: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return "";
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      ctx.fillStyle = grid.cells[y * grid.width + x] === 1 ? secondary : primary;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL();
}

const t = (key: string, params?: Record<string, string | number>) =>
  translateText(`steam_perks.${key}`, params);

/**
 * The Steam-edition perks on the home screen: a card that opens a window for
 * the territory pattern, the banner maker and achievement titles. In the web
 * edition the window opens as a locked preview.
 */
@customElement("steam-perks")
export class SteamPerksPanel extends LitElement {
  @state() private open = false;
  @state() private tab: Tab = "pattern";
  @state() private perks: SteamPerksState = loadPerks();
  @state() private draft: FlagDesign = loadPerks().flag ?? DEFAULT_FLAG;
  // Drawing a pattern.
  @state() private patternDraft: DrawnPattern = savedDrawnPattern(loadPerks());
  @state() private patternTool: "pen" | "eraser" | "fill" = "pen";
  @state() private drawingPattern = false;
  // Drawing a banner.
  @state() private flagMode: "builder" | "draw" = loadPerks().useDrawnFlag
    ? "draw"
    : "builder";
  @state() private flagGrid: Grid = flagToGrid(loadPerks().drawnFlag ?? blankFlag());
  @state() private flagPalette: string[] = [
    ...(loadPerks().drawnFlag?.palette ?? DEFAULT_FLAG_PALETTE),
  ];
  @state() private flagColor = 0;
  @state() private flagTool: "pen" | "fill" = "pen";

  createRenderRoot() {
    return this;
  }

  private readonly onChanged = () => {
    this.perks = loadPerks();
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(STEAM_PERKS_CHANGED, this.onChanged);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(STEAM_PERKS_CHANGED, this.onChanged);
  }

  private get unlocked(): boolean {
    return ClientEnv.isSteamEdition();
  }

  private show() {
    this.perks = loadPerks();
    this.draft = this.perks.flag ?? DEFAULT_FLAG;
    this.patternDraft = savedDrawnPattern(this.perks);
    this.drawingPattern = this.perks.pattern === "custom";
    this.flagMode = this.perks.useDrawnFlag ? "draw" : "builder";
    const drawn = this.perks.drawnFlag ?? blankFlag();
    this.flagGrid = flagToGrid(drawn);
    this.flagPalette = [...drawn.palette];
    this.open = true;
  }

  private change(fn: (s: SteamPerksState) => SteamPerksState) {
    if (!this.unlocked) return;
    this.perks = updatePerks(fn);
  }

  render() {
    return html`${this.renderCard()}${this.open ? this.renderModal() : nothing}`;
  }

  private renderCard() {
    return html`<button
      type="button"
      class="steam-perks-card group w-full text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all active:scale-[0.99]"
      @click=${() => this.show()}
    >
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="text-lg font-bold text-white">${t("card_title")}</span>
          <span
            class="steam-perks-badge rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            >${this.unlocked ? t("badge_steam") : `🔒 ${t("badge_locked")}`}</span
          >
        </span>
        <span class="block text-xs text-white/70 mt-0.5">${t("card_desc")}</span>
      </span>
      <span
        class="shrink-0 text-2xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all"
        >›</span
      >
    </button>`;
  }

  private renderModal() {
    const tabs: Tab[] = ["pattern", "flag", "title"];
    return html`<div
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="steam-perks-title"
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) this.open = false;
      }}
    >
      <div
        class="steam-perks-panel w-full max-w-2xl max-h-[90dvh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
      >
        <div class="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 id="steam-perks-title" class="text-xl font-bold text-white">
            ${t("card_title")}
          </h2>
          <button
            type="button"
            class="text-white/60 hover:text-white text-sm"
            @click=${() => (this.open = false)}
          >
            ${t("close")}
          </button>
        </div>
        ${
          this.unlocked
            ? html`<p class="px-5 pt-1 text-xs text-white/50">
                ${t("singleplayer_note")}
              </p>`
            : html`<p
                class="steam-perks-locked mx-5 mt-2 rounded-lg px-3 py-2 text-sm"
              >
                🔒 ${t("locked_notice")}
              </p>`
        }
        <div class="flex gap-1 px-5 pt-3 border-b border-white/10">
          ${tabs.map(
            (tab) =>
              html`<button
                type="button"
                class="steam-perks-tab px-3 py-2 text-sm font-bold ${this.tab === tab ? "is-active" : ""}"
                aria-pressed=${this.tab === tab}
                @click=${() => (this.tab = tab)}
              >
                ${t(`tab_${tab}`)}
              </button>`,
          )}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          ${
            this.tab === "pattern"
              ? this.renderPatterns()
              : this.tab === "flag"
                ? this.renderFlag()
                : this.renderTitles()
          }
        </div>
      </div>
    </div>`;
  }

  // -- Territory pattern ----------------------------------------------------

  private patternSwatch(id: PatternId | null) {
    const colors = this.perks.patternColors;
    const primary = colors?.primary ?? OWN_PRIMARY;
    const secondary = colors?.secondary ?? OWN_SECONDARY;
    if (id === null) {
      return html`<svg viewBox="0 0 64 40" class="w-full h-full block">
        <rect width="64" height="40" fill=${primary} />
      </svg>`;
    }
    const cells = patternCells(id);
    const h = cells.length;
    const w = cells[0].length;
    // Tile the bitmap over the swatch so the repeat reads.
    const cols = Math.ceil(64 / w) * w;
    const rows = Math.ceil(40 / h) * h;
    const marks: TemplateResult[] = [];
    for (let y = 0; y < rows && y < 40; y++) {
      for (let x = 0; x < cols && x < 64; x++) {
        if (!cells[y % h][x % w]) {
          marks.push(
            svg`<rect x=${x} y=${y} width="1" height="1" fill=${secondary} />`,
          );
        }
      }
    }
    return html`<svg
      viewBox="0 0 64 40"
      class="w-full h-full block"
      shape-rendering="crispEdges"
    >
      <rect width="64" height="40" fill=${primary} />${marks}
    </svg>`;
  }

  private renderPatterns() {
    const current = this.perks.pattern;
    const colors = this.perks.patternColors;
    const options: (PatternId | null)[] = [null, ...PATTERN_IDS];
    return html`<div class="space-y-4">
      <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <button
          type="button"
          class="steam-perks-option rounded-lg border overflow-hidden text-left ${current === "custom" || this.drawingPattern ? "is-active" : ""}"
          @click=${() => (this.drawingPattern = true)}
        >
          <span
            class="block aspect-[8/5] bg-center"
            style=${this.tileStyle(this.patternDraft, 3)}
          ></span>
          <span class="block px-2 py-1 text-xs text-white/90"
            >✏️ ${t("draw_own")}</span
          >
        </button>
        ${options.map(
          (id) =>
            html`<button
              type="button"
              class="steam-perks-option rounded-lg border overflow-hidden text-left ${current === id ? "is-active" : ""}"
              ?disabled=${!this.unlocked}
              @click=${() => {
                this.drawingPattern = false;
                this.change((s) => ({ ...s, pattern: id }));
              }}
            >
              <span class="block aspect-[8/5]">${this.patternSwatch(id)}</span>
              <span class="block px-2 py-1 text-xs text-white/90"
                >${id === null ? t("pattern_none") : t(`pattern.${id}`)}</span
              >
            </button>`,
        )}
      </div>
      ${this.drawingPattern ? this.renderPatternEditor() : nothing}
      <div class="flex flex-wrap items-center gap-4 text-sm text-white/80">
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            .checked=${colors === null}
            ?disabled=${!this.unlocked}
            @change=${(e: Event) => {
              const own = (e.target as HTMLInputElement).checked;
              this.change((s) => ({
                ...s,
                patternColors: own
                  ? null
                  : { primary: OWN_PRIMARY, secondary: OWN_SECONDARY },
              }));
            }}
          />
          ${t("pattern_own_colors")}
        </label>
        ${
          colors === null
            ? nothing
            : html`${this.colorInput(t("pattern_color_1"), colors.primary, (v) =>
                this.change((s) => ({
                  ...s,
                  patternColors: { ...(s.patternColors ?? colors), primary: v },
                })),
              )}${this.colorInput(t("pattern_color_2"), colors.secondary, (v) =>
                this.change((s) => ({
                  ...s,
                  patternColors: {
                    ...(s.patternColors ?? colors),
                    secondary: v,
                  },
                })),
              )}`
        }
      </div>
    </div>`;
  }

  private colorInput(
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) {
    return html`<label class="flex items-center gap-2 text-sm text-white/80">
      <input
        type="color"
        class="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
        .value=${value}
        ?disabled=${!this.unlocked}
        @input=${(e: Event) => onChange((e.target as HTMLInputElement).value)}
      />
      ${label}
    </label>`;
  }

  // -- Drawing a pattern ----------------------------------------------------

  private patternInk(): { primary: string; secondary: string } {
    const c = this.perks.patternColors;
    return {
      primary: c?.primary ?? OWN_PRIMARY,
      secondary: c?.secondary ?? OWN_SECONDARY,
    };
  }

  /** Inline style tiling the drawn pattern; `px` is screen pixels per tile. */
  private tileStyle(p: DrawnPattern, px: number): string {
    const { primary, secondary } = this.patternInk();
    const size = px * (1 << p.scale);
    return `background-image:url(${tileDataUrl(p.grid, primary, secondary)});background-size:${p.grid.width * size}px ${p.grid.height * size}px;image-rendering:pixelated;`;
  }

  private editor(): PixelEditor | null {
    return this.querySelector<PixelEditor>("pixel-editor");
  }

  private setPatternGrid(grid: Grid) {
    this.patternDraft = { ...this.patternDraft, grid };
  }

  private renderPatternEditor() {
    const p = this.patternDraft;
    const ink = this.patternInk();
    const saved =
      this.perks.pattern === "custom" &&
      this.perks.customPattern === encodeDrawnPattern(p);
    const tools: { id: "pen" | "eraser" | "fill"; label: string }[] = [
      { id: "pen", label: `✏️ ${t("tool_pen")}` },
      { id: "eraser", label: `🧽 ${t("tool_eraser")}` },
      { id: "fill", label: `🪣 ${t("tool_fill")}` },
    ];
    return html`<div class="steam-perks-editor rounded-xl border p-3 space-y-3">
      <div class="flex flex-wrap items-center gap-1.5">
        ${tools.map(
          (tool) =>
            html`<button
              type="button"
              class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs ${this.patternTool === tool.id ? "is-active" : ""}"
              @click=${() => (this.patternTool = tool.id)}
            >
              ${tool.label}
            </button>`,
        )}
        <span class="mx-1 h-5 w-px bg-white/15"></span>
        <button
          type="button"
          class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs"
          @click=${() => this.editor()?.undo()}
        >
          ↶ ${t("tool_undo")}
        </button>
        <button
          type="button"
          class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs"
          @click=${() => {
            this.editor()?.remember();
            const g = cloneGrid(p.grid);
            g.cells = g.cells.map((v) => 1 - v);
            this.setPatternGrid(g);
          }}
        >
          ◐ ${t("tool_invert")}
        </button>
        <button
          type="button"
          class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs"
          @click=${() => {
            this.editor()?.remember();
            this.setPatternGrid(emptyGrid(p.grid.width, p.grid.height));
          }}
        >
          🗑 ${t("tool_clear")}
        </button>
        ${this.pictureButton((file) => this.importPatternPicture(file))}
      </div>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <pixel-editor
          .grid=${p.grid}
          .colors=${[ink.primary, ink.secondary]}
          .value=${this.patternTool === "eraser" ? 0 : 1}
          .tool=${this.patternTool === "fill" ? "fill" : "pen"}
          @grid-change=${(e: CustomEvent<Grid>) => this.setPatternGrid(e.detail)}
        ></pixel-editor>
        <div class="space-y-3">
          <div>
            <div class="mb-1 text-xs text-white/60">${t("preview")}</div>
            <div
              class="h-36 w-full rounded-md border border-white/15"
              style=${this.tileStyle(p, 2)}
            ></div>
          </div>
          <div>
            <div class="mb-1 text-xs text-white/60">${t("grid_size")}</div>
            <div class="flex flex-wrap gap-1">
              ${PATTERN_SIZES.map(
                (n) =>
                  html`<button
                    type="button"
                    class="steam-perks-chip rounded-md border px-2 py-0.5 text-xs ${p.grid.width === n ? "is-active" : ""}"
                    @click=${() => {
                      this.editor()?.remember();
                      this.setPatternGrid(resizeGrid(p.grid, n, n));
                    }}
                  >
                    ${n}
                  </button>`,
              )}
            </div>
          </div>
          <div>
            <div class="mb-1 text-xs text-white/60">${t("tile_size")}</div>
            <div class="flex flex-wrap gap-1">
              ${PATTERN_SCALES.map(
                (sc) =>
                  html`<button
                    type="button"
                    class="steam-perks-chip rounded-md border px-2 py-0.5 text-xs ${p.scale === sc ? "is-active" : ""}"
                    @click=${() =>
                      (this.patternDraft = { ...this.patternDraft, scale: sc })}
                  >
                    ${t(`tile_scale.${sc}`)}
                  </button>`,
              )}
            </div>
          </div>
          <button
            type="button"
            class="steam-perks-primary w-full rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
            ?disabled=${!this.unlocked || saved}
            @click=${() =>
              this.change((s) => ({
                ...s,
                pattern: "custom",
                customPattern: encodeDrawnPattern(this.patternDraft),
              }))}
          >
            ${saved ? `✓ ${t("flag_in_use")}` : t("pattern_use")}
          </button>
        </div>
      </div>
    </div>`;
  }

  private pictureButton(onFile: (file: File) => void) {
    return html`<label
      class="steam-perks-chip cursor-pointer rounded-md border px-2.5 py-1 text-xs"
    >
      🖼 ${t("tool_picture")}
      <input
        type="file"
        accept="image/*"
        class="hidden"
        @change=${(e: Event) => {
          const input = e.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = "";
          if (file !== undefined) onFile(file);
        }}
      />
    </label>`;
  }

  private async importPatternPicture(file: File) {
    const { width, height } = this.patternDraft.grid;
    try {
      const pixels = await pictureToPixels(file, width, height);
      this.editor()?.remember();
      this.setPatternGrid(imageToPatternGrid(pixels, width, height));
    } catch (e) {
      console.warn("Could not read the picture", e);
    }
  }

  private async importFlagPicture(file: File) {
    try {
      const pixels = await pictureToPixels(file, FLAG_GRID_W, FLAG_GRID_H);
      const flag = imageToFlag(pixels, FLAG_GRID_W, FLAG_GRID_H);
      // The palette changes with the picture, so earlier strokes can't be
      // undone onto it.
      this.editor()?.resetHistory();
      this.flagPalette = [...flag.palette];
      this.flagGrid = flagToGrid(flag);
    } catch (e) {
      console.warn("Could not read the picture", e);
    }
  }

  // -- Banner maker ---------------------------------------------------------

  private setDraft(patch: Partial<FlagDesign>) {
    this.draft = { ...this.draft, ...patch };
  }

  private renderFlag() {
    const modes: ("builder" | "draw")[] = ["builder", "draw"];
    return html`<div class="space-y-4">
      <div class="flex gap-1.5">
        ${modes.map(
          (m) =>
            html`<button
              type="button"
              class="steam-perks-chip rounded-md border px-3 py-1 text-sm ${this.flagMode === m ? "is-active" : ""}"
              @click=${() => (this.flagMode = m)}
            >
              ${m === "builder" ? `🧩 ${t("flag_mode_builder")}` : `✏️ ${t("draw_own")}`}
            </button>`,
        )}
      </div>
      ${this.flagMode === "builder" ? this.renderFlagBuilder() : this.renderFlagDrawing()}
    </div>`;
  }

  private clearFlagButton() {
    if (this.perks.flag === null && !this.perks.useDrawnFlag) return nothing;
    return html`<button
      type="button"
      class="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:text-white"
      ?disabled=${!this.unlocked}
      @click=${() => this.change((s) => ({ ...s, flag: null, useDrawnFlag: false }))}
    >
      ${t("flag_clear")}
    </button>`;
  }

  private renderFlagDrawing() {
    const flag = gridToFlag(this.flagGrid, this.flagPalette);
    const inUse =
      this.perks.useDrawnFlag &&
      JSON.stringify(this.perks.drawnFlag) === JSON.stringify(flag);
    return html`<div class="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs ${this.flagTool === "pen" ? "is-active" : ""}"
            @click=${() => (this.flagTool = "pen")}
          >
            ✏️ ${t("tool_pen")}
          </button>
          <button
            type="button"
            class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs ${this.flagTool === "fill" ? "is-active" : ""}"
            @click=${() => (this.flagTool = "fill")}
          >
            🪣 ${t("tool_fill")}
          </button>
          <button
            type="button"
            class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs"
            @click=${() => this.editor()?.undo()}
          >
            ↶ ${t("tool_undo")}
          </button>
          <button
            type="button"
            class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs"
            @click=${() => {
              this.editor()?.remember();
              this.flagGrid = emptyGrid(FLAG_GRID_W, FLAG_GRID_H, this.flagColor);
            }}
          >
            🗑 ${t("tool_clear")}
          </button>
          ${this.pictureButton((file) => this.importFlagPicture(file))}
        </div>
        <pixel-editor
          .grid=${this.flagGrid}
          .colors=${this.flagPalette}
          .value=${this.flagColor}
          .tool=${this.flagTool}
          @grid-change=${(e: CustomEvent<Grid>) => (this.flagGrid = e.detail)}
        ></pixel-editor>
        <div>
          <div class="mb-1 text-xs text-white/60">${t("palette")}</div>
          <div class="flex flex-wrap gap-1.5">
            ${this.flagPalette.map(
              (c, i) =>
                html`<span
                  class="steam-perks-swatch relative rounded-md border-2 ${this.flagColor === i ? "is-active" : ""}"
                >
                  <button
                    type="button"
                    class="block h-8 w-8 rounded"
                    style="background:${c}"
                    aria-label=${c}
                    @click=${() => (this.flagColor = i)}
                  ></button>
                  <input
                    type="color"
                    class="absolute -bottom-1 -right-1 h-4 w-4 cursor-pointer opacity-80"
                    .value=${c}
                    title=${t("palette_edit")}
                    @input=${(e: Event) => {
                      const next = [...this.flagPalette];
                      next[i] = (e.target as HTMLInputElement).value;
                      this.flagPalette = next;
                    }}
                  />
                </span>`,
            )}
          </div>
        </div>
      </div>
      <div class="space-y-3">
        <img
          src=${drawnFlagDataUrl(flag)}
          alt=""
          class="w-full rounded-md border border-white/20 shadow-lg [image-rendering:pixelated]"
        />
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="steam-perks-primary flex-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
            ?disabled=${!this.unlocked || inUse}
            @click=${() =>
              this.change((s) => ({ ...s, drawnFlag: flag, useDrawnFlag: true }))}
          >
            ${inUse ? `✓ ${t("flag_in_use")}` : t("flag_use")}
          </button>
          ${this.clearFlagButton()}
        </div>
        <p class="text-xs text-white/50">${t("flag_scenario_note")}</p>
      </div>
    </div>`;
  }

  private renderFlagBuilder() {
    const d = this.draft;
    const inUse =
      !this.perks.useDrawnFlag &&
      this.perks.flag !== null &&
      JSON.stringify(this.perks.flag) === JSON.stringify(d);
    return html`<div class="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div class="space-y-3">
        <img
          src=${flagDataUrl(d)}
          alt=""
          class="w-full rounded-md border border-white/20 shadow-lg"
        />
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="steam-perks-primary flex-1 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
            ?disabled=${!this.unlocked || inUse}
            @click=${() =>
              this.change((s) => ({ ...s, flag: d, useDrawnFlag: false }))}
          >
            ${inUse ? `✓ ${t("flag_in_use")}` : t("flag_use")}
          </button>
          ${this.clearFlagButton()}
        </div>
        <p class="text-xs text-white/50">${t("flag_scenario_note")}</p>
      </div>
      <div class="space-y-4">
        ${this.choiceRow(t("flag_layout"), FLAG_LAYOUTS, d.layout, (v) =>
          this.setDraft({ layout: v }),
        "layout")}
        <div class="flex flex-wrap gap-4">
          ${this.draftColor(t("flag_field"), d.field, (v) => this.setDraft({ field: v }))}
          ${this.draftColor(t("flag_accent"), d.accent, (v) =>
            this.setDraft({ accent: v }),
          )}
        </div>
        ${this.choiceRow(t("flag_emblem"), FLAG_EMBLEMS, d.emblem, (v) =>
          this.setDraft({ emblem: v }),
        "emblem")}
        ${this.draftColor(t("flag_emblem_color"), d.emblemColor, (v) =>
          this.setDraft({ emblemColor: v }),
        )}
        <label class="block text-sm text-white/80">
          <span class="block mb-1">${t("flag_glyph")}</span>
          <input
            type="text"
            class="w-20 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-center text-2xl text-white"
            .value=${d.glyph}
            maxlength="4"
            @input=${(e: Event) => {
              const input = e.target as HTMLInputElement;
              const glyph = singleGlyph(input.value);
              input.value = glyph;
              this.setDraft({ glyph });
            }}
          />
          <span class="block mt-1 text-xs text-white/50"
            >${t("flag_glyph_hint")}</span
          >
        </label>
      </div>
    </div>`;
  }

  private choiceRow<T extends string>(
    label: string,
    values: readonly T[],
    current: T,
    pick: (v: T) => void,
    group: "layout" | "emblem",
  ) {
    return html`<div>
      <div class="mb-1 text-sm text-white/80">${label}</div>
      <div class="flex flex-wrap gap-1.5">
        ${values.map(
          (v) =>
            html`<button
              type="button"
              class="steam-perks-chip rounded-md border px-2.5 py-1 text-xs ${current === v ? "is-active" : ""}"
              aria-pressed=${current === v}
              @click=${() => pick(v)}
            >
              ${t(`${group}.${v}`)}
            </button>`,
        )}
      </div>
    </div>`;
  }

  private draftColor(label: string, value: string, set: (v: string) => void) {
    return html`<label class="flex items-center gap-2 text-sm text-white/80">
      <input
        type="color"
        class="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent"
        .value=${value}
        @input=${(e: Event) => set((e.target as HTMLInputElement).value)}
      />
      ${label}
    </label>`;
  }

  // -- Titles ---------------------------------------------------------------

  private renderTitles() {
    const p = this.perks.progress;
    const chosen = this.perks.title;
    return html`<div class="space-y-2">
      <p class="text-xs text-white/60">${t("title_hint")}</p>
      <button
        type="button"
        class="steam-perks-option w-full rounded-lg border px-3 py-2 text-left text-sm text-white/90 ${chosen === null ? "is-active" : ""}"
        ?disabled=${!this.unlocked}
        @click=${() => this.change((s) => ({ ...s, title: null }))}
      >
        ${t("title_none")}
      </button>
      ${ACHIEVEMENTS.map((a) => {
        const { value, target } = a.progress(p);
        const earned = isUnlocked(a.id, p);
        return html`<button
          type="button"
          class="steam-perks-option w-full rounded-lg border px-3 py-2 text-left flex items-center gap-3 ${chosen === a.id && earned ? "is-active" : ""} ${earned ? "" : "opacity-60"}"
          ?disabled=${!this.unlocked || !earned}
          @click=${() => this.change((s) => ({ ...s, title: a.id }))}
        >
          <span
            class="steam-perks-title-tag shrink-0 rounded px-2 py-0.5 font-bold"
            >[${titleTagText(a.id)}]</span
          >
          <span class="min-w-0 flex-1 text-sm text-white/80"
            >${t(`achievement.${a.id}`)}</span
          >
          <span class="shrink-0 text-xs tabular-nums text-white/60"
            >${earned ? "✓" : `${value}/${target}`}</span
          >
        </button>`;
      })}
    </div>`;
  }
}
