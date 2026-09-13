# Testing — `@obinexusltd/obix-component-button`

## Running the tests

```bash
# from this package directory
npm test

# from the monorepo root, across every primitive
npm run test:primitives
```

Both run `node --test "test/*.test.mjs"` — the built-in Node test runner, no external test framework dependency.

## What `test/button.test.mjs` covers

- **Defaults + required field** — `createButton({})` throws; `label` is the only required field, everything else falls back per [api-reference.md](./api-reference.md).
- **Deterministic, accessible render** — the same config always renders the same HTML string, including the 48px touch target and `aria-label`.
- **Loading state** — `loading: true` forces `disabled` + `aria-busy` and renders the spinner markup.
- **Purity** — every action is asserted to return a new object without mutating the state passed in (`state !== newState` and the original object's fields unchanged).
- **Toggle semantics** — `toggle` only flips `ariaPressed` when `config.toggle` is `true` and the button is enabled; otherwise it's a no-op.
- **Disabled/loading no-ops** — `click` on a disabled or loading button returns the same state unchanged.
- **Escaping** — a label containing `<`, `>`, `&`, `"` renders safely escaped, never as raw markup.

## Adding a test

Tests are plain Node `test()`/`assert` — no setup beyond importing from `../src/index.ts`'s compiled output is required:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createButton } from "../dist/index.js";

test("my new case", () => {
  const button = createButton({ label: "X" });
  assert.equal(button.state.label, "X");
});
```

Run `npm run build` first so `dist/` reflects your `src/` changes before `npm test` picks them up.
