import test from "node:test";
import assert from "node:assert/strict";
import { installGlobalDocument } from "../../../scripts/mini-dom.mjs";
import { TimerDOP } from "obix-timer";

const { document, root } = installGlobalDocument();
const { mount } = await import("../dist/index.js");

test("mount builds the DOM, binds text/bool, wires events, updates on dispatch", () => {
  const { instance, unmount } = mount(TimerDOP, root, { props: { limitSeconds: 5 } });

  const div = root.childNodes[0];
  assert.equal(div.tagName, "DIV");
  assert.equal(div.getAttribute("data-obix-scope"), TimerDOP.style.token);

  const display = div.childNodes[0];
  assert.equal(display.textContent, "00:00");

  const controls = div.childNodes[2];
  const startBtn = controls.childNodes[0];
  const stopBtn = controls.childNodes[1];
  assert.equal(startBtn.hasAttribute("disabled"), false); // cannotStart == false at 0/5
  assert.equal(stopBtn.hasAttribute("disabled"), true); // stopped == true

  startBtn.dispatch("click");
  assert.equal(instance.state.running, true);
  assert.equal(stopBtn.hasAttribute("disabled"), false);

  instance.dispatch("Tick");
  assert.equal(display.textContent, "00:01");

  unmount();
  assert.equal(root.childNodes.length, 0);
});

test("mount throws without a template descriptor", () => {
  const noTemplate = { ...TimerDOP, template: undefined };
  assert.throws(() => mount(noTemplate, root), /no template descriptor/);
});
