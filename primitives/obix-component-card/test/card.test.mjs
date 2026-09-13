import test from "node:test";
import assert from "node:assert/strict";
import { createCard, renderCard } from "../dist/index.js";

test("explicit dimensions render inline (CLS-safe)", () => {
  const html = renderCard({ title: "Product", content: "<p>Premium widget</p>", width: "300px", height: "400px" });
  assert.match(html, /^<article class="obix-card" style="width:300px;height:400px">/);
  assert.match(html, /<h3 class="obix-card__title">Product<\/h3>/);
  assert.match(html, /<div class="obix-card__body"><p>Premium widget<\/p><\/div>/);
});

test("loading renders an aria-hidden skeleton", () => {
  const html = renderCard({ width: "300px", height: "400px", loading: true });
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /class="obix-card__skeleton" aria-hidden="true"/);
  assert.doesNotMatch(html, /obix-card__title/);
});

test("image renders inside a <figure> with alt", () => {
  const html = renderCard({ image: { src: "/p.jpg", alt: "Product image" }, width: "300px", height: "300px" });
  assert.match(html, /<figure class="obix-card__media"><img src="\/p.jpg" alt="Product image"><\/figure>/);
});

test("finishLoading is pure and swaps skeleton for content", () => {
  const card = createCard({ width: "300px", height: "400px", loading: true });
  const done = card.actions.finishLoading(card.state, "<p>Loaded</p>");
  assert.equal(card.state.loading, true); // original untouched
  assert.equal(done.loading, false);
  assert.equal(done.contentReady, true);
  assert.match(card.render(done), /<div class="obix-card__body"><p>Loaded<\/p><\/div>/);
});

test("title is escaped; content is trusted HTML", () => {
  const html = renderCard({ title: "<x>", content: "<b>ok</b>", width: "10px", height: "10px" });
  assert.match(html, /obix-card__title">&lt;x&gt;</);
  assert.match(html, /obix-card__body"><b>ok<\/b></);
});
