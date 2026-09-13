import test from "node:test";
import assert from "node:assert/strict";
import { toOOP } from "../dist/index.js";

const Counter = {
  name: "Counter",
  state: { count: 0 },
  actions: {
    Inc: (ctx, by = 1) => {
      ctx.state.count += by;
    },
    Reset: (ctx) => {
      ctx.state.count = 0;
    },
  },
  derived: { label: (s) => `count: ${s.count}` },
  render: (v) => `<button aria-label="${v.derived.label}">${v.state.count}</button>`,
  validate: (s) => ({ valid: s.count >= 0, violations: [] }),
};

test("generated action methods delegate to dispatch", () => {
  const C = toOOP(Counter);
  const o = new C();
  o.Inc();
  o.Inc(2);
  assert.deepEqual(o.state, { count: 3 });
  assert.equal(o.render(), '<button aria-label="count: 3">3</button>');
});

test("state is read-only from outside", () => {
  const o = new (toOOP(Counter))();
  assert.throws(() => {
    o.state = { count: 99 };
  }, /read-only/);
});

test("derived getter is generated on the prototype", () => {
  const o = new (toOOP(Counter))();
  o.Inc(5);
  assert.equal(o.label, "count: 5");
});

test("replay + no mutation of the artifact", () => {
  const o = new (toOOP(Counter))();
  o.replay([["Inc"], ["Inc"], ["Reset"], ["Inc", 7]]);
  assert.deepEqual(o.state, { count: 7 });
  assert.deepEqual(Counter.state, { count: 0 });
});
