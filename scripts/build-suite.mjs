/**
 * Build the unscoped `obix-*` suite (suite/) with `tsc`, in dependency order.
 * Independent of the frozen `packages/` graph and its gates.
 */
import { existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { ROOT, tscJs, run, ok, die, BOLD } from "./_lib.mjs";

const SUITE = join(ROOT, "suite");
const ORDER = ["obix-core", "obix-test", "obix"];

const TSC = tscJs();
if (!existsSync(TSC)) {
  die("typescript is not installed. Run `npm install` at the monorepo root first.");
}

console.log(BOLD(`Building ${ORDER.length} suite packages in dependency order:\n`));
console.log(ORDER.map((p, i) => `  ${String(i + 1).padStart(2, "0")}. ${p}`).join("\n"), "\n");

for (const name of ORDER) {
  const dir = join(SUITE, name);
  if (!existsSync(join(dir, "tsconfig.json"))) die(`${name}: missing tsconfig.json`);
  process.stdout.write(`  tsc ${name} ... `);
  try {
    run(process.execPath, [TSC, "-p", join(dir, "tsconfig.json")], { stdio: "pipe", capture: true });
    console.log("ok");
  } catch (err) {
    console.log("FAILED\n");
    console.error(err.stdout?.toString() || "");
    console.error(err.stderr?.toString() || "");
    die(`suite build failed at ${name}`);
  }
}

// `obix create` reads its scaffold from dist/templates (src/ is not published)
const from = join(SUITE, "obix", "src", "templates");
const to = join(SUITE, "obix", "dist", "templates");
if (existsSync(from)) {
  cpSync(from, to, { recursive: true });
  console.log("  copied obix/src/templates -> obix/dist/templates");
}

ok(`built ${ORDER.length}/${ORDER.length} suite packages`);
