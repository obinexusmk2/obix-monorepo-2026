# API Reference — `@obinexusltd/obix-adapter-ssr`

## `renderToString<S, P>(artifact, opts?): string`

Renders a component to an HTML string with no folding — uses `opts.state` (or `artifact.state`) directly.

```ts
import { renderToString } from "@obinexusltd/obix-adapter-ssr";

renderToString(Counter);                          // uses Counter.state
renderToString(Counter, { state: { count: 7 } });  // explicit state
```

## `renderTrace<S, P>(artifact, trace, opts?): string`

Folds an `ActionTrace` (via the vendored `replay`) starting from `opts.state ?? artifact.state`, then renders the result.

```ts
renderTrace(Counter, [["inc"], ["inc"], ["inc"]]); // '<button ...>3</button>'
```

## `renderDocument<S>(artifact, opts?): ServerDocument<S>`

```ts
interface ServerDocument<S> { name: string; html: string; state: S; }
```

Like `renderTrace`, but returns the **state alongside the HTML** — a payload shaped for shipping to the client for hydration (the client can reconstruct state without re-running the trace).

```ts
const doc = renderDocument(Counter, { trace: [["inc"], ["inc"]] });
// { name: "Counter", html: '<button aria-label="count: 2">2</button>', state: { count: 2 } }
```

`opts.trace` is optional — omit it to use `opts.state`/`artifact.state` as-is with no folding.

## `toView<S, P>(artifact, opts?): RenderView<S, P>`

Exposes the flattened render view (`state` + `props` + `derived`) without calling `render` — useful for template engines that want the data, not a pre-rendered string.

## `RenderOptions<S, P>`

```ts
interface RenderOptions<S, P> { state?: S; props?: Partial<P>; }
```

## Compliance

See [compliance.md](./compliance.md) for `compliance(projections)`, `ComplianceError`, `ComplianceReport`, and `Projections` — the cross-paradigm equivalence checker this package hosts.

## Exported types

`ActionContext`, `ActionFn`, `ActionTrace`, `DOPComponent`, `EffectDescriptor`, `RenderView`, `ValidationResult` (re-exported), plus `RenderOptions`, `ServerDocument` declared locally.
