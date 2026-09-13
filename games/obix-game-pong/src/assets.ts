/**
 * Asset manifest — filenames only, no loading logic. `mount.ts` resolves
 * these against a base URL; `render.ts` just needs *some* string per key.
 * See LICENSE-ASSETS.txt for the art's CC BY 4.0 attribution.
 */

export interface PongAssets {
  backgroundGrid: string;
  backgroundEmpty: string;
  ball: string;
  paddleLeft: string;
  paddleRight: string;
}

/** Paths relative to this package's root (i.e. alongside package.json). */
export const PONG_ASSET_FILES: PongAssets = {
  backgroundGrid: "assets/images/background-grid.png",
  backgroundEmpty: "assets/images/background-empty.png",
  ball: "assets/images/ball.png",
  paddleLeft: "assets/images/paddle-1.png",
  paddleRight: "assets/images/paddle-2.png",
};

/** Same manifest, unresolved — render() just needs strings; default to the bare filenames. */
export const PONG_ASSETS: PongAssets = PONG_ASSET_FILES;

/** Resolve every asset path against `baseUrl` (e.g. `new URL("./assets/", import.meta.url)`). */
export function resolveAssets(baseUrl: string | URL, files: PongAssets = PONG_ASSET_FILES): PongAssets {
  const base = typeof baseUrl === "string" ? baseUrl : baseUrl.href;
  const withBase = (path: string) => new URL(path.replace(/^assets\//, ""), base).href;
  return {
    backgroundGrid: withBase(files.backgroundGrid),
    backgroundEmpty: withBase(files.backgroundEmpty),
    ball: withBase(files.ball),
    paddleLeft: withBase(files.paddleLeft),
    paddleRight: withBase(files.paddleRight),
  };
}

export const PONG_ASSET_CREDIT = {
  author: "Hektor Profe",
  url: "https://hektorprofe.net/",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;

export const PONG_FONT = {
  family: "Micro 5",
  googleFontsUrl: "https://fonts.google.com/specimen/Micro+5",
} as const;
