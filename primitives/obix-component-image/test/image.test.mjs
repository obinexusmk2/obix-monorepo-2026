import test from "node:test";
import assert from "node:assert/strict";
import { createImage, renderImage } from "../dist/index.js";

test("src + alt are required (alt may be empty for decorative)", () => {
  assert.throws(() => createImage({ alt: "x" }), /src/);
  assert.throws(() => createImage({ src: "/a.jpg" }), /alt/);
  assert.doesNotThrow(() => createImage({ src: "/a.jpg", alt: "" }));
});

test("render emits a responsive, layout-stable <img>", () => {
  const html = renderImage({
    src: "/hero.jpg",
    alt: "Hero banner",
    width: 1200,
    height: 600,
    aspectRatio: "16 / 9",
    srcSet: "/hero-small.jpg 600w, /hero-large.jpg 1200w",
    sizes: "(max-width: 600px) 100vw, 1200px",
  });
  assert.match(html, /^<img /);
  assert.match(html, /src="\/hero.jpg"/);
  assert.match(html, /alt="Hero banner"/);
  assert.match(html, /width="1200" height="600"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="auto"/);
  assert.match(html, /srcset="\/hero-small.jpg 600w, \/hero-large.jpg 1200w"/);
  assert.match(html, /style="aspect-ratio:16 \/ 9;object-fit:cover"/);
});

test('empty alt adds role="presentation"', () => {
  assert.match(renderImage({ src: "/deco.svg", alt: "" }), /role="presentation"/);
});

test("actions are pure", () => {
  const img = createImage({ src: "/a.jpg", alt: "a" });
  const eager = img.actions.setLoading(img.state, true);
  assert.equal(img.state.loading, "lazy");
  assert.equal(eager.loading, "eager");
  assert.equal(img.actions.onError(img.state).errored, true);
});
