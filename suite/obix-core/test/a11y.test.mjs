import test from "node:test";
import assert from "node:assert/strict";
import { auditHtml, hasBlockingA11yError } from "../dist/index.js";

const codes = (html) => auditHtml(html).map((d) => d.code);

test("a clean semantic template produces no diagnostics", () => {
  const html = `
    <div class="Timer" role="timer" aria-label="Session timer">
      <output>{formattedTime}</output>
      <p role="status" aria-live="polite">{statusLabel}</p>
      <button type="button" data-on-click="Start">Start</button>
      <a href="/help">Help</a>
      <h1>Title</h1><h2>Section</h2>
    </div>`;
  assert.deepEqual(auditHtml(html), []);
});

test("invalid aria-live is an error", () => {
  const d = auditHtml(`<p aria-live="loud">x</p>`);
  assert.ok(d.some((x) => x.code === "OBIX-A001" && x.severity === "error"));
  assert.equal(hasBlockingA11yError(d), true);
});

test("interpolated aria-live is accepted", () => {
  assert.deepEqual(auditHtml(`<p aria-live="{politeness}">x</p>`), []);
});

test("unknown role and unknown aria attribute warn", () => {
  assert.ok(codes(`<div role="widget"></div>`).includes("OBIX-A005"));
  assert.ok(codes(`<div aria-wiggle="1"></div>`).includes("OBIX-A006"));
});

test("<a> without href warns; <button> with no name warns", () => {
  assert.ok(codes(`<a>go</a>`).includes("OBIX-A003"));
  assert.ok(codes(`<button type="button"></button>`).includes("OBIX-A007"));
});

test("heading level skip is an error", () => {
  const d = auditHtml(`<h1>a</h1><h3>b</h3>`);
  assert.ok(d.some((x) => x.code === "OBIX-A004" && x.severity === "error"));
});

test("positive tabindex warns", () => {
  assert.ok(codes(`<div tabindex="3"></div>`).includes("OBIX-A003"));
});
