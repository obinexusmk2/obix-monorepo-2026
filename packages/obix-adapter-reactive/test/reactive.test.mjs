import test from "node:test";
import assert from "node:assert/strict";
import { toReactive } from "../dist/index.js";
import { createVirtualClock } from "@obinexusltd/obix-effects";
import { TimerDOP } from "@obinexusltd/obix-timer";

test("subscribers receive changedKeys; identity actions do not notify", () => {
  const r = toReactive(TimerDOP)({ props: { limitSeconds: 5 } });
  const seen = [];
  r.subscribe((next, prev, meta) => seen.push(meta.changedKeys));
  r.dispatch("Start"); // running: false -> true
  r.dispatch("Start"); // identity -> no notification
  assert.deepEqual(seen, [["running"]]);
  assert.equal(r.transitions, 1);
});

test("effects lifecycle quiesces on the simple while predicate", () => {
  const vc = createVirtualClock();
  const r = toReactive(TimerDOP)({ props: { limitSeconds: 5 } });
  r.startEffects(vc.clock);
  r.dispatch("Start");
  vc.advance(20000);
  assert.deepEqual(r.state, { seconds: 5, running: false });
  assert.equal(r.activeEffects, 0);
  r.stopEffects();
});
