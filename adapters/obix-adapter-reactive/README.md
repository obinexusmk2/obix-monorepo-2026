# @obinexusltd/obix-adapter-reactive

**The Reactive projection — subscribers, changed keys, and an effects lifecycle.**

```bash
npm install @obinexusltd/obix-adapter-reactive
```

> **Zero dependencies.** The shared reducer is in `src/dop.ts` (byte-identical
> across `@obinexusltd/obix-adapter-*`); the interval scheduler is vendored in
> this package's `src/index.ts`.

## The DOP artifact

Same plain object as the rest of the family, plus an optional `effects` map
(see `obix/docs/obix-docs/GETTING-STARTED.md` §1):

```ts
interface DOPComponent<S, P = {}> {
  name: string;
  state: S;
  actions: Record<string, (ctx, payload?) => void>;
  derived?: Record<string, (state, props) => unknown>;
  render?: (view: { state; props; derived }) => string;
  effects?: Record<string, {
    everyMs: number;
    while: (state, props) => boolean;   // scheduler re-checks this
    dispatch: string;                    // name of an existing action
  }>;
}
```

## API

```ts
import { toReactive } from "@obinexusltd/obix-adapter-reactive";

const r = toReactive(Counter)({ props: { max: 10 } });

const off = r.subscribe((next, prev, meta) => {
  console.log(meta.action, meta.changedKeys); // "inc" ["count"]
});
r.dispatch("inc");
r.state;         // { count: 1 }
r.transitions;   // 1
r.render();       // '<button aria-label="count: 1">1</button>'
off();

r.startEffects();          // begins any declared effects (setInterval)
r.activeEffects;           // 1
r.stopEffects();           // clears them
```

`startEffects(clock?)` accepts an injected `{ setInterval, clearInterval }` clock,
so effects are testable without real timers.

| Member | Notes |
|---|---|
| `dispatch` / `replay` / `render` / `validate` | as the other projections |
| `subscribe(fn) → unsubscribe` | `fn(next, prev, { action, payload, from, to, changedKeys })` |
| `state` · `props` · `transitions` · `activeEffects` | getters |
| `startEffects(clock?)` · `stopEffects()` | effect lifecycle |

## Compliance

`@obinexusltd/obix-adapter-ssr` is the reference: for any trace, `r.render()`
returns the **identical** HTML string that `data`, `func`, `oop` and `ssr`
produce. `@obinexusltd/obix` ships `checkCompliance()` to assert it.
See `OBIX_JSX_ADAPTER_ARCHITECTURE.md` — "Paradigm Agnostic".
