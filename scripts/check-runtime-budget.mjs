/**
 * GATE 8 — the tree-shaken runtime bundle must be <= 4 KB minified + gzipped.
 * Also checks a representative "Timer inline helper subset" <= 6 KB gzip
 * (Draft 0.2.1 Problem 2 mitigation): the runtime bindings actually used by Timer.
 *
 * Measured on the BUNDLE, not the npm package wrapper text.
 */
import { build } from "esbuild";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { pkgDir, gzipSize, ok, fail, die, BOLD } from "./_lib.mjs";

const RUNTIME_BUDGET = 4 * 1024;
const INLINE_BUDGET = 6 * 1024;

const entry = join(pkgDir("obix-runtime"), "dist", "index.js");
if (!existsSync(entry)) die("obix-runtime is not built. Run `npm run build` first.");

async function bundleGzip(stdinContents, resolveDir) {
  const res = await build({
    stdin: { contents: stdinContents, resolveDir, sourcefile: "budget-entry.js", loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    treeShaking: true,
    write: false,
    legalComments: "none",
  });
  return gzipSize(res.outputFiles[0].text);
}

console.log(BOLD("check:runtime-budget\n"));
let errors = 0;

// 1. Whole runtime, tree-shaken (import * re-exports everything actually reachable).
const whole = await bundleGzip(
  `export * from ${JSON.stringify(entry.replace(/\\/g, "/"))};`,
  pkgDir("obix-runtime"),
);
const line1 = `runtime core (tree-shaken, min+gzip): ${whole} B / ${RUNTIME_BUDGET} B`;
if (whole <= RUNTIME_BUDGET) ok(line1);
else {
  fail(line1);
  errors++;
}

// 2. Timer inline helper subset — only the bindings a compiled Timer would inline.
const subset = await bundleGzip(
  `import { bindText, bindAttr, bindBool, bindAria, bindEvent, createBindingGroup } from ${JSON.stringify(
    entry.replace(/\\/g, "/"),
  )};
   globalThis.__keep = [bindText, bindAttr, bindBool, bindAria, bindEvent, createBindingGroup];`,
  pkgDir("obix-runtime"),
);
const line2 = `Timer inline helper subset (min+gzip): ${subset} B / ${INLINE_BUDGET} B`;
if (subset <= INLINE_BUDGET) ok(line2);
else {
  fail(line2);
  errors++;
}

if (errors) process.exit(1);
ok("runtime size budget satisfied");
