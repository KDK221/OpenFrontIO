/**
 * Your own ads in the two side columns of the homepage (side-ads).
 *
 * Each column shows one provider:
 *   - "coupang": a Coupang Partners dynamic banner (COUPANG below), with
 *     the disclosure line Coupang requires under it
 *   - "adsense": a Google AdSense display unit (ADSENSE_CLIENT and the
 *     column's slot id), once AdSense approves the site; put an ads.txt
 *     with AdSense's line at the site root too
 *   - "none": nothing
 */
export type SideAdProvider = "coupang" | "adsense" | "none";

export const SIDE_ADS: { left: SideAdProvider; right: SideAdProvider } = {
  left: "coupang",
  right: "coupang",
};

/** Coupang Partners dynamic banner (Partners → 다이나믹 배너). */
export const COUPANG = {
  id: 1039894,
  trackingCode: "AF9798338",
  template: "carousel",
};

/** Google AdSense publisher id, "ca-pub-1234567890123456". */
export const ADSENSE_CLIENT = "";

/** AdSense ad unit ids for each column (vertical display units). */
export const ADSENSE_SLOTS = {
  left: "",
  right: "",
};

/** Whether a column has a provider that can actually show something. */
export function sideAdReady(side: "left" | "right"): boolean {
  switch (SIDE_ADS[side]) {
    case "coupang":
      return COUPANG.trackingCode !== "";
    case "adsense":
      return ADSENSE_CLIENT !== "" && ADSENSE_SLOTS[side] !== "";
    case "none":
      return false;
  }
}
