# Architecture — `@obinexusltd/obix-adapter-reactive`

## One paradigm out of five

See `obix-adapter-oop`'s [architecture.md](../../obix-adapter-oop/docs/architecture.md) for the full picture of how `obix-adapter-{oop,reactive,ssr}` (plus the data/functional projections elsewhere in the monorepo) all wrap the same `DOPComponent` artifact and route every transition through one shared `reduce()`.

## Closure state, not class fields

Where `obix-adapter-oop` uses a class with private fields, this package's `toReactive` factory closes over plain local variables (`let current`, `const subscribers = new Set()`, `const handles: unknown[] = []`) inside the returned object's methods:

```ts
export function toReactive<S, P>(artifact: DOPComponent<S, P>): ReactiveFactory<S, P> {
  return function create(opts = {}) {
    let current: S = opts.state ?? artifact.state;
    let transitions = 0;
    const subscribers = new Set<Subscriber<S>>();
    // ...
    return { get state() { return current; }, dispatch, subscribe, /* ... */ };
  };
}
```

Both approaches achieve the same encapsulation (no external code can reach `current` except through the returned methods) — closures here, private class fields in `obix-adapter-oop` — reflecting that "reactive" as a paradigm is conventionally expressed as factories/hooks rather than classes.

## Subscribers see every field of the transition, not just the new state

```ts
const meta: TransitionMeta<S> = { action, payload, from: prev, to: next, changedKeys: changedKeys(prev, next) };
for (const fn of subscribers) fn(next, prev, meta);
```

A subscriber gets the action name, its payload, both the before/after state, and the changed-key list — enough to implement fine-grained re-rendering (only touch the DOM for `changedKeys` that matter to a given view) without re-deriving any of that from `next`/`prev` itself.

## Zero dependencies

`src/index.ts` imports only `./dop.js` and `./types.js`, both vendored. The effects scheduler wraps the platform's own `setInterval`/`clearInterval` via the injectable `Clock` interface rather than depending on a scheduling library.
