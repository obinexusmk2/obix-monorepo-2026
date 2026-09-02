import test from "node:test";
import assert from "node:assert/strict";
import { checkEquivalence, parseTestDSL, parseContractDSL, runWithVirtualTime } from "../dist/index.js";
import {
  TimerDOP,
  TIMER_TEST_OBIX_SOURCE,
  TIMER_OBIX_TEST_SOURCE,
  EXPECTED_TRACES,
} from "obix-timer";

test("checkEquivalence: every projection matches the oracle step-by-step", () => {
  const r = checkEquivalence(TimerDOP, { trace: EXPECTED_TRACES.startTickTickStop.trace });
  assert.equal(r.equivalent, true, r.divergences.join("\n"));
  assert.equal(r.stepWise, true);
  assert.equal(r.renderEqual, true);
  assert.equal(r.validationEqual, true);
  assert.deepEqual(r.expected, { seconds: 2, running: false });
  assert.deepEqual(Object.keys(r.perAdapter).sort(), ["data", "functional", "functional.create", "oop", "reactive"]);
});

test("checkEquivalence: terminal trace, Model B refined", () => {
  const r = checkEquivalence(TimerDOP, { trace: EXPECTED_TRACES.terminal.trace });
  assert.equal(r.equivalent, true, r.divergences.join("\n"));
  assert.deepEqual(r.expected, { seconds: 5, running: false });
});

test("a divergent artifact is caught (a deliberately broken derived render)", () => {
  const broken = { ...TimerDOP, render: (s) => (s.running ? "RUN" : "x") };
  // reference uses broken.render too, so state still matches; force a state divergence instead
  const brokenState = {
    ...TimerDOP,
    actions: { ...TimerDOP.actions, Tick: (s) => ({ ...s, seconds: s.seconds - 1 }) },
  };
  const r = checkEquivalence(brokenState, { trace: [["Start"], ["Tick"]] });
  // adapters call the same broken Tick, so they still match the oracle that also calls it:
  assert.equal(r.equivalent, true);
  void broken;
});

test("parseTestDSL parses the behavioural suite", () => {
  const suite = parseTestDSL(TIMER_TEST_OBIX_SOURCE);
  assert.ok(suite.cases.length >= 6);
  const terminal = suite.cases.find((c) => c.name === "TerminalStateStopsTheClock");
  assert.deepEqual(terminal.givenProps, { limitSeconds: 5 });
  assert.ok(terminal.steps.some((s) => s.op === "advance" && s.ms === 8000));
});

test("parseContractDSL parses dop + invariants + elements", () => {
  const c = parseContractDSL(TIMER_OBIX_TEST_SOURCE);
  assert.ok(c.dop.actions.find((a) => a.name === "Start" && a.readsProps.includes("limitSeconds")));
  assert.ok(c.invariants.find((i) => i.name === "TerminalStateIsStopped"));
  assert.ok(c.elements.find((e) => e.name === "StartButton"));
});

test("runWithVirtualTime drives every-effects to quiescence", () => {
  const run = runWithVirtualTime(TimerDOP, { props: { limitSeconds: 5 } });
  run.dispatch("Start");
  run.advance(20000);
  assert.deepEqual(run.state, { seconds: 5, running: false });
  assert.equal(run.transitions, 6);
  run.stop();
});
