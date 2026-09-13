# The DOP Contract — `@obinexusltd/obix-adapter-ssr`

This package vendors the same `types.ts`/`dop.ts` pair as every other `@obinexusltd/obix-adapter-*` package — see `obix-adapter-oop`'s [dop-contract.md](../../obix-adapter-oop/docs/dop-contract.md) for the full `DOPComponent`, `ActionFn`, and `reduce`/`replay`/`view`/`renderHtml` reference.

## What this adapter uses from it

`obix-adapter-ssr` is the thinnest consumer of the vendored core — it only calls `replay` (as `fold`), `renderHtml`, and `view`:

```ts
import { replay as fold, renderHtml, view } from "./dop.js";
```

It never calls `reduce` directly (that's what `fold`/`replay` do internally, one action at a time) and it has no need for `validate` or `changedKeys` — SSR is about producing HTML from a state, not about mutating state interactively or diffing transitions.

## Why this makes it the reference implementation

Because `renderToString` is a pure function — `(artifact, state, props) => html` with zero paths to a DOM, a timer, or a class instance's private fields — its output for a given `(artifact, state, props)` triple is the simplest possible thing to compare every other projection against. See [compliance.md](./compliance.md) for how that comparison is actually built.
