import test from "node:test";
import assert from "node:assert/strict";
import { checkEquivalence } from "../dist/index.js";
import { Timer } from "./_timer.mjs";

test("Start → Tick → Tick → Stop  ⇒  { seconds: 2, running: false }", () => {
  const report = checkEquivalence(Timer, {
    trace: [["Start"], ["Tick"], ["Tick"], ["Stop"]],
    props: { limitSeconds: 5 },
  });
  assert.ok(report.equivalent, report.divergences.join("\n"));
  assert.equal(report.steps, 4);
  assert.deepEqual(report.history[4], { seconds: 2, running: false });
});

test("terminal: Start → Tick×8  ⇒  { seconds: 5, running: false }", () => {
  const report = checkEquivalence(Timer, {
    trace: [["Start"], ...Array.from({ length: 8 }, () => ["Tick"])],
    props: { limitSeconds: 5 },
  });
  assert.ok(report.equivalent, report.divergences.join("\n"));
  assert.deepEqual(report.history.at(-1), { seconds: 5, running: false });
});

test("`from` seeds the fold; StartIsIdentityAtTheLimit", () => {
  const report = checkEquivalence(Timer, {
    trace: [["Start"]],
    from: { seconds: 5, running: false },
    props: { limitSeconds: 5 },
  });
  assert.ok(report.equivalent, report.divergences.join("\n"));
  assert.deepEqual(report.history, [
    { seconds: 5, running: false },
    { seconds: 5, running: false },
  ]);
});

test("derived values are compared step-wise, not just final state", () => {
  const report = checkEquivalence(Timer, {
    trace: [["Start"], ["Tick"], ["Tick"], ["Tick"], ["Tick"], ["Tick"]],
    props: { limitSeconds: 5 },
  });
  assert.ok(report.equivalent, report.divergences.join("\n"));
  assert.deepEqual(report.history.at(-1), { seconds: 5, running: false });
});
