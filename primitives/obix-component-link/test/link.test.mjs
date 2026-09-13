import test from "node:test";
import assert from "node:assert/strict";
import { createLink, renderLink } from "../dist/index.js";

test("href + label required", () => {
  assert.throws(() => createLink({ label: "x" }), /href/);
  assert.throws(() => createLink({ href: "/x" }), /label/);
});

test("internal link — minimal, no target/rel", () => {
  assert.equal(
    renderLink({ href: "/about", label: "About Us", ariaLabel: "About Us page" }),
    '<a class="obix-link" href="/about" aria-label="About Us page">About Us</a>',
  );
});

test("external is auto-detected from protocol-absolute href", () => {
  const html = renderLink({ href: "https://example.com", label: "External Site", target: "_blank" });
  assert.match(html, /class="obix-link obix-link--external"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/); // safe default for _blank
  assert.match(html, /aria-label="External Site \(opens in a new window\)"/);
  assert.match(html, /<span class="obix-link__external" aria-hidden="true">↗<\/span>/);
});

test("download link", () => {
  const html = renderLink({ href: "/document.pdf", label: "Download Guide", download: "guide.pdf" });
  assert.match(html, /download="guide.pdf"/);
  assert.match(html, /aria-label="Download Guide \(download\)"/);
});

test("actions are pure", () => {
  const link = createLink({ href: "/a", label: "A" });
  assert.equal(link.actions.navigate(link.state).visited, true);
  assert.equal(link.state.visited, false);
  assert.equal(link.actions.setExternal(link.state, true).external, true);
});

test("label + aria-label are escaped", () => {
  assert.match(renderLink({ href: "/a", label: '<b>"&' }), /&lt;b&gt;&quot;&amp;/);
});
