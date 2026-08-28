import test from "node:test";
import assert from "node:assert/strict";
import {
  createDOP,
  applyAction,
  replayTrace,
  calculateChangedKeys,
  deepFreeze,
  assertClosedStateShape,
} from "../dist/index.js";

const artifact = createDOP({
  name: "Counter",
  initialState: { n: 0 },
  props: { step: 1 },
  actions: {
    Inc: (s, _p, props) => ({ ...s, n: s.n + props.step }),
    Noop: (s) => s,
  },
  derived: { doubled: (s) => s.n * 2 },
});

test("createDOP deep-freezes state + props and builds meta", () => {
  assert.ok(Object.isFrozen(artifact.initialState));
  assert.ok(Object.isFrozen(artifact.props));
  assert.equal(artifact.meta.specVersion, "0.2.1");
  assert.equal(artifact.meta.actionDecls.Inc.arity, 3);
  assert.equal(artifact.meta.actionDecls.Inc.usesProps, true);
});

test("applyAction invokes the canonical Action(state,payload,props)", () => {
  assert.deepEqual(applyAction(artifact, { n: 0 }, "Inc", undefined, { step: 5 }), { n: 5 });
  assert.throws(() => applyAction(artifact, { n: 0 }, "Missing", undefined, artifact.props), /unknown action/);
});

test("replayTrace folds via applyAction", () => {
  const out = replayTrace(artifact, [["Inc"], ["Inc"], ["Noop"]], { n: 0 }, { step: 2 });
  assert.deepEqual(out, { n: 4 });
});

test("calculateChangedKeys diffs by Object.is", () => {
  assert.deepEqual(calculateChangedKeys({ a: 1, b: 2 }, { a: 1, b: 3 }), ["b"]);
  assert.deepEqual(calculateChangedKeys({ a: 1 }, { a: 1, c: 9 }), ["c"]);
});

test("assertClosedStateShape throws on foreign keys", () => {
  assert.throws(() => assertClosedStateShape({ n: 1, x: 2 }, ["n"]), /closed shape/);
  assert.doesNotThrow(() => assertClosedStateShape({ n: 1 }, ["n"]));
});

test("deepFreeze is recursive + cycle-safe", () => {
  const o = { a: { b: 1 } };
  o.self = o;
  deepFreeze(o);
  assert.ok(Object.isFrozen(o.a));
});
