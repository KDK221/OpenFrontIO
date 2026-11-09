// Turns the Vite output in static/ into a server-less singleplayer site that
// any static host can serve from its ROOT (Cloudflare Pages, R2 behind its own
// hostname, …). Run through `npm run build-static`, which runs `vite build`
// first.
//
// What it does:
//  1. Renders the EJS template static/index.html once, with an
//     environment-only BOOTSTRAP_CONFIG (no cluster, no server host) plus
//     `singleplayerOnly: true`, which hides multiplayer in the client and skips
//     the Turnstile / CrazyGames scripts.
//  2. Deletes the map folders the game does not offer (about 650 MB of
//     OpenFront maps) and OpenFront's own ads.txt.
//  3. Writes a Cloudflare Pages `_headers` file: hashed files are immutable,
//     index.html is always revalidated.
//
// The site must sit at the root of its host: the client resets the address to
// "/" and puts games at "/game/<id>". Cloudflare Pages serves index.html for
// those unknown paths as long as the output has no 404.html.

import { execSync } from "child_process";
import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildAssetUrl } from "@openfront/shared/AssetPaths";
import type { AssetManifest } from "@openfront/shared/AssetPaths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "static");

// Map folders under resources/maps that the game actually offers.
const KEEP_MAPS = new Set(["samguk", "sengoku", "warringstates", "tutorial"]);

function gitCommit(): string {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
  } catch {
    return "static";
  }
}

const indexPath = path.join(outDir, "index.html");
if (!fs.existsSync(indexPath)) {
  throw new Error("static/index.html missing: run `vite build` first");
}
const template = fs.readFileSync(indexPath, "utf8");
if (!template.includes("<%")) {
  throw new Error(
    "static/index.html is already rendered: run `vite build` again first",
  );
}

const manifestPath = path.join(outDir, "asset-manifest.json");
const assetManifest: AssetManifest = fs.existsSync(manifestPath)
  ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as AssetManifest)
  : {};

// Same-origin assets: the site is served from its host's root.
const cdnBase = "";
const url = (p: string) => buildAssetUrl(p, assetManifest, cdnBase);

const html = ejs.render(template, {
  gitCommit: JSON.stringify(gitCommit()),
  assetManifest: JSON.stringify(assetManifest),
  cdnBase: JSON.stringify(cdnBase),
  cdnBaseRaw: cdnBase,
  gameEnv: JSON.stringify("prod"),
  // Required by ClientEnv but unused: singleplayer never asks for a token,
  // and the Turnstile script is not loaded on this page at all.
  turnstileSiteKey: JSON.stringify("1x00000000000000000000AA"),
  // There is no account API. "invalid" is a reserved TLD (RFC 2606), so any
  // leftover request to api.invalid fails at DNS without reaching anyone.
  jwtAudience: JSON.stringify("invalid"),
  singleplayerOnly: true,
  manifestHref: url("manifest.json"),
  faviconHref: url("images/Favicon.svg"),
  gameplayScreenshotUrl: url("images/GameplayScreenshot.png"),
  backgroundImageUrl: url("images/background.webp"),
  desktopLogoImageUrl: url("images/OpenFront.png"),
  mobileLogoImageUrl: url("images/OF.png"),
});
fs.writeFileSync(indexPath, html);
console.log("rendered static/index.html (singleplayer only)");

// Unused maps.
const mapsDir = path.join(outDir, "_assets", "maps");
let removedMaps = 0;
if (fs.existsSync(mapsDir)) {
  for (const name of fs.readdirSync(mapsDir)) {
    if (KEEP_MAPS.has(name)) continue;
    fs.rmSync(path.join(mapsDir, name), { recursive: true, force: true });
    removedMaps++;
  }
}
console.log(`removed ${removedMaps} unused map folders`);

// OpenFront's ad seller list does not belong to this site.
fs.rmSync(path.join(outDir, "ads.txt"), { force: true });
// Pages would serve a 404.html for unknown paths instead of index.html.
fs.rmSync(path.join(outDir, "404.html"), { force: true });

// A cover image at a stable, unhashed address for game listings
// (e.g. somusoft.com/games): https://<host>/cover.webp
fs.copyFileSync(
  path.join(root, "resources", "maps", "samguk", "thumbnail.webp"),
  path.join(outDir, "cover.webp"),
);

fs.writeFileSync(
  path.join(outDir, "_headers"),
  [
    "/_assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "/",
    "  Cache-Control: no-cache",
    "/index.html",
    "  Cache-Control: no-cache",
    "",
  ].join("\n"),
);

let files = 0;
let bytes = 0;
let largest = 0;
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else {
      const size = fs.statSync(p).size;
      files++;
      bytes += size;
      largest = Math.max(largest, size);
    }
  }
};
walk(outDir);
console.log(
  `static/: ${files} files, ${(bytes / 1048576).toFixed(1)} MB, largest ${(largest / 1048576).toFixed(1)} MB`,
);
if (files > 20000 || largest > 25 * 1048576) {
  console.warn("over Cloudflare Pages limits (20,000 files / 25 MiB a file)");
}
