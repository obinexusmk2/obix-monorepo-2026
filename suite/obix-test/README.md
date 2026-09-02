# obix-test

**Headless verification for the OBIX suite.** Depends on `obix-core`.

```bash
npm install --save-dev obix-test
```

## `mountForTest(def, opts?)`

Runs a component's `obix-core` store on a virtual clock — no DOM.

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mountForTest } from "obix-test";
import { Timer } from "./Timer.ts";

test("timer quiesces at the limit", () => {
  const t = mountForTest(Timer, { props: { limitSeconds: 5 } });
  t.dispatch("Start");
  t.advance(8000);                 // fire the 1s `tick` effect eight times
  assert.equal(t.state.seconds, 5);
  assert.equal(t.state.running, false);
  assert.equal(t.select("finished"), true);
  assert.match(t.renderText(), /Finished/);
});
```

`renderText()` performs the same `{marker}` text substitution the DOM binder
does, so rendered output is assertable without a browser. `advance(ms)` drives
declared `{ every, while, dispatch }` effects deterministically.

## `checkEquivalence(def, { trace, from?, props? })`

Folds `trace` three ways — a **direct reference evaluator**, `toFunc().replay`,
and `toClass()` method calls — and reports any step where state or a derived
value diverges. The reference evaluator shares no code with the projections.

```ts
const report = checkEquivalence(Timer, {
  trace: [["Start"], ["Tick"], ["Tick"], ["Stop"]],
  props: { limitSeconds: 5 },
});
assert.ok(report.equivalent, report.divergences.join("\n"));
// report.history[report.steps] === { seconds: 2, running: false }
```

## `createVirtualClock()`

The deterministic `Scheduler` used by `mountForTest`, exported for direct use
with `obix-core.createStore({ scheduler })`.

## Status

Level 0. DOM-level mount / hydration tests are deferred (the DOM binder itself
is unit-tested inside `obix-core`).
