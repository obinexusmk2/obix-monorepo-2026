# Testing — `@obinexusltd/obix-component-tooltip`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:overlays        # from the monorepo root, across all three overlays
```

## What `test/tooltip.test.mjs` covers

- `trigger` text and `content` are required.
- `render` links the trigger to the tooltip via `aria-describedby`; the tooltip is `hidden` while not visible.
- `show`/`hide`/`toggle` are pure and correctly add/drop the `hidden` attribute on the next render.
- `content` is escaped.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTooltip } from "../dist/index.js";

test("negative delay/closeDelay are clamped to 0", () => {
  const tooltip = createTooltip({ trigger: "?", content: "x", delay: -50 });
  assert.equal(tooltip.state.delay, 0);
});
```
