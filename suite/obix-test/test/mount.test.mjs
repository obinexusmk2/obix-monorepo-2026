import test from "node:test";
import assert from "node:assert/strict";
import { mountForTest, createVirtualClock } from "../dist/index.js";
import { Timer } from "./_timer.mjs";

test("advance() drives the 1s tick effect; Timer quiesces at the limit", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 } });
  t.dispatch("Start");
  t.advance(8000);
  assert.deepEqual(t.state, { seconds: 5, running: false });
  assert.equal(t.select("finished"), true);
});

test("renderText() substitutes {markers} from derived + state", () => {
  const t = mountForTest(Timer);
  assert.match(t.renderText(), /00:00/);
  assert.match(t.renderText(), /Ready/);
  t.dispatch("Start");
  t.advance(3000);
  assert.match(t.renderText(), /00:03/);
  assert.match(t.renderText(), /Running/);
});

test("transitions counter reflects real (non-noop) dispatches", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 } });
  t.dispatch("Stop"); // no-op: not running
  assert.equal(t.transitions, 0);
  t.dispatch("Start");
  t.advance(20000); // 5 ticks to the limit, then effect self-clears
  assert.equal(t.state.seconds, 5);
  assert.equal(t.transitions, 6); // Start + 5 Tick
});

test("createVirtualClock is a usable standalone Scheduler", () => {
  const clock = createVirtualClock();
  let n = 0;
  clock.scheduler.setInterval(() => n++, 100);
  clock.advance(350);
  assert.equal(n, 3);
  assert.equal(clock.now, 350);
});
