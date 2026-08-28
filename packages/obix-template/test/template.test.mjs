import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBindings, analyzeEvents, analyzeTemplate, resolveBinding, bindingScope, extractDependencies } from "../dist/index.js";
import { parseTemplate } from "@obinexusltd/obix-parser";

const { ast } = parseTemplate(
  '<div aria-label="{label}"><output>{formattedTime}</output>' +
    '<p role="status" aria-live="polite">{statusLabel}</p>' +
    '<button on:click="Start" disabled="{cannotStart}">Start</button>' +
    '<p obix:if="finished">done</p></div>',
);

test("analyzeBindings covers text / attr(aria) / bool / conditional", () => {
  const b = analyzeBindings(ast);
  const kinds = b.map((x) => x.kind).sort();
  assert.deepEqual(kinds, ["aria", "bool", "conditional", "text", "text"]);
  const boolB = b.find((x) => x.kind === "bool");
  assert.equal(boolB.target, "disabled");
  assert.deepEqual(boolB.deps, ["cannotStart"]);
});

test("analyzeEvents finds on:click -> Start with a path", () => {
  const e = analyzeEvents(ast);
  assert.equal(e.length, 1);
  assert.equal(e[0].event, "click");
  assert.equal(e[0].action, "Start");
  assert.deepEqual(e[0].path, [2]);
});

test("resolveBinding walks a dotted path against a flat scope", () => {
  const scope = bindingScope({ a: { b: 2 } }, { p: 1 }, { d: 3 });
  assert.equal(resolveBinding("a.b", scope), 2);
  assert.equal(resolveBinding("d", scope), 3);
  assert.equal(resolveBinding("p", scope), 1);
});

test("extractDependencies returns the root identifier only", () => {
  assert.deepEqual(extractDependencies("a.b.c"), ["a"]);
  assert.deepEqual(extractDependencies("1 + 2"), []);
});

test("analyzeTemplate bundles root + bindings + events", () => {
  const td = analyzeTemplate(ast);
  assert.equal(td.root.tag, "div");
  assert.ok(td.bindings.length >= 4);
  assert.equal(td.events.length, 1);
});
