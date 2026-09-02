import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDOP } from "obix-ir";
import { referenceFold, checkActionPropDeps, checkPipelineInvariant } from "../dist/index.js";

// hermetic mini artifact — the validator package never imports an adapter or the fixture
const mini = createDOP({
  name: "Mini",
  initialState: { n: 0, done: false },
  props: { limit: 3 },
  actions: {
    Tick: (s, _p, props) => (s.n >= props.limit ? { ...s, done: true } : { ...s, n: s.n + 1, done: s.n + 1 >= props.limit }),
    Reset: (s) => ({ ...s, n: 0, done: false }),
  },
  derived: { over: (s, p) => s.n >= p.limit },
  render: (s) => `<b>${s.n}</b>`,
  validate: (s, p) => ({ valid: s.n <= p.limit, violations: s.n <= p.limit ? [] : [{ rule: "limit", message: "n>limit" }] }),
  actionPropDeps: { Tick: ["limit"] },
});

test("referenceFold source imports no adapter and calls no applyAction/replayTrace", () => {
  const raw = readFileSync(fileURLToPath(new URL("../dist/reference-fold.js", import.meta.url)), "utf8");
  // strip comments so the prose explaining what it does NOT do can mention those names
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bimport\b[^\n]*adapter-(data|functional|oop|reactive|native|ssr)/);
  assert.doesNotMatch(code, /\bapplyAction\s*\(/);
  assert.doesNotMatch(code, /\breplayTrace\s*\(/);
  assert.doesNotMatch(code, /\bto(Data|Functional|OOP|Reactive)\s*\(/);
});

test("obix-validator package.json declares no adapter dependency", () => {
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"));
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.ok(!deps.some((d) => d.includes("obix-adapter-")), `unexpected adapter dep: ${deps}`);
  assert.ok(!deps.includes("obix-equivalence"));
});

test("referenceFold folds actions directly and reports per-step history", () => {
  const r = referenceFold(mini, mini.initialState, mini.props, [["Tick"], ["Tick"], ["Tick"], ["Tick"]]);
  assert.deepEqual(r.finalState, { n: 3, done: true });
  assert.equal(r.history.length, 5);
  assert.equal(r.renders[3], "<b>3</b>");
  assert.equal(r.validations[4].valid, true);
});

test("checkActionPropDeps + checkPipelineInvariant hold for a well-formed artifact", () => {
  assert.equal(checkActionPropDeps(mini).valid, true);
  assert.equal(checkPipelineInvariant(mini).valid, true);
});
