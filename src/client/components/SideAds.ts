import { GameEnv } from "@openfront/shared/configuration/Env";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { ADSENSE_CLIENT, adsConfigured, SIDE_AD_SLOTS } from "../AdConfig";
import { ClientEnv } from "../ClientEnv";
import { isDesktopShell } from "../DesktopShell";
import { gamePortal } from "../GamePortal";
import { translateText } from "../Utils";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

type AdState = "loading" | "ready" | "blocked";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let scriptState: Promise<boolean> | null = null;

/**
 * Loads AdSense once. Resolves false when the script can't load, which in
 * practice means an ad blocker stopped it.
 */
function loadAdSense(): Promise<boolean> {
  scriptState ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return scriptState;
}

/**
 * Two vertical ad columns beside the homepage content, on screens wide
 * enough to have room for them (xl and up), hidden in game. With an ad
 * blocker on, each column instead asks the player to allow ads on the site;
 * the game stays playable either way. Not shown on game portals or in the
 * desktop (Steam) build.
 */
@customElement("side-ads")
export class SideAds extends LitElement {
  @state() private adState: AdState = "loading";

  createRenderRoot() {
    return this;
  }

  private get enabled(): boolean {
    return !gamePortal.isOnGamePortal() && !isDesktopShell();
  }

  private get devPlaceholder(): boolean {
    return !adsConfigured() && ClientEnv.env() === GameEnv.Dev;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.enabled || !adsConfigured()) return;
    void loadAdSense().then((ok) => {
      this.adState = ok ? "ready" : "blocked";
    });
  }

  updated() {
    if (this.adState !== "ready") return;
    // Ask AdSense to fill every slot it hasn't filled yet.
    for (const ins of this.querySelectorAll<HTMLElement>(
      "ins.adsbygoogle:not([data-adsbygoogle-status])",
    )) {
      if (ins.dataset.pushed === "1") continue;
      ins.dataset.pushed = "1";
      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      } catch (e) {
        console.warn("AdSense push failed", e);
      }
    }
  }

  private renderSlot(slot: string): TemplateResult {
    if (this.devPlaceholder) {
      return html`<div
        class="w-[160px] h-[600px] rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-xs text-white/40 text-center px-2"
      >
        ${translateText("side_ads.placeholder")}
      </div>`;
    }
    if (this.adState === "blocked") {
      return html`<div
        class="side-ads-blocked w-[160px] rounded-lg border border-white/15 bg-black/40 p-4 text-center space-y-3"
      >
        <div class="text-3xl" aria-hidden="true">🙏</div>
        <div class="text-sm font-bold text-white">
          ${translateText("side_ads.blocked_title")}
        </div>
        <p class="text-xs text-white/70 leading-relaxed">
          ${translateText("side_ads.blocked_body")}
        </p>
      </div>`;
    }
    if (this.adState === "loading" || slot === "") return html``;
    return html`<ins
      class="adsbygoogle"
      style="display:inline-block;width:160px;height:600px"
      data-ad-client=${ADSENSE_CLIENT}
      data-ad-slot=${slot}
    ></ins>`;
  }

  render() {
    if (!this.enabled || (!adsConfigured() && !this.devPlaceholder)) {
      return nothing;
    }
    const column = "hidden xl:flex fixed top-28 z-10 [.in-game_&]:hidden";
    return html`
      <aside class="${column} left-4" aria-label="ad">
        ${this.renderSlot(SIDE_AD_SLOTS.left)}
      </aside>
      <aside class="${column} right-4" aria-label="ad">
        ${this.renderSlot(SIDE_AD_SLOTS.right)}
      </aside>
    `;
  }
}
