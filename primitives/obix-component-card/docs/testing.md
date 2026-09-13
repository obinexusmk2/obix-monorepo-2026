# Testing — `@obinexusltd/obix-component-card`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:primitives      # from the monorepo root, across every primitive
```

Runs `node --test "test/*.test.mjs"`.

## What `test/card.test.mjs` covers

- Explicit dimensions render inline styles (CLS-safe) — `width`/`height`/`minWidth`/`minHeight`/`aspectRatio` all appear in the `style` attribute when set.
- Loading renders an `aria-hidden` skeleton and nothing else — `title`/`content`/`image` are not present in the skeleton branch's HTML.
- `finishLoading` is pure and correctly swaps the skeleton branch for the content branch on the *next* render (it does not mutate the state object passed in).
- `title` is escaped; `content` is treated as trusted HTML and passed through unescaped — both behaviours are asserted explicitly so a future change can't silently flip the trust boundary.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCard } from "../dist/index.js";

test("interactive class is added", () => {
  const card = createCard({ interactive: true });
  assert.match(card.render(card.state), /obix-card--interactive/);
});
```

Build (`npm run build`) before re-running `npm test` so `dist/` reflects any `src/` edits.
