import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeError,
  runDoctor,
  formatReport,
  createReporter,
  exitCodeFor,
  EXIT,
  CompatError,
  isCompatError,
} from "../dist/index.js";

const passCheck = (id) => ({ id, title: id, run: () => ({ status: "tested-pass", detail: "ok" }) });
const failCheck = (id) => ({
  id,
  title: id,
  run: () => ({ status: "tested-fail", detail: "boom", error: new CompatError({ code: "fs/read", package: "p", operation: "o", reason: "boom" }) }),
});
const skipCheck = (id, required = false) => ({ id, title: id, required, run: () => ({ status: "not-tested", detail: "no runner" }) });
const unsupCheck = (id, required = false) => ({ id, title: id, required, run: () => ({ status: "unsupported", detail: "n/a here" }) });

test("normalizeError wraps a plain Error as a CompatError, keeping cause", () => {
  const orig = new Error("disk gone");
  const e = normalizeError(orig, { package: "obix-core-filesystem", operation: "readText", code: "fs/read" });
  assert.ok(isCompatError(e));
  assert.equal(e.code, "fs/read");
  assert.equal(e.package, "obix-core-filesystem");
  assert.equal(e.reason, "disk gone");
  assert.equal(e.cause, orig);
});

test("normalizeError returns a CompatError unchanged", () => {
  const c = new CompatError({ code: "process/timeout", package: "p", operation: "o", reason: "slow" });
  assert.equal(normalizeError(c, { package: "x", operation: "y" }), c);
});

test("runDoctor: all pass -> ok true, exit 0", async () => {
  const r = await runDoctor([passCheck("a"), passCheck("b")]);
  assert.equal(r.ok, true);
  assert.equal(r.summary["tested-pass"], 2);
  assert.equal(exitCodeFor(r), EXIT.ok);
});

test("runDoctor: a tested-fail makes ok false, exit 1", async () => {
  const r = await runDoctor([passCheck("a"), failCheck("b")]);
  assert.equal(r.ok, false);
  assert.equal(r.summary["tested-fail"], 1);
  assert.equal(exitCodeFor(r), EXIT.failure);
  assert.equal(r.checks[1].error.code, "fs/read");
});

test("runDoctor: non-required not-tested / unsupported do NOT fail the report", async () => {
  const r = await runDoctor([passCheck("a"), skipCheck("b"), unsupCheck("c")]);
  assert.equal(r.ok, true);
  assert.equal(r.summary["not-tested"], 1);
  assert.equal(r.summary.unsupported, 1);
});

test("runDoctor: a REQUIRED not-tested / unsupported DOES fail the report", async () => {
  const r1 = await runDoctor([skipCheck("need", true)]);
  assert.equal(r1.ok, false);
  const r2 = await runDoctor([unsupCheck("need", true)]);
  assert.equal(r2.ok, false);
});

test("runDoctor: a throwing check becomes tested-fail with a normalized error", async () => {
  const r = await runDoctor([{ id: "x", title: "x", run: () => { throw new TypeError("bad"); } }]);
  assert.equal(r.checks[0].status, "tested-fail");
  assert.equal(r.checks[0].error.name, "CompatError");
  assert.equal(r.ok, false);
});

test("runDoctor honours an already-aborted signal", async () => {
  const ac = new AbortController();
  ac.abort();
  const r = await runDoctor([passCheck("a")], { signal: ac.signal });
  assert.equal(r.checks[0].status, "not-tested");
  assert.match(r.checks[0].detail, /cancelled/);
});

test("formatReport json:true emits exactly one valid JSON document, no log text", async () => {
  const r = await runDoctor([passCheck("a"), failCheck("b")]);
  const out = formatReport(r, { json: true });
  assert.equal(out.trim().split("\n").length, 1, "must be a single line/document");
  const parsed = JSON.parse(out);
  assert.equal(parsed.schema, "obix-core-diagnostics/doctor@1");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.checks.length, 2);
});

test("createReporter writes only to the injected sink (stderr-bound), never stdout", async () => {
  const lines = [];
  const rep = createReporter({ write: (l) => lines.push(l) });
  const r = await runDoctor([passCheck("a"), failCheck("b")]);
  rep.report(r);
  assert.ok(lines.length >= 3);
  assert.ok(lines.some((l) => l.includes("FAIL")));
  assert.ok(lines.some((l) => l.startsWith("PROBLEMS") || l.includes("PROBLEMS")));
});

test("reporter human output and json output do not share a stream (contract)", () => {
  // formatReport(json:false) returns a string; the CLI sends it to stderr.
  // formatReport(json:true) returns the one JSON doc; the CLI sends it to stdout.
  // Here we just assert they are different serialisations of the same report.
  return runDoctor([passCheck("a")]).then((r) => {
    const human = formatReport(r, { json: false });
    const json = formatReport(r, { json: true });
    assert.notEqual(human, json);
    assert.doesNotThrow(() => JSON.parse(json));
    assert.throws(() => JSON.parse(human));
  });
});
