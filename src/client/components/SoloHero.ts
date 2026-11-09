import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import type { GameModeSelector } from "../GameModeSelector";
import { translateText } from "../Utils";

/**
 * The home screen's top card: play alone against the AI. Opens the
 * singleplayer setup (Scenario or Free mode). Multiplayer lobbies sit below
 * the name row.
 */
@customElement("solo-hero")
export class SoloHero extends LitElement {
  createRenderRoot() {
    return this;
  }

  // Goes through the mode selector so the username is checked first, as
  // for every other way into a game.
  private open() {
    (
      document.querySelector("game-mode-selector") as GameModeSelector | null
    )?.openSinglePlayerModal({ mode: "scenario" });
  }

  render() {
    return html`<button
      type="button"
      class="solo-hero group w-full text-left rounded-xl border p-4 sm:p-5 flex items-center gap-4 transition-all active:scale-[0.99]"
      @click=${() => this.open()}
    >
      <span
        class="solo-seal shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-3xl font-bold"
        aria-hidden="true"
        >獨</span
      >
      <span class="min-w-0 flex-1">
        <span class="block text-2xl sm:text-3xl font-bold text-white">
          ${translateText("main.solo")}
        </span>
        <span class="block text-xs sm:text-sm text-white/70 mt-1">
          ${translateText("main.solo_desc")}
        </span>
      </span>
      <span
        class="shrink-0 text-3xl text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all"
        aria-hidden="true"
        >›</span
      >
    </button>`;
  }
}
