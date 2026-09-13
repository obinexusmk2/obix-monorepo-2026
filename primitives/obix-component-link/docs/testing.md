# Testing — `@obinexusltd/obix-component-link`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:primitives      # from the monorepo root, across every primitive
```

## What `test/link.test.mjs` covers

- `href` and `label` are required.
- Internal links render minimal markup — no `target`/`rel`.
- External links are auto-detected from a protocol-absolute `href`.
- Download links set the `download` attribute and the `"(download)"` aria-label suffix.
- Actions (`navigate`, `setExternal`, `updateHref`) are pure.
- `label` and the computed `aria-label` are both escaped.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLink } from "../dist/index.js";

test("mailto is not treated as external", () => {
  const link = createLink({ href: "mailto:a@b.com", label: "Email" });
  assert.equal(link.state.external, false);
});
```
