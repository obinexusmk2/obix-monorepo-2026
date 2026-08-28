import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, check, test as runBehavioural, equivalence, verify } from "../dist/index.js";

const TIMER = fileURLToPath(new URL("../../obix-timer/fixture/Timer.obix", import.meta.url));

test("obixc check: the frozen fixture is clean", () => {
  const r = check(TIMER);
  assert.equal(r.ok, true, JSON.stringify(r.diagnostics));
});

test("obixc build: writes <Name>.mjs + <Name>.ir.json", async () => {
  const out = mkdtempSync(join(tmpdir(), "obixc-cli-"));
  try {
    const r = await build(TIMER, out);
    assert.equal(r.ok, true);
    assert.ok(existsSync(join(out, "Timer.mjs")));
    assert.ok(existsSync(join(out, "Timer.ir.json")));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("obixc equivalence: default trace holds against referenceFold", async () => {
  const r = await equivalence(TIMER);
  assert.equal(r.ok, true, r.message);
});

test("obixc test: behavioural cases from Timer.test.obix pass", async () => {
  const r = await runBehavioural(TIMER);
  assert.equal(r.ok, true, r.message);
  assert.ok(r.data.total >= 6);
});

test("obixc verify: compiles + surfaces the a11y model + contract", async () => {
  const r = await verify(TIMER);
  assert.equal(r.ok, true);
  assert.ok(r.data.a11y.liveRegions.length >= 1);
  assert.ok(r.data.contract.invariants.length >= 1);
});
