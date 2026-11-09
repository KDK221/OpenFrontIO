/**
 * Your own ads. Fill these in once Google AdSense approves the site:
 *   - ADSENSE_CLIENT: your publisher id, "ca-pub-1234567890123456"
 *   - SIDE_AD_SLOTS: the ad unit ids of two vertical display units
 *     (AdSense → Ads → By ad unit → Display ads, size 160x600 or responsive)
 * Also put an ads.txt at the site root with the line AdSense gives you.
 *
 * Left empty, no ad script loads. In dev the slots show a dashed placeholder
 * so the layout can be checked.
 */
export const ADSENSE_CLIENT = "";

export const SIDE_AD_SLOTS = {
  left: "",
  right: "",
};

export function adsConfigured(): boolean {
  return ADSENSE_CLIENT !== "";
}
