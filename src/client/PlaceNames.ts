import { assetUrl } from "@openfront/shared/AssetUrls";
import { currentLanguage } from "./Utils";

// Real place names in the player's language (resources/place_names/<lang>.json:
// English name -> local name), for the AI nations and the place-named tribes
// on the maps inherited from OpenFront. Proper nouns, not UI text, so they
// live beside the maps rather than in resources/lang. Languages without a
// file show the English names.
const LANGUAGES = new Set(["ko"]);

let loadedLang: string | null = null;
let names: Record<string, string> = {};
let loading: Promise<void> | null = null;

/**
 * Loads the place names for the current language, once. Resolves (without
 * names) on any failure: the English names are always a fine fallback.
 */
export function loadPlaceNames(): Promise<void> {
  const lang = currentLanguage().split("-")[0];
  if (loadedLang === lang) return Promise.resolve();
  if (!LANGUAGES.has(lang)) {
    loadedLang = lang;
    names = {};
    return Promise.resolve();
  }
  loading ??= fetch(assetUrl(`place_names/${lang}.json`))
    .then((r) => (r.ok ? r.json() : {}))
    .then((data: Record<string, string>) => {
      names = data;
      loadedLang = lang;
    })
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** A place's name in the player's language, or the English one. */
export function placeName(name: string): string {
  return names[name] ?? name;
}
