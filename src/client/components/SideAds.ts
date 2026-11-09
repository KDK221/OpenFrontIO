import { GameEnv } from "@openfront/shared/configuration/Env";
import { html, LitElement, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  ADSENSE_CLIENT,
  ADSENSE_SLOTS,
  COUPANG,
  SIDE_ADS,
  sideAdReady,
} from "../AdConfig";
import { ClientEnv } from "../ClientEnv";
import { isDesktopShell } from "../DesktopShell";
import { gamePortal } from "../GamePortal";
import { translateText } from "../Utils";

const ADSENSE_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const COUPANG_SRC = "https://ads-partners.coupang.com/g.js";
const COUPANG_BLOCKED_MESSAGE = "side-ads:coupang-blocked";

const AD_WIDTH = 160;
const AD_HEIGHT = 600;

type Side = "left" | "right";
type AdState = "loading" | "ready" | "blocked";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsenseScript: Promise<boolean> | null = null;

/** Loads AdSense once; false when it can't load (an ad blocker, in practice). */
function loadAdSense(): Promise<boolean> {
  adsenseScript ??= new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${ADSENSE_SRC}?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return adsenseScript;
}

/**
 * The Coupang Partners banner as its own little page. Coupang's snippet is
 * written for static pages (it draws where its script tag sits), so it runs
 * as-is inside an iframe instead of in this app's DOM. If its script is
 * blocked, the frame tells the column so it can show the notice.
 */
function coupangDoc(side: Side): string {
  const options = JSON.stringify({
    id: COUPANG.id,
    template: COUPANG.template,
    trackingCode: COUPANG.trackingCode,
    width: String(AD_WIDTH),
    height: String(AD_HEIGHT),
  });
  const blocked = JSON.stringify({ type: COUPANG_BLOCKED_MESSAGE, side });
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script src="${COUPANG_SRC}" onerror='parent.postMessage(${blocked}, "*")'></script><script>try{new PartnersCoupang.G(${options});}catch(e){parent.postMessage(${blocked}, "*");}</script></body></html>`;
}

/**
 * Two vertical ad columns beside the homepage content, on screens wide
 * enough to have room (xl and up), hidden in game. Each column shows the
 * provider set in AdConfig. With an ad blocker on, a column asks the player
 * to allow ads instead; the game stays playable either way. Not shown on
 * game portals or in the desktop (Steam) build.
 */
@customElement("side-ads")
export class SideAds extends LitElement {
  @state() private adState: Record<Side, AdState> = {
    left: "loading",
    right: "loading",
  };

  createRenderRoot() {
    return this;
  }

  private get enabled(): boolean {
    return !gamePortal.isOnGamePortal() && !isDesktopShell();
  }

  private get devPlaceholder(): boolean {
    return ClientEnv.env() === GameEnv.Dev;
  }

  private onMessage = (e: MessageEvent) => {
    const data = e.data as { type?: string; side?: Side } | null;
    if (data?.type !== COUPANG_BLOCKED_MESSAGE) return;
    if (data.side !== "left" && data.side !== "right") return;
    this.setState(data.side, "blocked");
  };

  private setState(side: Side, s: AdState) {
    this.adState = { ...this.adState, [side]: s };
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.enabled) return;
    window.addEventListener("message", this.onMessage);
    for (const side of ["left", "right"] as const) {
      if (!sideAdReady(side)) continue;
      if (SIDE_ADS[side] === "coupang") {
        this.setState(side, "ready");
      } else if (SIDE_ADS[side] === "adsense") {
        void loadAdSense().then((ok) =>
          this.setState(side, ok ? "ready" : "blocked"),
        );
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("message", this.onMessage);
  }

  updated() {
    // Ask AdSense to fill every unit it hasn't filled yet.
    for (const ins of this.querySelectorAll<HTMLElement>(
      "ins.adsbygoogle:not([data-pushed])",
    )) {
      ins.dataset.pushed = "1";
      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      } catch (e) {
        console.warn("AdSense push failed", e);
      }
    }
  }

  private renderBlocked(): TemplateResult {
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

  private renderSlot(side: Side): TemplateResult | typeof nothing {
    if (!sideAdReady(side)) {
      return this.devPlaceholder
        ? html`<div
            class="w-[160px] h-[600px] rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-xs text-white/40 text-center px-2"
          >
            ${translateText("side_ads.placeholder")}
          </div>`
        : nothing;
    }
    const st = this.adState[side];
    if (st === "blocked") return this.renderBlocked();
    if (st === "loading") return nothing;

    if (SIDE_ADS[side] === "coupang") {
      return html`<div class="flex flex-col items-center gap-1 w-[160px]">
        <iframe
          title="Coupang"
          width=${AD_WIDTH}
          height=${AD_HEIGHT}
          scrolling="no"
          class="border-0 rounded-lg"
          referrerpolicy="unsafe-url"
          .srcdoc=${coupangDoc(side)}
        ></iframe>
        <p class="text-[10px] leading-snug text-white/45 text-center">
          ${translateText("side_ads.coupang_disclosure")}
        </p>
      </div>`;
    }
    return html`<ins
      class="adsbygoogle"
      style="display:inline-block;width:${AD_WIDTH}px;height:${AD_HEIGHT}px"
      data-ad-client=${ADSENSE_CLIENT}
      data-ad-slot=${ADSENSE_SLOTS[side]}
    ></ins>`;
  }

  render() {
    if (!this.enabled) return nothing;
    const column = "hidden xl:flex fixed top-28 z-10 [.in-game_&]:hidden";
    return html`
      <aside class="${column} left-4" aria-label="ad">
        ${this.renderSlot("left")}
      </aside>
      <aside class="${column} right-4" aria-label="ad">
        ${this.renderSlot("right")}
      </aside>
    `;
  }
}
