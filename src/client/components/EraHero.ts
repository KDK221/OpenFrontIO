import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import { html, LitElement, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { whenModalLoaded } from "../LazyModals";
import type { SinglePlayerModal } from "../SinglePlayerModal";
import { terrainMapFileLoader } from "../TerrainMapFileLoader";
import { translateText } from "../Utils";

interface Era {
  map: GameMapType;
  key: string;
  seal: string;
}

// One card per scenario map, in the order history runs on the home screen.
const ERAS: Era[] = [
  { map: GameMapType.WarringStates, key: "warring_states", seal: "秦" },
  { map: GameMapType.Samguk, key: "samguk", seal: "麗" },
  { map: GameMapType.Sengoku, key: "sengoku", seal: "武" },
];

/**
 * The home screen's centrepiece: the game's title and one card per era.
 * Each card opens the singleplayer setup on that map, in Scenario or Free
 * mode.
 */
@customElement("era-hero")
export class EraHero extends LitElement {
  createRenderRoot() {
    return this;
  }

  private start(map: GameMapType, mode: "scenario" | "free") {
    whenModalLoaded("single-player-modal", () =>
      (
        document.querySelector("single-player-modal") as SinglePlayerModal
      )?.open({ map, mode }),
    );
  }

  private renderEra(era: Era): TemplateResult {
    const thumb = terrainMapFileLoader.getMapData(era.map).webpPath;
    return html`<article
      class="era-card group relative overflow-hidden rounded-xl border border-white/10 bg-black/40 min-h-[13rem] flex flex-col justify-end"
    >
      <img
        src=${thumb}
        alt=""
        draggable="false"
        class="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-300"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
      ></div>
      <span
        class="era-seal absolute top-3 right-3 w-11 h-11 rounded-md flex items-center justify-center text-2xl font-bold"
        aria-hidden="true"
        >${era.seal}</span
      >
      <div class="relative p-4 space-y-2">
        <div class="text-[11px] tracking-widest uppercase text-white/60">
          ${translateText(`era_hero.${era.key}_years`)}
        </div>
        <h3 class="text-xl font-bold text-white leading-tight">
          ${translateText(`era_hero.${era.key}_name`)}
        </h3>
        <p class="text-xs text-white/70 leading-snug">
          ${translateText(`era_hero.${era.key}_desc`)}
        </p>
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="era-primary flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all active:scale-95"
            @click=${() => this.start(era.map, "scenario")}
          >
            ${translateText("play_mode.scenario")}
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg px-3 py-2 text-sm font-bold text-white/80 border border-white/20 hover:bg-white/10 transition-all active:scale-95"
            @click=${() => this.start(era.map, "free")}
          >
            ${translateText("play_mode.free")}
          </button>
        </div>
      </div>
    </article>`;
  }

  render() {
    return html`<section class="era-hero space-y-4">
      <header class="flex items-end gap-4 px-1">
        <span class="brand-title text-5xl sm:text-6xl leading-none"
          >${translateText("main.brand_name")}</span
        >
        <p class="text-sm text-white/70 pb-1 max-w-md">
          ${translateText("era_hero.tagline")}
        </p>
      </header>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${ERAS.map((era) => this.renderEra(era))}
      </div>
    </section>`;
  }
}
