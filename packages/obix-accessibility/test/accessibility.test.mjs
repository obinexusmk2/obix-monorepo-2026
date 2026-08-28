import test from "node:test";
import assert from "node:assert/strict";
import { analyzeA11y, hasBlockingA11yError } from "../dist/index.js";
import { analyzeTemplate } from "@obinexusltd/obix-template";
import { parseTemplate } from "@obinexusltd/obix-parser";

const td = (html) => analyzeTemplate(parseTemplate(html).ast);

test("valid Timer-like template: live region + focusable buttons, no blocking error", () => {
  const t = td(
    '<div role="timer">' +
      '<p role="status" aria-live="polite">{statusLabel}</p>' +
      '<button on:click="Start">Start</button>' +
      "</div>",
  );
  const { model, diagnostics } = analyzeA11y(t);
  assert.equal(model.liveRegions.length, 1);
  assert.equal(model.liveRegions[0].politeness, "polite");
  assert.equal(model.focusableCount, 1);
  assert.equal(hasBlockingA11yError(diagnostics), false);
});

test("invalid aria-live token is a blocking error (OBIX-A001)", () => {
  const { diagnostics } = analyzeA11y(td('<div><p aria-live="loud">{x}</p></div>'));
  assert.ok(diagnostics.some((d) => d.code === "OBIX-A001" && d.severity === "error"));
  assert.equal(hasBlockingA11yError(diagnostics), true);
});

test("skipped heading level is a blocking error (OBIX-A004)", () => {
  const { diagnostics } = analyzeA11y(td("<div><h1>a</h1><h3>c</h3></div>"));
  assert.ok(diagnostics.some((d) => d.code === "OBIX-A004"));
});

test("live region with no binding warns (OBIX-A002, not blocking)", () => {
  const { diagnostics } = analyzeA11y(td('<div><p aria-live="polite">static</p></div>'));
  assert.ok(diagnostics.some((d) => d.code === "OBIX-A002" && d.severity === "warning"));
  assert.equal(hasBlockingA11yError(diagnostics), false);
});
