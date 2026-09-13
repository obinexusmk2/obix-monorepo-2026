# Architecture — `@obinexusltd/obix-adapter-oop`

## One paradigm out of five

This package is one of five projections of the same underlying `DOPComponent` artifact:

| Package | Shape |
|---|---|
| `obix-adapter-oop` (this package) | A class — instances, generated methods/getters. |
| `obix-adapter-reactive` | A factory returning an object with `subscribe`/`dispatch`/effects. |
| `obix-adapter-ssr` | Pure functions — `renderToString`, `renderTrace`, `renderDocument`. |
| (data / func — elsewhere in this monorepo) | A bare functional `apply`/`replay` API, and a closure-based `create()` API. |

All five run every state transition through the *same* `reduce()` implementation (see [dop-contract.md](./dop-contract.md)) — the paradigm differs, but there is never a second implementation of "what an action does." `obix-adapter-ssr`'s `compliance()` checker exists specifically to prove this: for a given action trace, all five must render identical HTML and reach identical state (see that package's `docs/compliance.md`).

## Why the reducer is vendored, not imported

Every `obix-adapter-*` package declares **zero runtime dependencies**. Rather than one package importing a shared `dop-core` package, `dop.ts`/`types.ts` are copied byte-for-byte into each adapter. This is the same zero-dependency-pillar discipline the monorepo's `core/obix-core-*` and `obix-component-*` families use — see [dop-contract.md](./dop-contract.md) for what would need to change in all five copies if the contract itself ever changes.

## Generated methods, not hand-written ones

```ts
for (const name of Object.keys(artifact.actions)) {
  Object.defineProperty(Component.prototype, name, {
    value(this: Component, payload?: unknown) { return this.dispatch(name, payload); },
    writable: false,
    enumerable: false,
  });
}
```

Every action method on the generated class is installed via `Object.defineProperty` on the prototype, `writable: false` and `enumerable: false` — non-writable so a consumer can't silently shadow `Inc` with something that skips `dispatch`, non-enumerable so `for...in`/`Object.keys(instance)` don't leak the method names alongside real own-properties. There is never a hand-written method body per action; every generated method's body is identically `return this.dispatch(name, payload)`.

## Zero dependencies

`src/index.ts` imports only `./dop.js` and `./types.js`, both vendored locally.
