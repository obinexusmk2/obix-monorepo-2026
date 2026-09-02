/**
 * `obix build` — bundle a standard HTML/CSS/TS Web Component app with esbuild.
 *
 * 1. esbuild-bundle every `<script type="module">` in the entry `index.html`
 *    into hashed files under `<outdir>/assets/`.
 * 2. Copy the files each source module references as
 *    `new URL("./x.html", import.meta.url)` into `<outdir>/assets/` (esbuild
 *    leaves that pattern untouched, so the runtime `fetch` needs the file
 *    sitting next to the bundle).
 * 3. Copy stylesheet `<link>`s and rewrite `index.html` to the hashed outputs.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import * as esbuild from "esbuild";
import type { CliResult } from "./types.js";

export interface BuildOptions {
  cwd?: string;
  entry?: string;
  outdir?: string;
  minify?: boolean;
}

const SCRIPT_RE = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
const LINK_RE = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
const URL_ASSET_RE = /new URL\(\s*["'](\.\.?\/[^"']+)["']\s*,\s*import\.meta\.url\s*\)/g;
const local = (url: string): boolean => !/^(https?:)?\/\//.test(url) && !url.startsWith("data:");
const stemOf = (p: string): string => basename(p).replace(/\.[cm]?[jt]sx?$/, "");

export async function build(options: BuildOptions = {}): Promise<CliResult> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const entry = options.entry ?? "index.html";
  const outdir = resolve(cwd, options.outdir ?? "dist");
  const assetsDir = join(outdir, "assets");

  let html: string;
  try {
    html = readFileSync(join(cwd, entry), "utf8");
  } catch {
    return { ok: false, message: `build: cannot read entry ${entry} in ${cwd}` };
  }

  const scripts = [...html.matchAll(SCRIPT_RE)].map((m) => m[1]!).filter(local);
  if (scripts.length === 0) {
    return { ok: false, message: `build: no <script type="module" src="..."> found in ${entry}` };
  }

  mkdirSync(assetsDir, { recursive: true });

  let result: esbuild.BuildResult;
  try {
    result = await esbuild.build({
      absWorkingDir: cwd,
      entryPoints: scripts.map((s) => s.replace(/^\.\//, "")),
      bundle: true,
      format: "esm",
      target: "es2022",
      platform: "browser",
      minify: options.minify ?? true,
      sourcemap: true,
      outdir: assetsDir,
      entryNames: "[name]-[hash]",
      metafile: true,
    });
  } catch (err) {
    return { ok: false, message: `build: esbuild failed — ${(err as Error).message}` };
  }

  const outputs = result.metafile!.outputs;
  const inputs = Object.keys(result.metafile!.inputs);

  // (1) map each <script src> stem → its hashed .js output
  const stemToOut = new Map<string, string>();
  for (const [outPath, meta] of Object.entries(outputs)) {
    if (meta.entryPoint && outPath.endsWith(".js")) {
      stemToOut.set(stemOf(meta.entryPoint), "./assets/" + basename(outPath));
    }
  }

  // (2) copy `new URL("./x", import.meta.url)` referenced files next to the bundle
  const copiedAssets = new Set<string>();
  for (const input of inputs) {
    const abs = resolve(cwd, input);
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(URL_ASSET_RE)) {
      const rel = m[1]!;
      const from = resolve(dirname(abs), rel);
      const name = basename(rel);
      try {
        copyFileSync(from, join(assetsDir, name));
        copiedAssets.add(name);
      } catch {
        /* referenced file not found — leave the URL to 404 at runtime */
      }
    }
  }

  // (3) rewrite the HTML
  let rewrites = 0;
  let outHtml = html.replace(SCRIPT_RE, (whole, src: string) => {
    if (!local(src)) return whole;
    const to = stemToOut.get(stemOf(src));
    if (!to) return whole;
    rewrites++;
    return whole.replace(src, to);
  });

  const styles = [...html.matchAll(LINK_RE)].map((m) => m[1]!).filter(local);
  for (const href of styles) {
    try {
      copyFileSync(join(cwd, href), join(outdir, basename(href)));
      outHtml = outHtml.replaceAll(href, "./" + basename(href));
    } catch {
      /* leave the link as-is */
    }
  }

  writeFileSync(join(outdir, "index.html"), outHtml);

  const jsCount = Object.keys(outputs).filter((o) => o.endsWith(".js")).length;
  if (rewrites === 0) {
    return { ok: false, message: `build: bundled ${jsCount} module(s) but rewrote no <script> in ${entry}` };
  }
  return {
    ok: true,
    message:
      `built ${jsCount} bundle(s), ${copiedAssets.size} URL asset(s), ${styles.length} stylesheet(s) ` +
      `→ ${relative(cwd, outdir) || "."}/`,
    data: { outputs: Object.keys(outputs), assets: [...copiedAssets] },
  };
}
