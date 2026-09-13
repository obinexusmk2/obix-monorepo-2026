import test from "node:test";
import assert from "node:assert/strict";
import { createDropdown, renderDropdown } from "../dist/index.js";

const cfg = {
  trigger: { label: "Account", icon: "@" },
  items: [
    { label: "Profile", action: "profile" },
    { label: "Settings", action: "settings" },
    { divider: true },
    { label: "Disabled", disabled: true },
    { label: "Sign Out", action: "logout" },
  ],
  ariaLabel: "User menu",
  id: "um",
};

test("trigger.label and items are required", () => {
  assert.throws(() => createDropdown({ items: [] }), /trigger\.label/);
  assert.throws(() => createDropdown({ trigger: { label: "x" } }), /items/);
});

test("closed render: menu hidden, aria-expanded false, separators + disabled emitted", () => {
  const html = renderDropdown(cfg);
  assert.match(html, /<div class="obix-dropdown" data-activate-on="click">/);
  assert.match(html, /aria-haspopup="true" aria-expanded="false" aria-controls="um-menu"/);
  assert.match(html, /<ul id="um-menu" role="menu" class="obix-dropdown-menu obix-dropdown-menu--bottom" hidden>/);
  assert.match(html, /<li role="separator" class="obix-dropdown-menu__divider"><\/li>/);
  assert.match(html, /<li role="menuitem" id="um-item-3"><button type="button" disabled aria-disabled="true">Disabled<\/button><\/li>/);
});

test("open sets aria-expanded, drops hidden, focuses first selectable item", () => {
  const d = createDropdown(cfg);
  const open = d.actions.open(d.state);
  assert.equal(open.isOpen, true);
  assert.equal(open.focusedIndex, 0);
  const html = d.render(open);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /<ul id="um-menu" role="menu"[^>]*aria-activedescendant="um-item-0">/);
  assert.doesNotMatch(html, / hidden>/);
});

test("focusNext / focusPrev skip dividers and disabled items and wrap", () => {
  const d = createDropdown(cfg);
  let s = d.actions.open(d.state); // idx 0
  s = d.actions.focusNext(s); // -> 1
  assert.equal(s.focusedIndex, 1);
  s = d.actions.focusNext(s); // skip 2 (divider) + 3 (disabled) -> 4
  assert.equal(s.focusedIndex, 4);
  s = d.actions.focusNext(s); // wrap -> 0
  assert.equal(s.focusedIndex, 0);
  s = d.actions.focusPrev(s); // wrap back -> 4
  assert.equal(s.focusedIndex, 4);
});

test("selectItem closes when closeOnClick; no-op on divider/disabled; actions are pure", () => {
  const d = createDropdown(cfg);
  const open = d.actions.open(d.state);
  assert.equal(d.actions.selectItem(open, 0).isOpen, false);
  assert.equal(d.actions.selectItem(open, 2), open); // divider -> no-op
  assert.equal(d.actions.selectItem(open, 3), open); // disabled -> no-op
  assert.equal(d.state.isOpen, false); // original untouched
});
