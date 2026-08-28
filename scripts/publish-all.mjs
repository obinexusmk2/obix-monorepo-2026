/**
 * Publish all 20 packages in dependency-safe order.
 *
 * SAFETY: this script does nothing unless run with --yes AND npm auth is present.
 * It is never executed by CI. Intended flow:
 *
 *   npm login
 *   npm run build && npm run ci
 *   node scripts/publish-all.mjs --dry-run
 *   node scripts/publish-all.mjs --yes
 */
import { topoSort, pkgName } from "./graph.mjs";
import { OBIX_VERSION, pkgDir, run, NPM, ok, BOLD } from "./_lib.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const confirmed = args.has("--yes");

const order = topoSort();
console.log(BOLD(`Publish order (${order.length} packages @ ${OBIX_VERSION}):\n`));
order.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2, "0")}. ${pkgName(p)}`));

if (!dryRun && !confirmed) {
  console.log("\nRefusing to publish without --yes. Re-run with --dry-run to preview, or --yes to publish.");
  process.exit(2);
}

for (const short of order) {
  const name = pkgName(short);
  const cmd = ["publish", "--access", "public"];
  if (dryRun) cmd.push("--dry-run");
  console.log(BOLD(`\n$ npm ${cmd.join(" ")}   (${name})`));
  run(NPM, cmd, { cwd: pkgDir(short) });
}

ok(dryRun ? "dry-run publish completed" : `published ${order.length} packages at ${OBIX_VERSION}`);
