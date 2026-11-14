import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "./Utils";

/**
 * Tips shown while a game loads, one picked at random each time. Each names
 * a rule the game really has (see help_modal for the long versions), as
 * game_starting_modal.tip_<id> in en.json.
 */
export const START_TIPS = [
  "terrain",
  "golden_lands",
  "town",
  "fortress",
  "harbor",
  "market",
  "fire_attack",
  "catapult",
  "plague",
  "ballista",
  "warship",
  "betrayal",
  "ally_aid",
  "isolated",
] as const;

export function pickStartTip(random: () => number = Math.random): string {
  return START_TIPS[Math.floor(random() * START_TIPS.length) % START_TIPS.length];
}

@customElement("game-starting-modal")
export class GameStartingModal extends LitElement {
  @state()
  isVisible = false;

  @state()
  private tip: string = pickStartTip();

  createRenderRoot() {
    return this;
  }

  render() {
    const isVisible = this.isVisible;
    return html`
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-[4px] z-[9998] transition-all duration-300 ${
          isVisible ? "opacity-100 visible" : "opacity-0 invisible"
        }"
      ></div>
      <div
        class="fixed top-1/2 left-1/2 bg-zinc-900/90 backdrop-blur-md border border-white/10 p-6 rounded-2xl z-[9999] shadow-2xl text-white w-[400px] max-w-[calc(100vw-2rem)] text-center transition-all duration-300 -translate-x-1/2 ${
          isVisible
            ? "opacity-100 visible -translate-y-1/2"
            : "opacity-0 invisible -translate-y-[48%]"
        }"
      >
        <div
          class="text-sm font-medium tracking-wider uppercase text-amber-300/80 mb-2"
        >
          ${translateText("game_starting_modal.tip_label")}
        </div>
        <p class="text-base text-white/80 leading-relaxed mb-5 break-keep">
          ${translateText(`game_starting_modal.tip_${this.tip}`)}
        </p>
        <p
          class="text-xl font-medium tracking-wider text-white bg-white/5 border border-white/10 px-4 py-3 rounded-xl"
        >
          ${translateText("game_starting_modal.title")}
        </p>
      </div>
    `;
  }

  show() {
    this.tip = pickStartTip();
    this.isVisible = true;
    this.requestUpdate();
  }

  hide() {
    this.isVisible = false;
    this.requestUpdate();
  }
}
