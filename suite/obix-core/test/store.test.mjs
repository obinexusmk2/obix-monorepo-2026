import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../dist/index.js";

/** A fake scheduler whose ticks are driven manually. */
function fakeScheduler() {
  const timers = new Map();
  let seq = 1;
  return {
    scheduler: {
      setInterval(fn, ms) {
        const id = seq++;
        timers.set(id, { fn, ms });
        return id;
      },
      clearInterval(id) {
        timers.delete(id);
      },
    },
    tick(times = 1) {
      for (let i = 0; i < times; i++) {
        for (const { fn } of [...timers.values()]) fn();
      }
    },
    get active() {
      return timers.size;
    },
  };
}

const Timer = {
  tag: "x-timer",
  props: { limitSeconds: 5 },
  state: { seconds: 0, running: false },
  actions: {
    Start: (s, _p, p) => (s.running || s.seconds >= p.limitSeconds ? s : { ...s, running: true }),
    Stop: (s) => (s.running ? { ...s, running: false } : s),
    Tick: (s, _p, p) => {
      if (!s.running) return s;
      const seconds = s.seconds + 1;
      if (seconds >= p.limitSeconds) return { ...s, seconds, running: false };
      return { ...s, seconds };
    },
  },
  derived: {
    finished: (s, p) => !s.running && s.seconds >= p.limitSeconds,
  },
  effects: {
    tick: { every: 1000, while: (s) => s.running, dispatch: "Tick" },
  },
};

test("actions are pure — stored state is frozen, action gets a copy", () => {
  const store = createStore(Timer, { autostart: false });
  store.dispatch("Start");
  assert.throws(() => {
    store.state.seconds = 99;
  }, TypeError);
  assert.equal(store.state.seconds, 0);
});

test("referential no-op does not bump revision or notify", () => {
  const store = createStore(Timer, { autostart: false });
  let calls = 0;
  store.subscribe(() => calls++);
  store.dispatch("Stop"); // not running ⇒ returns same ref
  assert.equal(store.revision, 0);
  assert.equal(calls, 0);
  store.dispatch("Start");
  assert.equal(store.revision, 1);
  assert.equal(calls, 1);
});

test("derived + select recompute from current state", () => {
  const store = createStore(Timer, { props: { limitSeconds: 2 }, autostart: false });
  assert.equal(store.select("finished"), false);
  store.dispatch("Start");
  store.dispatch("Tick");
  store.dispatch("Tick");
  assert.deepEqual(store.state, { seconds: 2, running: false });
  assert.equal(store.derived().finished, true);
});

test("revisions + undo step backwards", () => {
  const store = createStore(Timer, { autostart: false });
  store.dispatch("Start");
  store.dispatch("Tick");
  assert.equal(store.state.seconds, 1);
  assert.equal(store.revisions().length, 2);
  store.undo();
  assert.equal(store.state.seconds, 0);
  assert.equal(store.state.running, true);
});

test("effect self-clears when `while` goes false (Timer quiesces at the limit)", () => {
  const fake = fakeScheduler();
  const store = createStore(Timer, { props: { limitSeconds: 3 }, scheduler: fake.scheduler });
  assert.equal(fake.active, 0, "not armed until running");
  store.dispatch("Start");
  assert.equal(fake.active, 1, "armed on Start");
  fake.tick(10); // far more ticks than needed
  assert.deepEqual(store.state, { seconds: 3, running: false });
  assert.equal(fake.active, 0, "interval cleared itself at the limit");
});

test("halt clears effects; resume re-arms; destroy is terminal", () => {
  const fake = fakeScheduler();
  const store = createStore(Timer, { scheduler: fake.scheduler });
  store.dispatch("Start");
  assert.equal(fake.active, 1);
  store.halt();
  assert.equal(fake.active, 0);
  assert.equal(store.lifecycle, "halted");
  store.resume();
  assert.equal(fake.active, 1);
  store.destroy();
  assert.equal(fake.active, 0);
  assert.equal(store.lifecycle, "destroyed");
});

test("unknown action throws", () => {
  const store = createStore(Timer, { autostart: false });
  assert.throws(() => store.dispatch("Nope"), /unknown action "Nope"/);
});
