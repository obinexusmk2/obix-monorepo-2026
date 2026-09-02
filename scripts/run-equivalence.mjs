/**
 * GATE 5 — Adapter Equivalence against the INDEPENDENT reference oracle.
 *
 * expected = obix-validator.referenceFold(artifact, initialState, props, trace)
 *   (referenceFold calls artifact.actions[name](state,payload,props) directly —
 *    no toData/toFunctional/toOOP/toReactive, no applyAction, no replayTrace)
 *
 * then Data / Functional / Functional.create / OOP / Reactive are each compared
 * to the oracle: step-by-step, final state, render, validation.
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { pkgDir, ok, fail, die, BOLD, DIM } from "./_lib.mjs";

const timer = await import(pathToFileURL(join(pkgDir("obix-timer"), "dist", "index.js")).href);
const test = await import(pathToFileURL(join(pkgDir("obix-equivalence"), "dist", "index.js")).href);

const { TimerDOP, EXPECTED_TRACES } = timer;
const { checkEquivalence } = test;

let errors = 0;

function report(title, scenario, expectFinal, extra) {
  console.log(BOLD(`\n=== ${title} ===`));
  const r = checkEquivalence(TimerDOP, scenario);
  console.log("projections         : reference / data / functional / functional.create / oop / reactive");
  console.log("final state         :", JSON.stringify(r.expected));
  console.log("all equivalent      :", r.equivalent);
  console.log("step-wise equivalent:", r.stepWise);
  console.log("render equivalent   :", r.renderEqual);
  console.log("validation equal    :", r.validationEqual);
  if (extra) {
    for (const [k, v] of Object.entries(extra(r))) console.log(k.padEnd(20), ":", JSON.stringify(v));
  }
  const good =
    r.equivalent &&
    r.stepWise &&
    r.renderEqual &&
    r.validationEqual &&
    JSON.stringify(r.expected) === JSON.stringify(expectFinal);
  if (good) ok(`${title} — equivalent to oracle`);
  else {
    fail(`${title} — MISMATCH`);
    console.log(DIM(JSON.stringify(r.perAdapter, null, 2)));
    errors++;
  }
  return r;
}

// Scenario 1: Start -> Tick -> Tick -> Stop  =>  { seconds: 2, running: false }
report(
  "Start -> Tick -> Tick -> Stop",
  { trace: [["Start"], ["Tick"], ["Tick"], ["Stop"]] },
  { seconds: 2, running: false },
);

// Scenario 2: terminal — Start + Tick x8, limitSeconds 5 => { seconds: 5, running: false }
report(
  "terminal: Start + Tick x8 (limitSeconds 5)",
  { trace: EXPECTED_TRACES.terminal.trace },
  { seconds: 5, running: false },
  (r) => {
    const s = r.expected;
    return {
      finished: TimerDOP.derived.finished(s, TimerDOP.props),
      cannotStart: TimerDOP.derived.cannotStart(s, TimerDOP.props),
      statusLabel: TimerDOP.derived.statusLabel(s, TimerDOP.props),
    };
  },
);

if (errors) die(`${errors} equivalence scenario(s) failed`);
console.log("");
ok("Adapter Equivalence holds against the independent referenceFold oracle");
