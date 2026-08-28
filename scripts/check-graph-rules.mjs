/**
 * Dependency-direction rules from Draft 0.2.1 §6 / §DEPENDENCY GRAPH RULES.
 * Evaluated against the ACTUAL declared dependencies.
 */
import { PACKAGES, RULES } from "./graph.mjs";
import { readPkgJson, internalDeps, ok, fail, BOLD } from "./_lib.mjs";

const actual = {};
for (const short of PACKAGES) actual[short] = internalDeps(readPkgJson(short)).sort();

console.log(BOLD("check:graph — architectural direction rules\n"));
let errors = 0;
for (const [desc, predicate] of RULES) {
  let pass;
  try {
    pass = predicate(actual);
  } catch (err) {
    pass = false;
    desc + " (threw: " + err.message + ")";
  }
  if (pass) ok(desc);
  else {
    fail(desc);
    errors++;
  }
}

if (errors) {
  console.error(`\n${errors} architectural rule(s) violated.`);
  process.exit(1);
}
ok(`all ${RULES.length} architectural rules hold`);
