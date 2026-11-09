import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SIDE_ADS } from "../AdConfig";
import { isDesktopShell } from "../DesktopShell";
import { gamePortal } from "../GamePortal";
import { translateText } from "../Utils";

/** Ad hosts the side columns load from; a blocker refuses these requests. */
const PROBE_URLS: Record<string, string> = {
  coupang: "https://ads-partners.coupang.com/g.js",
  adsense: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
};

/** Set when the player chose to continue with the blocker on. */
const DISMISSED_KEY = "adblock-wall-dismissed";

/**
 * Whether an ad blocker stops the ad script. A blocked request rejects even
 * in no-cors mode, while a reachable host resolves with an opaque response.
 */
export async function adsBlocked(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store" });
    return false;
  } catch {
    return true;
  }
}

/**
 * A notice in front of the homepage when an ad blocker is on, asking the
 * player to allow ads on this site. It can be dismissed ("continue without
 * disabling"), and then stays away for the rest of the session. Never shown
 * in game, on game portals or in the desktop build.
 */
@customElement("adblock-wall")
export class AdblockWall extends LitElement {
  @state() private open = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (gamePortal.isOnGamePortal() || isDesktopShell()) return;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Storage can throw (private mode); just show the notice again.
    }
    const provider = [SIDE_ADS.left, SIDE_ADS.right].find(
      (p) => p in PROBE_URLS,
    );
    if (provider === undefined) return;
    void adsBlocked(PROBE_URLS[provider]).then((blocked) => {
      this.open = blocked;
    });
  }

  private dismiss() {
    this.open = false;
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Ignore: it just comes back next load.
    }
  }

  render() {
    if (!this.open) return nothing;
    return html`<div
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 [.in-game_&]:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adblock-wall-title"
    >
      <div
        class="adblock-wall w-full max-w-md rounded-2xl border p-6 text-center space-y-4 shadow-2xl"
      >
        <div class="brand-title text-3xl">
          ${translateText("main.brand_name")}
        </div>
        <h2 id="adblock-wall-title" class="text-xl font-bold text-white">
          ${translateText("adblock_wall.title")}
        </h2>
        <p class="text-sm text-white/80 leading-relaxed">
          ${translateText("adblock_wall.body")}
        </p>
        <button
          type="button"
          class="adblock-wall-primary w-full rounded-lg px-4 py-3 font-bold transition-all active:scale-[0.98]"
          @click=${() => location.reload()}
        >
          ${translateText("adblock_wall.allowed_reload")}
        </button>
        <button
          type="button"
          class="text-xs text-white/50 hover:text-white/80 underline underline-offset-2"
          @click=${() => this.dismiss()}
        >
          ${translateText("adblock_wall.continue")}
        </button>
      </div>
    </div>`;
  }
}
