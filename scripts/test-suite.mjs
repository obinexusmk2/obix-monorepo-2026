/**
 * Run every `*.test.mjs` in the unscoped `obix-*` suite with `node --test`.
 * Assumes `npm run build:suite` has produced each package's `dist/`.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run, ok, die, BOLD, listTestFiles } from "./_lib.mjs";

const SUITE = join(ROOT, "suite");

for (const name of ["obix-core", "obix-test", "obix"]) {
  if (!existsSync(join(SUITE, name, "dist", "index.js"))) {
    die(`suite/${name}/dist is missing — run \`npm run build:suite\` first`);
  }
}

const files = [
  join(SUITE, "obix-core", "test"),
  join(SUITE, "obix-test", "test"),
  join(SUITE, "obix", "test"),
  join(SUITE, "examples", "timer"),
].flatMap(listTestFiles);

if (files.length === 0) die("no suite test files found");

console.log(BOLD(`Running ${files.length} suite test file(s) with node --test\n`));
try {
  run(process.execPath, ["--test", ...files], { stdio: "inherit" });
} catch {
  die("suite tests failed");
}
ok(`suite tests passed (${files.length} file(s))`);
