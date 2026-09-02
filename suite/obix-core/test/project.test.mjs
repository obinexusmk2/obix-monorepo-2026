import test from "node:test";
import assert from "node:assert/strict";
import { toFunc, toClass } from "../dist/index.js";

const Counter = {
  tag: "x-counter",
  props: { step: 2 },
  state: { count: 0 },
  actions: {
    Inc: (s, _p, p) => ({ ...s, count: s.count + p.step }),
    Dec: (s, _p, p) => ({ ...s, count: s.count - p.step }),
    Set: (s, payload) => ({ ...s, count: Number(payload) }),
  },
  derived: {
    label: (s) => `Count: ${s.count}`,
    isZero: (s) => s.count === 0,
  },
};

test("toFunc: reduce / replay / create", () => {
  const F = toFunc(Counter);
  assert.deepEqual(F.reduce({ count: 0 }, "Inc"), { count: 2 });
  assert.deepEqual(F.replay([["Inc"], ["Inc"], ["Dec"]]), { count: 2 });
  const inst = F.create({ props: { step: 10 } });
  inst.dispatch("Inc");
  assert.deepEqual(inst.getState(), { count: 10 });
  assert.equal(inst.derived().label, "Count: 10");
});

test("toClass: generated methods + derived getters", () => {
  const Klass = toClass(Counter);
  const c = new Klass({ props: { step: 3 } });
  c.Inc();
  c.Inc();
  assert.equal(c.state.count, 6);
  assert.equal(c.label, "Count: 6");
  assert.equal(c.isZero, false);
  c.Set(0);
  assert.equal(c.isZero, true);
  assert.equal(c.revision, 3);
});

test("function and class projections stay in lockstep over a trace", () => {
  const trace = [["Inc"], ["Set", 100], ["Dec"], ["Dec"]];
  const funcFinal = toFunc(Counter).replay(trace);

  const c = new (toClass(Counter))();
  for (const [action, payload] of trace) c[action](payload);

  assert.deepEqual(funcFinal, c.state);
  assert.deepEqual(c.derived(), { label: `Count: ${c.state.count}`, isZero: c.state.count === 0 });
});
