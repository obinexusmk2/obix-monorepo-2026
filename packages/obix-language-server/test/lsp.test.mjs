import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { diagnostics, completions, hover, definition, documentSymbols } from "../dist/index.js";

const timerSrc = readFileSync(
  fileURLToPath(new URL("../../obix-timer/fixture/Timer.obix", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

test("diagnostics: the frozen fixture has no errors", () => {
  const d = diagnostics(timerSrc, "Timer.obix");
  assert.equal(d.filter((x) => x.severity === "error").length, 0);
});

test("diagnostics: surfaces an a11y error from the compiler", () => {
  const d = diagnostics(timerSrc.replace('aria-live="polite"', 'aria-live="loud"'), "Timer.obix");
  assert.ok(d.some((x) => x.code === "OBIX-A001"));
});

test("completions inside { } offer derived/state/prop names", () => {
  const src = "<template><div>{</div></template><script>const state={a:1};const props={b:2};const derived={c(){}};const actions={};</script>";
  const items = completions(src, { line: 0, character: 21 });
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes("c") && labels.includes("a") && labels.includes("b"));
});

test("hover classifies an identifier", () => {
  const idx = timerSrc.indexOf("formattedTime");
  const pos = offsetToPos(timerSrc, idx + 2);
  const h = hover(timerSrc, pos);
  assert.ok(h && /derived/.test(h.contents));
});

test("definition locates a symbol in <script>", () => {
  const idx = timerSrc.indexOf("cannotStart");
  const def = definition(timerSrc, offsetToPos(timerSrc, idx + 2));
  assert.equal(def.found, true);
  assert.equal(def.section, "script");
});

test("documentSymbols reports the outline", () => {
  const s = documentSymbols(timerSrc);
  assert.equal(s.templateRoot, "div");
  assert.ok(s.actions.includes("Start"));
  assert.ok(s.events >= 3);
});

function offsetToPos(src, offset) {
  const before = src.slice(0, offset).split("\n");
  return { line: before.length - 1, character: before[before.length - 1].length };
}
