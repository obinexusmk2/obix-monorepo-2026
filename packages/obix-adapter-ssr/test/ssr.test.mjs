import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString, renderToStream } from "../dist/index.js";
import { TimerDOP } from "obix-timer";

test("renderToString works from artifact.render", () => {
  const html = renderToString(TimerDOP);
  assert.match(html, /Timer__display/);
  assert.match(html, /00:00/);
});

test("renderToString reflects state at the terminal", () => {
  const html = renderToString(TimerDOP, { state: { seconds: 5, running: false } });
  assert.match(html, /Finished/);
  assert.match(html, /Time&#39;s up/);
});

test("the built SSR module references no DOM globals", () => {
  const src = readFileSync(fileURLToPath(new URL("../dist/index.js", import.meta.url)), "utf8");
  for (const tok of ["document", "window", "HTMLElement", "addEventListener"]) {
    assert.doesNotMatch(src, new RegExp(`\\b${tok}\\b`), `SSR must not reference ${tok}`);
  }
});

test("renderToStream throws UnsupportedFeatureError (Level 1)", () => {
  assert.throws(() => renderToStream(), /Level 1/);
});
