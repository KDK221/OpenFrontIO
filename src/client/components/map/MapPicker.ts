import {
  DEFAULT_MAP,
  Difficulty,
  freeModeMaps,
  GameMapType,
  listedMaps,
  MapCategory,
  mapCategoryOrder,
  MapInfo,
  maps,
} from "@openfront/engine-api/game/GameTypes";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { translateText } from "../../Utils";
import "./MapDisplay";
import { getFavoriteMaps, starIcon, toggleFavoriteMap } from "./MapFavorites";

const byRank = (a: MapInfo, b: MapInfo) =>
  (a.featuredRank ?? Number.MAX_SAFE_INTEGER) -
  (b.featuredRank ?? Number.MAX_SAFE_INTEGER);

// Scenario mode: only the historical scenario maps (see SCENARIO_MAPS), in
// rank order, with no tabs.
const scenarioMaps: MapInfo[] = [...listedMaps].sort(byRank);

// Free mode: every map, browsed like OpenFront's picker. The scenario maps
// lead the featured tab, then OpenFront's own featured maps.
const freeFeatured: MapInfo[] = [
  ...scenarioMaps,
  ...freeModeMaps
    .filter((m) => m.categories.includes("featured") && !scenarioMaps.includes(m))
    .sort(byRank),
];

// Asia first: the game is set there, so its maps are the ones people look for.
const freeCategories: MapCategory[] = [
  "asia",
  ...mapCategoryOrder.filter((c) => c !== "featured" && c !== "asia"),
].filter((c) => freeModeMaps.some((m) => m.categories.includes(c)));

function mapsInCategory(category: MapCategory): MapInfo[] {
  return freeModeMaps
    .filter((m) => m.categories.includes(category))
    .sort((a, b) =>
      translateText(a.translationKey).localeCompare(
        translateText(b.translationKey),
      ),
    );
}

type MapTab = "featured" | "all" | "favorites";

@customElement("map-picker")
export class MapPicker extends LitElement {
  @property({ type: String }) selectedMap: GameMapType = DEFAULT_MAP;
  @property({ type: Boolean }) useRandomMap = false;
  @property({ type: Boolean }) showMedals = false;
  // Free mode offers every map, grouped by region; otherwise only the
  // scenario maps are shown.
  @property({ type: Boolean }) allMaps = false;
  // Kept so existing callers can still pass them.
  @property({ type: Boolean }) randomMapDivider = false;
  @property({ type: String }) searchQuery = "";
  @property({ attribute: false }) mapWins: Map<GameMapType, Set<Difficulty>> =
    new Map();
  @property({ attribute: false }) onSelectMap?: (map: GameMapType) => void;
  @property({ attribute: false }) onSelectRandom?: () => void;
  @state() private activeTab: MapTab = "featured";
  // Asia starts open: it is where most of this game's maps are.
  @state() private expandedCategories: Set<string> = new Set(["asia"]);
  @state() private favorites: GameMapType[] = getFavoriteMaps();

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
          .selected=${!this.useRandomMap && this.selectedMap === map.type}
          .showMedals=${this.showMedals}
          .wins=${this.mapWins?.get(map.type) ?? new Set()}
          .favorite=${this.allMaps && this.favorites.includes(map.type)}
          .onToggleFavorite=${
            this.allMaps
              ? () => (this.favorites = toggleFavoriteMap(map.type))
              : undefined
          }
          .translation=${translateText(map.translationKey)}
        ></map-display>
      </div>
    `;
  }

  private renderMapGrid(mapList: MapInfo[]) {
    // Keyed so cards keep their identity (and thumbnails) when lists shift.
    return html`<div
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      ${repeat(
        mapList,
        (map) => map.id,
        (map) => this.renderMapCard(map),
      )}
    </div>`;
  }

  private toggleCategory(category: string) {
    const expanded = new Set(this.expandedCategories);
    if (expanded.has(category)) expanded.delete(category);
    else expanded.add(category);
    this.expandedCategories = expanded;
  }

  private renderCategoryBar(category: MapCategory) {
    const mapList = mapsInCategory(category);
    const expanded = this.expandedCategories.has(category);
    return html`<div class="w-full">
      <button
        type="button"
        aria-expanded=${expanded}
        @click=${() => this.toggleCategory(category)}
        class="map-category-bar w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all duration-200 active:scale-[0.99] ${
          expanded
            ? "is-open bg-malibu-blue/20 border-malibu-blue/50"
            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
        }"
      >
        <span
          class="flex items-center gap-3 text-sm font-bold text-white uppercase tracking-wider"
        >
          <svg
            class="w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-90" : ""
            }"
            viewBox="0 0 12 12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M4 2l5 4-5 4z" />
          </svg>
          ${translateText(`map_categories.${category}`)}
        </span>
        <span class="text-xs font-bold text-white/40">${mapList.length}</span>
      </button>
      ${
        expanded
          ? html`<div class="mt-4">${this.renderMapGrid(mapList)}</div>`
          : null
      }
    </div>`;
  }

  private renderFeaturedTab() {
    // Keep the selected map in view even when it isn't a featured one.
    const selected = maps.find((m) => m.type === this.selectedMap);
    const list =
      selected !== undefined && !freeFeatured.includes(selected)
        ? [selected, ...freeFeatured]
        : freeFeatured;
    return this.renderMapGrid(list);
  }

  private renderFavoritesTab() {
    if (this.favorites.length === 0) {
      return html`<div
        class="w-full flex flex-col items-center justify-center gap-3 py-12 px-4 text-center rounded-xl border border-dashed border-white/10 bg-black/20"
      >
        <div class="text-white/30">${starIcon(false, "w-8 h-8")}</div>
        <p class="text-sm text-white/50 leading-relaxed max-w-xs">
          ${translateText("map_component.favorites_empty")}
        </p>
      </div>`;
    }
    return this.renderMapGrid(
      this.favorites
        .map((f) => freeModeMaps.find((m) => m.type === f))
        .filter((m) => m !== undefined),
    );
  }

  private renderTabButton(tab: MapTab, label: string) {
    const isActive = this.activeTab === tab;
    return html`<button
      type="button"
      role="tab"
      aria-selected=${isActive}
      class="map-tab min-w-0 truncate px-1 sm:px-3 py-2 rounded-lg text-xs font-bold uppercase sm:tracking-wider transition-all active:scale-95 ${
        isActive
          ? "is-active bg-malibu-blue/20 text-white"
          : "text-white/60 hover:text-white"
      }"
      @click=${() => (this.activeTab = tab)}
    >
      ${label}
    </button>`;
  }

  private renderAllMaps() {
    return html`<div class="space-y-6">
      <div
        role="tablist"
        aria-label=${translateText("map.map")}
        class="grid grid-cols-3 gap-1 sm:gap-2 rounded-xl border border-white/10 bg-black/20 p-1"
      >
        ${this.renderTabButton("featured", translateText("map.featured"))}
        ${this.renderTabButton("all", translateText("map.all"))}
        ${this.renderTabButton("favorites", translateText("map.favorites"))}
      </div>
      ${
        this.activeTab === "all"
          ? html`<div class="space-y-3">
              ${freeCategories.map((c) => this.renderCategoryBar(c))}
            </div>`
          : this.activeTab === "favorites"
            ? this.renderFavoritesTab()
            : this.renderFeaturedTab()
      }
    </div>`;
  }

  render() {
    if (this.allMaps) return this.renderAllMaps();
    return html`<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      ${repeat(
        scenarioMaps,
        (map) => map.id,
        (map) => this.renderMapCard(map),
      )}
    </div>`;
  }
}
