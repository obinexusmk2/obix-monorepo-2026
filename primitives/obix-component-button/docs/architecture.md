# Architecture — `@obinexusltd/obix-component-button`

## Data-Oriented Programming (DOP) contract

`createButton(config)` returns a plain object, not a class instance and not a DOM-bound widget:

```ts
interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
```

- **`state`** is the initial, immutable snapshot derived from `config`. Nothing in this package ever writes to it in place.
- **`actions`** are pure reducers: `(state, ...args) => newState`. Every action returns a *new* object (`{ ...s, ... }`); the input `state` is never mutated. This is verified directly — see [testing.md](./testing.md), "actions are pure" / "the input is untouched".
- **`render`** is a pure function from state to an HTML string. The same state always renders the same markup — there is no hidden internal state, no DOM reference, and no side effect.

## Why this shape

This is the same `{ name, state, actions, render }` contract every `@obinexusltd/obix-adapter-*` package projects onto a different paradigm:

- `obix-adapter-oop` wraps it in a class with generated methods that all delegate to one `dispatch`.
- `obix-adapter-reactive` wraps it with subscribers and an effects scheduler.
- `obix-adapter-ssr` folds an action trace and renders — no DOM involved.

Because `createButton`'s output already satisfies that contract structurally (TypeScript structural typing, no inheritance required), a button artifact can be handed to any adapter unchanged: `toOOP(createButton({ label: "Go" }))` works with no button-specific code in the adapter.

## Zero dependencies

`src/index.ts` imports nothing but its own `./types.js`. The HTML-escaping helper (`esc`) is a few lines of local code rather than a dependency, matching the same "vendor the few lines you need" approach `obix-adapter-*` uses for its reducer (see those packages' `docs/architecture.md`).

## Immutability in practice

Every action spreads the previous state: `{ ...s, touched: true }`. This means:

1. Two states from before/after an action can be compared by reference or by key (`prev !== next`, or per-field diffing) without a deep-equality library.
2. Replaying the same sequence of actions from the same initial state is deterministic — the same property the `obix-adapter-ssr` compliance checker relies on across all five projections.
