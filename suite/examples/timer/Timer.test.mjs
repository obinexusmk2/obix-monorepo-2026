/**
 * The six behavioural cases from the frozen `Timer.test.obix`, re-expressed with
 * `obix-test`. Parity check: this suite reproduces the frozen Timer semantics
 * without a `.obix` file or a compiler.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mountForTest, checkEquivalence } from "obix-test";
import { Timer } from "./Timer.ts";

test("TerminalStateStopsTheClock", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 } });
  t.dispatch("Start");
  t.advance(8000);
  assert.equal(t.state.seconds, 5);
  assert.equal(t.state.running, false);
  assert.equal(t.select("finished"), true);
  assert.equal(t.select("statusLabel"), "Finished");
});

test("StartIsIdentityAtTheLimit", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 }, state: { seconds: 5, running: false } });
  t.dispatch("Start");
  assert.equal(t.transitions, 0);
  assert.equal(t.state.running, false);
});

test("StartButtonIsDisabledAtTheLimit", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 }, state: { seconds: 5, running: false } });
  assert.equal(t.select("cannotStart"), true);
});

test("ResetIsTheWayOut", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 }, state: { seconds: 5, running: false } });
  t.dispatch("Reset");
  t.dispatch("Start");
  assert.equal(t.state.running, true);
  assert.equal(t.state.seconds, 0);
});

test("TickNeverDecreasesSeconds", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 }, state: { seconds: 8, running: true } });
  t.dispatch("Tick");
  assert.equal(t.state.seconds, 8);
  assert.equal(t.state.running, false);
});

test("EffectQuiescesWithoutACompoundPredicate", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 } });
  t.dispatch("Start");
  t.advance(20000);
  assert.equal(t.state.seconds, 5);
  assert.equal(t.transitions, 6); // Start + 5 Tick
});

test("adapter equivalence — Start → Tick → Tick → Stop ⇒ { seconds: 2, running: false }", () => {
  const report = checkEquivalence(Timer, {
    trace: [["Start"], ["Tick"], ["Tick"], ["Stop"]],
    props: { limitSeconds: 5 },
  });
  assert.ok(report.equivalent, report.divergences.join("\n"));
  assert.deepEqual(report.history.at(-1), { seconds: 2, running: false });
});

test("renderText mirrors the .obix template markers", () => {
  const t = mountForTest(Timer, {
    props: { limitSeconds: 5 },
    template:
      '<output>{formattedTime}</output><p>{statusLabel}</p>' +
      '<p class="hint">{finished}</p>',
  });
  assert.match(t.renderText(), /00:00/);
  assert.match(t.renderText(), /Ready/);
  t.dispatch("Start");
  t.advance(5000);
  assert.match(t.renderText(), /00:05/);
  assert.match(t.renderText(), /Finished/);
  assert.match(t.renderText(), /true/);
});
