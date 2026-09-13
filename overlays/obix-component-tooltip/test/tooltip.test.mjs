import test from "node:test";
import assert from "node:assert/strict";
import { createTooltip, renderTooltip } from "../dist/index.js";

test("trigger text and content are required", () => {
  assert.throws(() => createTooltip({ content: "x" }), /trigger/);
  assert.throws(() => createTooltip({ trigger: "?" }), /content/);
});

test("render links trigger to tooltip via aria-describedby; hidden while not visible", () => {
  const html = renderTooltip({
    trigger: "?",
    content: "Enter your email address to receive updates",
    placement: "right",
    delay: 200,
    closeDelay: 500,
    id: "help",
  });
  assert.match(
    html,
    /<span class="obix-tooltip-trigger" tabindex="0" aria-describedby="help" data-activate-on="hover" data-delay="200" data-close-delay="500">\?<\/span>/,
  );
  assert.match(html, /<div id="help" role="tooltip" class="obix-tooltip obix-tooltip--right" hidden>Enter your email address to receive updates<\/div>/);
});

test("show / hide / toggle are pure and drop the hidden attribute", () => {
  const t = createTooltip({ trigger: "?", content: "hi" });
  const shown = t.actions.show(t.state);
  assert.equal(shown.visible, true);
  assert.equal(t.state.visible, false);
  assert.doesNotMatch(t.render(shown), / hidden>/);
  assert.equal(t.actions.toggle(shown).visible, false);
});

test("content is escaped", () => {
  assert.match(renderTooltip({ trigger: "?", content: '<b>"&' }), /role="tooltip"[^>]*>&lt;b&gt;&quot;&amp;</);
});
