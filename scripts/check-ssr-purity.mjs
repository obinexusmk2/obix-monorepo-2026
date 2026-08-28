/**
 * GATE 9 — SSR must be DOM-free, structurally.
 *
 *  (a) graph check: obix-adapter-ssr must not declare native/reactive/runtime deps
 *  (b) bundle check: esbuild-bundle obix-adapter-ssr for a neutral platform and
 *      assert the emitted code references no DOM globals and pulls in no
 *      forbidden package.
 *
 * We do NOT rely on package.json "browser" field tricks — purity is a property
 * of the dependency graph.
 */
import { build } from "esbuild";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readPkgJson, internalDeps, pkgDir, gzipSize, ok, fail, die, BOLD } from "./_lib.mjs";

console.log(BOLD("check:ssr-purity\n"));
let errors = 0;

// (a) declared deps
const forbidden = ["obix-adapter-native", "obix-adapter-reactive", "obix-runtime"];
const ssrDeps = internalDeps(readPkgJson("obix-adapter-ssr"));
for (const f of forbidden) {
  if (ssrDeps.includes(f)) {
    fail(`obix-adapter-ssr declares forbidden dependency: ${f}`);
    errors++;
  }
}
if (!errors) ok(`obix-adapter-ssr deps are DOM-free: [${ssrDeps.join(", ")}]`);

// (b) bundle scan
const entry = join(pkgDir("obix-adapter-ssr"), "dist", "index.js");
if (!existsSync(entry)) die("obix-adapter-ssr is not built. Run `npm run build` first.");

const res = await build({
  stdin: {
    contents: `export * from ${JSON.stringify(entry.replace(/\\/g, "/"))};`,
    resolveDir: pkgDir("obix-adapter-ssr"),
    sourcefile: "ssr-purity-entry.js",
    loader: "js",
  },
  bundle: true,
  minify: false,
  format: "esm",
  platform: "neutral",
  write: false,
  metafile: true,
  legalComments: "none",
});

const code = res.outputFiles[0].text;
const DOM_TOKENS = [
  /\bdocument\b/,
  /\bwindow\b/,
  /\bHTMLElement\b/,
  /\bElement\.prototype\b/,
  /\baddEventListener\b/,
  /\bcustomElements\b/,
  /\bMutationObserver\b/,
];
for (const re of DOM_TOKENS) {
  if (re.test(code)) {
    fail(`SSR bundle contains DOM token: ${re}`);
    errors++;
  }
}

const inputs = Object.keys(res.metafile.inputs).map((p) => p.replace(/\\/g, "/"));
for (const f of forbidden) {
  if (inputs.some((p) => p.includes(`/packages/${f}/`) || p.includes(`@obinexusltd/${f}/`))) {
    fail(`SSR bundle transitively includes ${f}`);
    errors++;
  }
}

if (errors) process.exit(1);
ok(`SSR bundle is DOM-free (${gzipSize(code)} B gzip, ${inputs.length} module(s))`);
