# The DOP Contract — `@obinexusltd/obix-adapter-reactive`

This package vendors the same `types.ts`/`dop.ts` pair as every other `@obinexusltd/obix-adapter-*` package — see `obix-adapter-oop`'s [dop-contract.md](../../obix-adapter-oop/docs/dop-contract.md) for the full `DOPComponent`, `ActionFn`, and `reduce`/`replay`/`view`/`renderHtml`/`validate` reference; it applies identically here.

## What this adapter adds on top: `changedKeys`

`obix-adapter-reactive` is the one adapter that actually calls the vendored `changedKeys(prev, next)` helper (the others export it for completeness but don't use it internally):

```ts
function changedKeys<S extends object>(prev: S, next: S): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const out: string[] = [];
  for (const key of keys) {
    if (prev[key] !== next[key]) out.push(key);
  }
  return out;
}
```

It's a shallow, reference-based diff (`!==`, not deep equality) over the union of both objects' own keys — cheap to compute on every `dispatch`, and sufficient to tell a subscriber which top-level fields actually changed without diffing nested structures.

## `EffectDescriptor<S, P>`

```ts
interface EffectDescriptor<S, P> {
  everyMs: number;
  while: (state: S, props: P) => boolean;
  dispatch: string; // an existing action name
}
```

An effect never contains its own logic — `dispatch` must name an action that already exists in `artifact.actions`. This is enforced structurally, not by validation: `toReactive`'s scheduler calls `dispatch(desc.dispatch)`, which goes through the same `reduce()` path as any other dispatch and would throw `"unknown action"` if the name were wrong. See [effects.md](./effects.md) for the full scheduling behaviour.
