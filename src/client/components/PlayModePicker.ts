import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../Utils";
import "./scenario-factions.css";
import { chineseRulers } from "./ChineseRulers";
import { japaneseRulers } from "./JapaneseRulers";

export type PlayMode = "scenario" | "free";

/**
 * A playable faction of a scenario map: its banner id and its capital, the
 * one city the player starts from (the faction's first city in the
 * manifest).
 */
export interface FactionOption {
  id: string;
  capital: string;
  location?: {
    x: number;
    y: number;
    width: number;
    height: number;
    image: string;
  };
}

const koreanRulers: Record<
  string,
  { portrait: string; name: string; kind: string }
> = {
  Goguryeo: {
    portrait: "gwanggaeto",
    name: "gwanggaeto",
    kind: "representative",
  },
  Baekje: { portrait: "geunchogo", name: "geunchogo", kind: "representative" },
  Silla: { portrait: "jinheung", name: "jinheung", kind: "representative" },
  Gaya: { portrait: "haji", name: "haji", kind: "representative" },
  Tamna: { portrait: "yuridora", name: "yuridora", kind: "representative" },
  Wa: { portrait: "iwai", name: "iwai", kind: "regional" },
  NorthernWei: { portrait: "taiwu", name: "taiwu", kind: "representative" },
  Balhae: {
    portrait: "daejoyeong",
    name: "daejoyeong",
    kind: "representative",
  },
};

const scenarioRulers = {
  ...Object.fromEntries(
    Object.entries(koreanRulers).map(([id, ruler]) => [
      id,
      { ...ruler, portrait: `korea/${ruler.portrait}` },
    ]),
  ),
  ...japaneseRulers,
  ...chineseRulers,
};

/** The map's factions in manifest order, each with its capital. */
export function factionsOf(
  nations: readonly {
    flag?: string | null;
    name: string;
    coordinates?: readonly number[];
  }[],
  map?: { width: number; height: number; image: string },
): FactionOption[] {
  const capitals = new Map<string, FactionOption>();
  for (const n of nations) {
    if (!n.flag || capitals.has(n.flag)) continue;
    const faction: FactionOption = { id: n.flag, capital: n.name };
    if (map && map.width > 0 && map.height > 0 && n.coordinates?.length === 2) {
      const [x, y] = n.coordinates;
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        x >= 0 &&
        x < map.width &&
        y >= 0 &&
        y < map.height
      ) {
        faction.location = { ...map, x, y };
      }
    }
    capitals.set(n.flag, faction);
  }
  return [...capitals.values()];
}

/** A capital's display name, falling back to the manifest's name. */
function capitalName(name: string): string {
  const key = `capital.${name}`;
  const text = translateText(key);
  return text === key ? name : text;
}

/** The faction's display name, falling back to its id. */
export function factionName(id: string): string {
  const key = `faction.${id}`;
  const name = translateText(key);
  return name === key ? id : name;
}

/**
 * Picks how a game starts: Scenario (play one of the map's historical
 * factions from its real cities) or Free (start anywhere you like).
 */
@customElement("play-mode-picker")
export class PlayModePicker extends LitElement {
  @property({ type: String }) mode: PlayMode = "scenario";
  @property({ attribute: false }) factions: FactionOption[] = [];
  @property({ type: String }) selectedFaction: string | null = null;
  // Which part to show: the two mode cards, or the faction grid (shown
  // under the map picker, since the factions depend on the map).
  @property({ type: String }) pickerSection: "modes" | "factions" = "modes";

  createRenderRoot() {
    return this;
  }

