import test from "node:test";
import assert from "node:assert/strict";
import { createButton, renderButton } from "../dist/index.js";

test("defaults + required label", () => {
  assert.throws(() => createButton({}), /label/);
  const b = createButton({ label: "Save" });
  assert.equal(b.name, "ObixButton");
  assert.equal(b.state.variant, "primary");
  assert.equal(b.state.size, "md");
  assert.equal(b.state.type, "button");
  assert.equal(b.state.ariaLabel, "Save");
  assert.equal(b.state.minWidth, "48px");
});

test("render is deterministic accessible HTML", () => {
  assert.equal(
    renderButton({ label: "Delete", variant: "danger", size: "md" }),
    '<button class="obix-button obix-button--danger obix-button--md" type="button" ' +
      'aria-label="Delete" style="min-width:48px;min-height:48px">Delete</button>',
  );
});

test("loading forces disabled + aria-busy + spinner", () => {
  const html = renderButton({ label: "Save", loading: true });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /obix-button__spinner/);
});

test("actions are pure — input state is never mutated", () => {
  const b = createButton({ label: "Go" });
  const next = b.actions.setLoading(b.state, true);
  assert.equal(b.state.loading, false);
  assert.equal(next.loading, true);
  assert.equal(next.disabled, true);
});

test("toggle only flips when toggle:true and enabled", () => {
  const t = createButton({ label: "Mute", toggle: true });
  assert.equal(t.actions.toggle(t.state).ariaPressed, true);
  const plain = createButton({ label: "Go" });
  assert.equal(plain.actions.toggle(plain.state), plain.state); // no-op
});

test("click is a no-op while disabled/loading", () => {
  const b = createButton({ label: "Go", disabled: true });
  assert.equal(b.actions.click(b.state), b.state);
});

test("escapes user text in label / aria-label", () => {
  assert.match(renderButton({ label: '<x>"&' }), /&lt;x&gt;&quot;&amp;/);
});
