# Testing — `@obinexusltd/obix-component-modal`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:overlays        # from the monorepo root, across all three overlays
```

## What `test/modal.test.mjs` covers

- `title` is required.
- A closed modal renders nothing (`render(state) === ""`).
- An open modal renders an accessible dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`).
- `open`/`close`/`toggle` are pure.
- `title` is escaped; `content` is treated as trusted HTML.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createModal } from "../dist/index.js";

test("footer actions render as buttons with data-action", () => {
  const modal = createModal({ title: "X", open: true, actions: [{ label: "OK", action: "ok" }] });
  assert.match(modal.render(modal.state), /data-action="ok"/);
});
```
