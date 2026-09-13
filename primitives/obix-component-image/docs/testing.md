# Testing — `@obinexusltd/obix-component-image`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:primitives      # from the monorepo root, across every primitive
```

## What `test/image.test.mjs` covers

- `src` and `alt` are required — both missing/wrong-type cases throw.
- Empty `alt` adds `role="presentation"`.
- `render` emits a responsive, layout-stable `<img>` — `srcset`/`sizes`/`aspectRatio`/`objectFit` all appear correctly when configured.
- Actions are pure: `onLoad`/`onError`/`updateSrc`/`updateAlt`/`setLoading` each return a new state object.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createImage } from "../dist/index.js";

test("decorative image gets role=presentation", () => {
  const img = createImage({ src: "/x.svg", alt: "" });
  assert.match(img.render(img.state), /role="presentation"/);
});
```
