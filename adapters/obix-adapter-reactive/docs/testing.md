# Testing — `@obinexusltd/obix-adapter-reactive`

## Running the tests

```bash
npm test                     # from this package directory
npm run test:adapters        # from the monorepo root
```

Runs `node --test "test/*.test.mjs"` against `dist/` — build first (`npm run build`) after editing `src/`.

## What `test/reactive.test.mjs` covers

Using a `Counter` artifact (`{ count, running }`, actions `inc`/`stop`, an `autotick` effect):

- **Dispatch notifies subscribers with `changedKeys`** — two `dispatch("inc")` calls produce `state.count === 2`, `transitions === 2`, and the first notification's `meta.changedKeys` is exactly `["count"]`.
- **Unsubscribe stops delivery** — calling the function returned by `subscribe` prevents further notifications to that listener, while dispatch itself keeps working.
- **Effects lifecycle drives an existing action via an injected clock** — a fake `Clock` captures the scheduled callback instead of using real timers; calling it repeatedly drives `dispatch("inc")` until the effect's own `while` predicate (`count < 3`) goes false, at which point further ticks are no-ops. `activeEffects` reflects `1` while running and `0` after `stopEffects()`.

## Adding a test

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { toReactive } from "../dist/index.js";

const Toggle = {
  name: "Toggle",
  state: { on: false },
  actions: { flip: (ctx) => { ctx.state.on = !ctx.state.on; } },
};

test("subscriber receives from/to on every dispatch", () => {
  const t = toReactive(Toggle)();
  let seen;
  t.subscribe((next, prev, meta) => { seen = meta; });
  t.dispatch("flip");
  assert.deepEqual(seen.from, { on: false });
  assert.deepEqual(seen.to, { on: true });
});
```

Use a fake `Clock` (see [effects.md](./effects.md)) for anything involving `startEffects` — never rely on real timers in a test, to keep the suite fast and deterministic.
