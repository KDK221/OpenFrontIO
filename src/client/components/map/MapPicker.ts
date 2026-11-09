import {
  DEFAULT_MAP,
  Difficulty,
  GameMapType,
  listedMaps,
  MapInfo,
} from "@openfront/engine-api/game/GameTypes";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { translateText } from "../../Utils";
import "./MapDisplay";

// Only the historical scenario maps are listed (see SCENARIO_MAPS), so there
// are no tabs, categories, globe or random pick: just the maps, in rank order.
const scenarioMaps: MapInfo[] = [...listedMaps].sort(
  (a, b) =>
    (a.featuredRank ?? Number.MAX_SAFE_INTEGER) -
    (b.featuredRank ?? Number.MAX_SAFE_INTEGER),
);

@customElement("map-picker")
export class MapPicker extends LitElement {
  @property({ type: String }) selectedMap: GameMapType = DEFAULT_MAP;
  @property({ type: Boolean }) useRandomMap = false;
  @property({ type: Boolean }) showMedals = false;
  // Kept so existing callers can still pass them; there is nothing to divide
  // or search among three maps.
  @property({ type: Boolean }) randomMapDivider = false;
  @property({ type: String }) searchQuery = "";
  @property({ attribute: false }) mapWins: Map<GameMapType, Set<Difficulty>> =
    new Map();
  @property({ attribute: false }) onSelectMap?: (map: GameMapType) => void;
  @property({ attribute: false }) onSelectRandom?: () => void;

  createRenderRoot() {
    return this;
  }

  private renderMapCard(map: MapInfo) {
    return html`
      <div
        @click=${() => this.onSelectMap?.(map.type)}
        class="cursor-pointer"
      >
        <map-display
          .mapKey=${map.id}
          .selected=${this.selectedMap === map.type}
          .showMedals=${this.showMedals}
          .wins=${this.mapWins?.get(map.type) ?? new Set()}
          .translation=${translateText(map.translationKey)}
        ></map-display>
      </div>
    `;
  }

  render() {
    return html`<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      ${repeat(
        scenarioMaps,
        (map) => map.id,
        (map) => this.renderMapCard(map),
      )}
    </div>`;
  }
}
