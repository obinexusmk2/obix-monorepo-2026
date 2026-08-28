import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanSections, parseTemplate, parseScript, parseObix } from "../dist/index.js";

const timerSrc = readFileSync(
  fileURLToPath(new URL("../../obix-timer/fixture/Timer.obix", import.meta.url)),
  "utf8",
).replace(/\r\n/g, "\n");

test("scanSections tolerates leading/trailing whitespace + finds all three", () => {
  const r = scanSections("\n\n  " + timerSrc + "\n\n");
  assert.ok(r.sections.style && r.sections.template && r.sections.script);
  assert.equal(r.diagnostics.length, 0);
});

test("scanSections flags a duplicate section", () => {
  const r = scanSections("<script>a</script><script>b</script>");
  assert.ok(r.diagnostics.some((d) => d.code === "OBIX-P003"));
});

test("parseTemplate builds a single-root tree for the Timer template", () => {
  const { raw } = scanSections(timerSrc).sections.template;
  const { ast, diagnostics } = parseTemplate(raw);
  assert.equal(diagnostics.filter((d) => d.severity === "error").length, 0);
  assert.equal(ast.tag, "div");
  const classes = ast.attrs.find((a) => a.name === "class");
  assert.equal(classes.value, "Timer");
});

test("parseTemplate classifies directives", () => {
  const { ast } = parseTemplate('<div><button on:click="Start" disabled="{cannotStart}">Go</button><p obix:if="finished">x</p></div>');
  const btn = ast.children[0];
  assert.equal(btn.attrs.find((a) => a.name === "on:click").directive, "event");
  assert.equal(btn.attrs.find((a) => a.name === "disabled").directive, "bool");
  assert.equal(ast.children[1].attrs.find((a) => a.name === "obix:if").directive, "conditional");
});

test("parseTemplate rejects a bad interpolation", () => {
  const { diagnostics } = parseTemplate("<div>{ 1 + 2 }</div>");
  assert.ok(diagnostics.some((d) => d.code === "OBIX-P006"));
});

test("parseScript extracts members without parsing JS expressions", () => {
  const { raw } = scanSections(timerSrc).sections.script;
  const { model } = parseScript(raw);
  assert.deepEqual([...model.actionNames].sort(), ["Reset", "Start", "Stop", "Tick"]);
  assert.ok(model.derivedNames.includes("formattedTime"));
  assert.ok(model.effectNames.includes("tick"));
});

test("parseObix runs validateObixAST and passes for the frozen fixture", () => {
  const r = parseObix(timerSrc, "Timer");
  assert.equal(r.structural.valid, true, JSON.stringify(r.structural.violations));
});
