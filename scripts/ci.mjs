/** Run every acceptance gate in order. Stops at the first failure. */
import { run, ROOT, BOLD, GREEN, RED } from "./_lib.mjs";

const NODE = process.execPath;
const GATES = [
  ["build", ["scripts/build-all.mjs"]],
  ["structure (GATE 1,2,10,12)", ["scripts/check-package-structure.mjs"]],
  ["versions (GATE 3, OBIX-C011)", ["scripts/check-obix-versions.mjs"]],
  ["cycles (GATE 4)", ["scripts/check-cycles.mjs"]],
  ["graph rules", ["scripts/check-graph-rules.mjs"]],
  ["unit + package tests", ["scripts/run-tests.mjs"]],
  ["adapter equivalence (GATE 5)", ["scripts/run-equivalence.mjs"]],
  ["timer terminal semantics (GATE 6)", ["scripts/run-timer-terminal.mjs"]],
  ["accessibility required (GATE 7)", ["scripts/check-a11y-required.mjs"]],
  ["runtime budget (GATE 8)", ["scripts/check-runtime-budget.mjs"]],
  ["ssr purity (GATE 9)", ["scripts/check-ssr-purity.mjs"]],
  ["npm pack dry-run (GATE 11,12)", ["scripts/pack-report.mjs"]],
];

let failed = null;
for (const [name, args] of GATES) {
  console.log(BOLD(`\n──────── ${name} ────────`));
  try {
    run(NODE, args, { cwd: ROOT });
  } catch {
    failed = name;
    break;
  }
}

console.log("");
if (failed) {
  console.log(RED(`CI FAILED at: ${failed}`));
  process.exit(1);
}
console.log(GREEN("CI PASSED — all acceptance gates green"));
