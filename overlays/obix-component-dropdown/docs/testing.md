# Testing — `@obinexusltd/obix-component-dropdown`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:overlays        # from the monorepo root, across all three overlays
```

## What `test/dropdown.test.mjs` covers

- `trigger.label` and `items` are required.
- Closed render: the menu is `hidden`, `aria-expanded="false"`, and separators/disabled items are still emitted correctly.
- `open` sets `aria-expanded`, drops `hidden`, and focuses the first selectable item.
- `focusNext`/`focusPrev` skip dividers and disabled items and wrap around at the ends.
- `selectItem` closes the menu when `closeOnClick`; is a no-op on a divider/disabled item; and is pure.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDropdown } from "../dist/index.js";

test("all-disabled list keeps focusedIndex at -1 after open", () => {
  const dd = createDropdown({ trigger: { label: "X" }, items: [{ label: "A", disabled: true }] });
  const opened = dd.actions.open(dd.state);
  assert.equal(opened.focusedIndex, -1);
});
```
