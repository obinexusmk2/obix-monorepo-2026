import test from "node:test";
import assert from "node:assert/strict";
import { createModal, renderModal } from "../dist/index.js";

test("title is required", () => {
  assert.throws(() => createModal({}), /title/);
});

test("closed modal renders nothing", () => {
  assert.equal(renderModal({ title: "X" }), "");
});

test("open modal renders an accessible dialog", () => {
  const html = renderModal(
    {
      title: "Confirm Deletion",
      content: "<p>Are you sure?</p>",
      closeOnBackdropClick: false,
      id: "del",
      actions: [
        { label: "Cancel", variant: "secondary", action: "cancel" },
        { label: "Delete", variant: "danger", action: "confirm" },
      ],
    },
    { isOpen: true },
  );
  assert.match(html, /<div class="obix-modal-backdrop" data-backdrop="dark" data-close-on-backdrop="false">/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="del-title"/);
  assert.match(html, /data-close-on-escape="true"/);
  assert.match(html, /<h2 id="del-title" class="obix-modal__title">Confirm Deletion<\/h2>/);
  assert.match(html, /<div class="obix-modal__body"><p>Are you sure\?<\/p><\/div>/);
  assert.match(html, /<button type="button" class="obix-button obix-button--danger" data-action="confirm">Delete<\/button>/);
});

test("open / close / toggle are pure", () => {
  const m = createModal({ title: "X" });
  assert.equal(m.actions.open(m.state).isOpen, true);
  assert.equal(m.state.isOpen, false);
  assert.equal(m.actions.toggle(m.actions.open(m.state)).isOpen, false);
});

test("title is escaped; content is trusted HTML", () => {
  const html = renderModal({ title: "<x>", content: "<b>ok</b>" }, { isOpen: true });
  assert.match(html, /obix-modal__title">&lt;x&gt;</);
  assert.match(html, /obix-modal__body"><b>ok<\/b></);
});
