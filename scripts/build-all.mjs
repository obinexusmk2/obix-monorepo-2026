/** Build every package with `tsc`, in dependency order. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { topoSort } from "./graph.mjs";
import { pkgDir, run, tscJs, ok, die, BOLD } from "./_lib.mjs";

const order = topoSort();
console.log(BOLD(`Building ${order.length} packages in dependency order:\n`));
console.log(order.map((p, i) => `  ${String(i + 1).padStart(2, "0")}. ${p}`).join("\n"), "\n");

const TSC = tscJs();
if (!existsSync(TSC)) {
  die("typescript is not installed. Run `npm install` at the monorepo root first.");
}

for (const short of order) {
  const dir = pkgDir(short);
  if (!existsSync(join(dir, "tsconfig.json"))) {
    die(`${short}: missing tsconfig.json`);
  }
  process.stdout.write(`  tsc ${short} ... `);
  try {
    run(process.execPath, [TSC, "-p", join(dir, "tsconfig.json")], { stdio: "pipe", capture: true });
    console.log("ok");
  } catch (err) {
    console.log("FAILED\n");
    console.error(err.stdout?.toString() || "");
    console.error(err.stderr?.toString() || "");
    die(`build failed at ${short}`);
  }
}

ok(`built ${order.length}/${order.length} packages`);
