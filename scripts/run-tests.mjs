/** Discover and run every packages/<pkg>/test/*.test.mjs with the node test runner. */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { PACKAGES } from "./graph.mjs";
import { ROOT, pkgDir, listTestFiles, run, ok, die, BOLD } from "./_lib.mjs";

const files = [];
for (const short of PACKAGES) {
  files.push(...listTestFiles(join(pkgDir(short), "test")));
}
if (files.length === 0) die("no *.test.mjs files found — did you build first? (npm run build)");

// Ensure at least obix-spec is built (cheap smoke check).
if (!existsSync(join(pkgDir("obix-spec"), "dist", "index.js"))) {
  die("packages are not built. Run `npm run build` first.");
}

console.log(BOLD(`Running ${files.length} test files\n`));
try {
  run(process.execPath, ["--test", ...files], { cwd: ROOT });
} catch {
  die("tests failed");
}
ok(`${files.length} test files passed`);
