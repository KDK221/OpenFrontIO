import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { translateText } from "../Utils";

export type PlayMode = "scenario" | "free";

/**
 * A playable faction of a scenario map: its banner id and its capital, the
 * one city the player starts from (the faction's first city in the
 * manifest).
 */
export interface FactionOption {
  id: string;
  capital: string;
}

/** The map's factions in manifest order, each with its capital. */
export function factionsOf(
  nations: readonly { flag?: string | null; name: string }[],
): FactionOption[] {
  const capitals = new Map<string, string>();
  for (const n of nations) {
    if (!n.flag || capitals.has(n.flag)) continue;
    capitals.set(n.flag, n.name);
  }
  return [...capitals].map(([id, capital]) => ({ id, capital }));
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
            active ? "bg-malibu-blue/40 text-white" : "bg-black/30 text-white/70"
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

  private renderFaction(f: FactionOption): TemplateResult {
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

  render() {
    return html`<section class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>
      ${
        this.mode === "scenario"
          ? html`<div>
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
                      class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"
                    >
                      ${this.factions.map((f) => this.renderFaction(f))}
                    </div>`
              }
            </div>`
          : nothing
      }
    </section>`;
  }
}
