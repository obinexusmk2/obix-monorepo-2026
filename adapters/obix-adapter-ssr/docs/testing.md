# Testing — `@obinexusltd/obix-adapter-ssr`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:adapters        # from the monorepo root
```

Runs `node --test "test/*.test.mjs"` against `dist/` — build first (`npm run build`) after editing `src/`.

## What `test/ssr.test.mjs` covers

- **`renderToString` is a pure string fold** — same artifact + explicit state always produces the same HTML; no default-state leakage between calls.
- **`renderTrace` folds then renders** — three `inc` actions from a `Counter` starting at `count: 0` render `count: 3`.
- **`renderDocument` returns the html and the exact state** — `doc.name`, `doc.state`, and `doc.html` are all asserted together.
- **The compiled SSR module is DOM-free by construction** — reads the *built* `dist/index.js` + `dist/dop.js` (not `src/`, so doc comments mentioning banned words don't trip the check — see the test file's own comment on this) and asserts none of `window`, `document`, `HTMLElement`, `Element`, `Node`, `addEventListener` appear as whole-word matches in the compiled output.
- **`compliance()` passes when every projection agrees** — using **inline stub projections** (a self-contained `Data`/`Func`/`OOP`/`Reactive` built right in the test file, not imports of the sibling adapter packages — see [compliance.md](./compliance.md) on why `obix-adapter-ssr` never imports its siblings) that all correctly implement the same `Counter` semantics; `report.ok === true` and the row order is exactly `["data", "func", "oop", "reactive", "ssr"]`.
- **`compliance()` throws `ComplianceError` when a projection diverges** — an intentionally-broken stub `OOP` projection (hardcoded wrong state/HTML) causes `compliance()` to throw, and the error message names `"oop"`.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toView } from "../dist/index.js";

test("toView exposes derived without rendering", () => {
  const view = toView(Counter, { state: { count: 5 } });
  assert.equal(view.derived.label, "count: 5");
});
```

If you add a `compliance()` test, prefer small inline stub projections (as the existing test does) over importing sibling `obix-adapter-*` packages, to keep this package's test suite independent of build order across the workspace.
