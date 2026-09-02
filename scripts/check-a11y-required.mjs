/**
 * GATE 7 — the compiler cannot build without accessibility analysis.
 *
 *  (a) obix-compiler declares a NORMAL dependency on obix-accessibility
 *      (not optional / not peer)
 *  (b) the built compiler bundle transitively includes obix-accessibility
 *  (c) compiling a component with an a11y error yields ok:false and no emitted code
 *      (there is no --no-a11y switch)
 */
import { build } from "esbuild";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readPkgJson, pkgDir, ok, fail, die, BOLD } from "./_lib.mjs";

console.log(BOLD("check:a11y-required\n"));
let errors = 0;

const pkg = readPkgJson("obix-compiler");
if (!(pkg.dependencies ?? {})["obix-accessibility"]) {
  fail("obix-compiler does not declare a normal dependency on obix-accessibility");
  errors++;
} else if ((pkg.peerDependencies ?? {})["obix-accessibility"] || (pkg.optionalDependencies ?? {})["obix-accessibility"]) {
  fail("obix-accessibility must be a normal dependency, not peer/optional");
  errors++;
} else {
  ok("obix-compiler -> obix-accessibility is a normal dependency");
}

const entry = join(pkgDir("obix-compiler"), "dist", "index.js");
if (!existsSync(entry)) die("obix-compiler is not built. Run `npm run build` first.");

const res = await build({
  stdin: { contents: `export * from ${JSON.stringify(entry.replace(/\\/g, "/"))};`, resolveDir: pkgDir("obix-compiler"), loader: "js" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  metafile: true,
  legalComments: "none",
});
const inputs = Object.keys(res.metafile.inputs).map((p) => p.replace(/\\/g, "/"));
if (inputs.some((p) => /(^|\/)obix-accessibility\/dist\//.test(p))) {
  ok("compiler bundle transitively includes obix-accessibility");
} else {
  fail("compiler bundle does NOT include obix-accessibility — a11y is not statically linked");
  errors++;
}

// (c) behavioural: an a11y error blocks emit
try {
  const { compile } = await import(pathToFileURL(entry).href);
  const bad = [
    "<style></style>",
    "<template>",
    '  <div role="timer">',
    '    <p aria-live="loud">{label}</p>', // invalid aria-live token -> OBIX-A001 (error)
    '    <button on:click="Go">Go</button>',
    "  </div>",
    "</template>",
    "<script>",
    'const state = { label: "x" };',
    "const props = {};",
    "const actions = { Go(state) { return state; } };",
    "const derived = {};",
    "</script>",
  ].join("\n");
  const r = compile(bad, { path: "Bad.obix" });
  if (r.ok || r.code) {
    fail("compile() emitted code for a component with an a11y error");
    errors++;
  } else if (!r.diagnostics.some((d) => d.code && d.code.startsWith("OBIX-A"))) {
    fail("compile() failed but produced no accessibility diagnostic");
    errors++;
  } else {
    ok("a11y error blocks emit (ok:false, OBIX-A* diagnostic, no code)");
  }
} catch (err) {
  fail(`could not exercise compile(): ${err.message}`);
  errors++;
}

if (errors) process.exit(1);
ok("accessibility analysis is a hard, non-optional part of the compiler");
