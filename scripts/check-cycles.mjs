/**
 * GATE 4 — zero dependency cycles.
 * Builds the graph from the ACTUAL package.json files and cross-checks it
 * against the canonical graph in graph.mjs, then runs cycle detection.
 */
import { PACKAGES, GRAPH, findCycles, topoSort } from "./graph.mjs";
import { readPkgJson, internalDeps, ok, fail, BOLD } from "./_lib.mjs";

let errors = 0;
const actual = {};

for (const short of PACKAGES) {
  const pkg = readPkgJson(short);
  actual[short] = internalDeps(pkg).sort();
}

console.log(BOLD("check:cycles — comparing declared deps to the canonical graph\n"));

for (const short of PACKAGES) {
  const want = [...(GRAPH[short] ?? [])].sort();
  const got = actual[short];
  const extra = got.filter((d) => !want.includes(d));
  const missing = want.filter((d) => !got.includes(d));
  if (extra.length || missing.length) {
    fail(`${short}: deps drift — +[${extra.join(", ")}] -[${missing.join(", ")}]`);
    errors++;
  }
}

const cycles = findCycles(actual);
if (cycles.length) {
  for (const c of cycles) fail(`cycle: ${c.join(" -> ")}`);
  errors += cycles.length;
}

try {
  const order = topoSort(actual);
  ok(`acyclic — topological order:\n   ${order.join(" -> ")}`);
} catch (err) {
  fail(String(err.message));
  errors++;
}

if (errors) process.exit(1);
ok("no dependency cycles; declared graph matches canonical graph");
