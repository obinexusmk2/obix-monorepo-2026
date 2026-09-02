import test from "node:test";
import assert from "node:assert/strict";
import {
  TimerDOP,
  FIXTURE_VERSION,
  FIXTURE_CHECKSUM,
  computeFixtureChecksum,
  verifyFixture,
  EXPECTED_TRACES,
} from "../dist/index.js";
import { referenceFold } from "obix-validator";

test("fixture version + checksum are stable", () => {
  assert.equal(FIXTURE_VERSION, "draft-0.2.1-addendum-a");
  assert.equal(computeFixtureChecksum(), FIXTURE_CHECKSUM);
  assert.equal(verifyFixture(), true);
});

test("TimerDOP shape", () => {
  assert.equal(TimerDOP.name, "Timer");
  assert.deepEqual(TimerDOP.initialState, { seconds: 0, running: false });
  assert.equal(TimerDOP.props.limitSeconds, 5);
  assert.deepEqual(Object.keys(TimerDOP.actions).sort(), ["Reset", "Start", "Stop", "Tick"]);
  assert.equal(TimerDOP.meta.actionDecls.Start.usesProps, true);
  assert.deepEqual(TimerDOP.meta.actionDecls.Tick.propDeps, ["limitSeconds"]);
});

test("Start -> Tick -> Tick -> Stop === {seconds:2, running:false}", () => {
  const { finalState } = referenceFold(
    TimerDOP,
    TimerDOP.initialState,
    TimerDOP.props,
    EXPECTED_TRACES.startTickTickStop.trace,
  );
  assert.deepEqual(finalState, { seconds: 2, running: false });
});

test("terminal: Start + Tick x8 (limit 5) === {seconds:5, running:false}", () => {
  const { finalState } = referenceFold(
    TimerDOP,
    TimerDOP.initialState,
    TimerDOP.props,
    EXPECTED_TRACES.terminal.trace,
  );
  assert.deepEqual(finalState, { seconds: 5, running: false });
  assert.equal(TimerDOP.derived.finished(finalState, TimerDOP.props), true);
  assert.equal(TimerDOP.derived.cannotStart(finalState, TimerDOP.props), true);
  assert.equal(TimerDOP.derived.statusLabel(finalState, TimerDOP.props), "Finished");
});

test("Start at terminal is identity; Reset is the way out", () => {
  const terminal = { seconds: 5, running: false };
  assert.ok(Object.is(TimerDOP.actions.Start(terminal, undefined, TimerDOP.props), terminal));
  const afterReset = TimerDOP.actions.Reset(terminal, undefined, TimerDOP.props);
  const afterStart = TimerDOP.actions.Start(afterReset, undefined, TimerDOP.props);
  assert.deepEqual(afterStart, { seconds: 0, running: true });
});

test("Tick never decreases seconds (restored {seconds:8})", () => {
  const restored = { seconds: 8, running: true };
  const ticked = TimerDOP.actions.Tick(restored, undefined, TimerDOP.props);
  assert.deepEqual(ticked, { seconds: 8, running: false });
});
