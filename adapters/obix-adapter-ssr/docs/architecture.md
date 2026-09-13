# Architecture — `@obinexusltd/obix-adapter-ssr`

## DOM-free by construction

`src/index.ts` and `src/dop.ts` reference no `window`, `document`, `HTMLElement`, `Element`, `Node`, or `addEventListener` — enforced not just by review but by a test that inspects the **compiled** `dist/index.js` + `dist/dop.js` output for those identifiers (see [testing.md](./testing.md)). This guarantees the package is genuinely safe to load in a server process, not merely "probably fine because nobody calls the DOM APIs in practice."

## One paradigm out of five, and the reference one

See `obix-adapter-oop`'s [architecture.md](../../obix-adapter-oop/docs/architecture.md) for how all five projections (oop / reactive / ssr / data / func) wrap the same `DOPComponent` artifact through one shared `reduce()`. This package additionally hosts `compliance()` — the checker that proves the other four agree with it — because SSR's pure-string-fold nature makes it the natural fixed reference point: no instance state, no subscriptions, no class encapsulation to account for when comparing outputs.

## Projections are injected, never imported

```ts
export interface Projections {
  Data: { apply(...): any; replay(...): any; render(...): string };
  Func: { toFunctional(c: any): {...} };
  OOP: { toOOP(c: any): new (...) => {...} };
  Reactive: { toReactive(c: any): (...) => {...} };
  SSR: { renderToString(c: any, o?: any): string };
}
export function compliance(p: Projections) { /* returns checkCompliance(...) */ }
```

`obix-adapter-ssr` does **not** import `obix-adapter-oop`/`obix-adapter-reactive`/the data or functional adapters — doing so would violate its own zero-runtime-dependency rule. Instead, `compliance()` takes the five projection modules as a parameter; the consuming application (`@obinexusltd/obix`, per this file's own doc comments) is the one place that actually imports all five and wires them together, then re-exports the bound `checkCompliance` function.

## Zero dependencies

`src/index.ts` imports only `./dop.js` and `./types.js`, both vendored locally, exactly like every sibling adapter.
