# Testing — `@obinexusltd/obix-adapter-oop`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:adapters        # from the monorepo root
```

Runs `node --test "test/*.test.mjs"` against `dist/` — build first (`npm run build`) if you've changed `src/`.

## What `test/oop.test.mjs` covers

Using a small `Counter` artifact (`{ count: 0 }`, actions `Inc`/`Reset`, a `label` derived value):

- **Generated action methods delegate to dispatch** — calling `o.Inc()` / `o.Inc(2)` produces the same result as calling `dispatch("Inc")` / `dispatch("Inc", 2)`, and `render()` reflects the updated state.
- **State is read-only from outside** — `o.state = {...}` throws a `/read-only/`-matching error.
- **Derived getter is generated on the prototype** — `o.label` reflects `artifact.derived.label(state, props)` after a mutation.
- **Replay + no mutation of the artifact** — `o.replay([...])` reaches the expected final state, and critically, the *original* `Counter.state` object (the artifact's own initial state, shared across every instance) is asserted to be untouched afterward — proving `reduce`'s clone-before-mutate behaviour actually protects the source artifact, not just the caller's local variable.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toOOP } from "../dist/index.js";

const Toggle = {
  name: "Toggle",
  state: { on: false },
  actions: { flip: (ctx) => { ctx.state.on = !ctx.state.on; } },
};

test("flip toggles the boolean", () => {
  const t = new (toOOP(Toggle))();
  t.flip();
  assert.equal(t.state.on, true);
});
```
