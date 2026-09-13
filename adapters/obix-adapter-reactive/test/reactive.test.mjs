import test from "node:test";
import assert from "node:assert/strict";
import { toReactive } from "../dist/index.js";

const Counter = {
  name: "Counter",
  state: { count: 0, running: true },
  actions: {
    inc: (ctx, by = 1) => {
      ctx.state.count += by;
    },
    stop: (ctx) => {
      ctx.state.running = false;
    },
  },
  derived: { label: (s) => `count: ${s.count}` },
  render: (v) => `<button aria-label="${v.derived.label}">${v.state.count}</button>`,
  effects: {
    autotick: { everyMs: 10, while: (s) => s.running && s.count < 3, dispatch: "inc" },
  },
};

test("dispatch notifies subscribers with changedKeys", () => {
  const r = toReactive(Counter)();
  const seen = [];
  r.subscribe((next, prev, meta) => seen.push(meta));
  r.dispatch("inc");
  r.dispatch("inc");
  assert.equal(r.state.count, 2);
  assert.equal(r.transitions, 2);
  assert.deepEqual(seen[0].changedKeys, ["count"]);
});

test("unsubscribe stops delivery", () => {
  const r = toReactive(Counter)();
  let hits = 0;
  const off = r.subscribe(() => hits++);
  r.dispatch("inc");
  off();
  r.dispatch("inc");
  assert.equal(hits, 1);
});

test("effects lifecycle drives an existing action via an injected clock", () => {
  const r = toReactive(Counter)();
  const tasks = [];
  const clock = {
    setInterval: (fn) => {
      tasks.push(fn);
      return tasks.length - 1;
    },
    clearInterval: () => {},
  };
  r.startEffects(clock);
  assert.equal(r.activeEffects, 1);
  for (let i = 0; i < 10; i++) tasks[0]();
  assert.equal(r.state.count, 3); // predicate stops at count === 3
  r.stopEffects();
  assert.equal(r.activeEffects, 0);
});