  private emit(name: string, detail: object) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }

  private renderModeCard(
    mode: PlayMode,
    glyph: string,
    titleKey: string,
    descKey: string,
  ): TemplateResult {
    const active = this.mode === mode;
    return html`<button
      type="button"
      aria-pressed=${active}
      class="play-mode-card text-left rounded-xl border p-4 transition-all duration-200 active:scale-[0.98] ${
        active
          ? "bg-malibu-blue/20 border-malibu-blue/60 shadow-[var(--shadow-malibu-blue)]"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }"
      @click=${() => this.emit("play-mode-selected", { mode })}
    >
      <div class="flex items-center gap-3">
        <span
          class="play-mode-glyph shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold ${
            active
              ? "bg-malibu-blue/40 text-white"
              : "bg-black/30 text-white/70"
          }"
          aria-hidden="true"
          >${glyph}</span
        >
        <div class="min-w-0">
          <div class="text-base font-bold text-white">
            ${translateText(titleKey)}
          </div>
          <div class="text-xs text-white/60 leading-snug mt-1">
            ${translateText(descKey)}
          </div>
        </div>
      </div>
    </button>`;
  }

  private renderPortraitFaction(f: FactionOption): TemplateResult {
    const ruler = scenarioRulers[f.id];
    const active = this.selectedFaction === f.id;
    const loc = f.location;
    return html`<button
      type="button"
      class="korean-faction-card"
      aria-pressed=${active}
      aria-label=${`${factionName(f.id)} · ${translateText(`scenario_rulers.${ruler.name}`)} · ${capitalName(f.capital)}`}
      @click=${() => this.emit("faction-selected", { faction: f.id })}
    >
      <span class="korean-faction-art">
        <img
          class="korean-ruler-portrait"
          src=${assetUrl(`images/rulers/${ruler.portrait}.webp`)}
          alt=""
          draggable="false"
          loading="lazy"
          decoding="async"
        />
        <span class="korean-faction-heading">
          <img
            class="korean-faction-emblem"
            src=${assetUrl(`flags/${f.id}.svg`)}
            alt=""
          />
          <span>${factionName(f.id)}</span>
          ${active ? html`<span class="korean-faction-check" aria-hidden="true">✓</span>` : nothing}
        </span>
      </span>
      <span class="korean-faction-details">
        <span class="korean-ruler-copy">
          <span class="korean-ruler-kind"
            >${translateText(`scenario_rulers.${ruler.kind}`)}</span
          >
          <span class="korean-ruler-name"
            >${translateText(`scenario_rulers.${ruler.name}`)}</span
          >
          <span class="korean-start-label"
            >${translateText("scenario_rulers.start")}</span
          >
          <span class="korean-start-name">${capitalName(f.capital)}</span>
        </span>
        ${
          loc
            ? html`<svg
                class="korean-start-map"
                viewBox=${`-100 -100 ${loc.width + 200} ${loc.height + 200}`}
                role="img"
                aria-label=${translateText("scenario_rulers.location", { name: capitalName(f.capital) })}
              >
                <image
                  href=${loc.image}
                  width=${loc.width}
                  height=${loc.height}
                />
                <circle
                  cx=${loc.x}
                  cy=${loc.y}
                  r="90"
                  fill="#ef233c"
                  fill-opacity="0.25"
                  stroke="#ff5267"
                  stroke-width="12"
                />
                <circle
                  class="korean-start-marker"
                  cx=${loc.x}
                  cy=${loc.y}
                  r="45"
                  fill="#ef233c"
                  stroke="#ffffff"
                  stroke-width="20"
                />
              </svg>`
            : nothing
        }
      </span>
    </button>`;
  }

  private renderFaction(f: FactionOption): TemplateResult {
    if (scenarioRulers[f.id]) return this.renderPortraitFaction(f);
    const active = this.selectedFaction === f.id;
    return html`<button
      type="button"
      aria-pressed=${active}
      title=${factionName(f.id)}
      class="flex flex-col items-center gap-2 rounded-xl border p-2 transition-all duration-200 active:scale-95 ${
        active
          ? "bg-malibu-blue/20 border-malibu-blue/60"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }"
      @click=${() => this.emit("faction-selected", { faction: f.id })}
    >
      <img
        src=${assetUrl(`flags/${f.id}.svg`)}
        alt=""
        draggable="false"
        class="w-full aspect-[3/2] object-cover rounded-md"
      />
      <span
        class="text-xs font-bold text-white text-center leading-tight break-words"
        >${factionName(f.id)}</span
      >
      <span class="text-[10px] text-white/50"
        >${translateText("play_mode.capital", {
          name: capitalName(f.capital),
        })}</span
      >
    </button>`;
  }

  private renderFactions(): TemplateResult {
    return html`<section>
      <h4
        class="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 pl-1"
      >
        ${translateText("play_mode.choose_faction")}
      </h4>
      ${
        this.factions.length === 0
          ? html`<p class="text-sm text-white/50 pl-1">
              ${translateText("play_mode.loading_factions")}
            </p>`
          : html`<div
              class=${this.factions.every((f) => scenarioRulers[f.id]) ? "korean-faction-grid" : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"}
            >
              ${this.factions.map((f) => this.renderFaction(f))}
            </div>`
      }
      ${this.factions.some((f) => scenarioRulers[f.id]) ? html`<p class="korean-faction-note">${translateText("scenario_rulers.note")}</p>` : nothing}
    </section>`;
  }

  render() {
    if (this.pickerSection === "factions") {
      return this.mode === "scenario" ? this.renderFactions() : nothing;
    }
    return html`<section class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      ${this.renderModeCard(
        "scenario",
        "史",
        "play_mode.scenario",
        "play_mode.scenario_desc",
      )}
      ${this.renderModeCard(
        "free",
        "遊",
        "play_mode.free",
        "play_mode.free_desc",
      )}
    </section>`;
  }
}
