/**
 * GATE 6 — Timer terminal semantics (Draft 0.2.1 Addendum A, adopted Model B refined).
 *
 *   terminal:  seconds = limitSeconds, running = false
 *   finished = true, cannotStart = true, statusLabel = "Finished"
 *   Start at terminal  = identity
 *   Reset              = the only way out
 *   Tick never decreases seconds (restored {seconds:8} stays 8, running -> false)
 */
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { pkgDir, ok, fail, die, BOLD } from "./_lib.mjs";

const timer = await import(pathToFileURL(join(pkgDir("obix-timer"), "dist", "index.js")).href);
const validator = await import(pathToFileURL(join(pkgDir("obix-validator"), "dist", "index.js")).href);
const { TimerDOP } = timer;
const { referenceFold } = validator;

const P = TimerDOP.props;
const D = TimerDOP.derived;
const A = TimerDOP.actions;
let errors = 0;
const check = (label, cond, got) => {
  if (cond) ok(`${label}`);
  else {
    fail(`${label} — got ${JSON.stringify(got)}`);
    errors++;
  }
};

console.log(BOLD("=== Timer terminal semantics (Model B refined) ===\n"));

const T8 = [["Start"], ...Array(8).fill(["Tick"])];
const term = referenceFold(TimerDOP, TimerDOP.initialState, P, T8).finalState;
console.log("after Start + Tick x8 :", JSON.stringify(term));
check("terminal seconds === limitSeconds (5)", term.seconds === P.limitSeconds, term);
check("terminal running === false", term.running === false, term);
check("derived.finished === true", D.finished(term, P) === true, D.finished(term, P));
check("derived.cannotStart === true", D.cannotStart(term, P) === true, D.cannotStart(term, P));
check('derived.statusLabel === "Finished"', D.statusLabel(term, P) === "Finished", D.statusLabel(term, P));

const afterStart = A.Start(term, undefined, P);
check("Start at terminal is identity", Object.is(afterStart, term), afterStart);

const afterReset = A.Reset(term, undefined, P);
const afterResetStart = A.Start(afterReset, undefined, P);
check("Reset then Start -> running:true, seconds:0", afterResetStart.running === true && afterResetStart.seconds === 0, afterResetStart);

const restored = Object.freeze({ seconds: 8, running: true });
const ticked = A.Tick(restored, undefined, P);
check("restored {seconds:8,running:true} + Tick -> {seconds:8,running:false}", ticked.seconds === 8 && ticked.running === false, ticked);
check("Tick never decreases seconds", ticked.seconds >= restored.seconds, ticked);

// effect quiesces with the simple predicate (no compound while)
let s = A.Start(TimerDOP.initialState, undefined, P);
let fired = 0;
const whilePred = ({ running }) => running;
for (let i = 0; i < 50 && whilePred(s, P); i++) {
  s = A.Tick(s, undefined, P);
  fired++;
}
check("simple while:{running} quiesces (fired 5, stopped)", fired === 5 && !whilePred(s, P), { fired });

if (errors) die(`${errors} terminal-semantics check(s) failed`);
console.log("");
ok("Timer terminal semantics match Addendum A (Model B refined)");
