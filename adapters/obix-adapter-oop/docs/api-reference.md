# API Reference — `@obinexusltd/obix-adapter-oop`

## `toOOP<S, P>(artifact: DOPComponent<S, P>): OOPConstructor<S, P>`

Wraps a `DOPComponent` artifact in a generated class. Every call to `toOOP` on the same artifact produces a fresh class with its own generated prototype methods.

```ts
import { toOOP } from "@obinexusltd/obix-adapter-oop";

const Counter = {
  name: "Counter",
  state: { count: 0 },
  actions: {
    Inc: (ctx, by = 1) => { ctx.state.count += by; },
    Reset: (ctx) => { ctx.state.count = 0; },
  },
  derived: { label: (s) => `count: ${s.count}` },
  render: (v) => `<button aria-label="${v.derived.label}">${v.state.count}</button>`,
};

const CounterClass = toOOP(Counter);
const c = new CounterClass();
c.Inc();       // generated method -> dispatch("Inc")
c.Inc(2);
c.state;       // { count: 3 }
c.render();    // '<button aria-label="count: 3">3</button>'
```

## `OOPConstructor<S, P>`

```ts
interface OOPConstructor<S extends object, P extends object> {
  new (opts?: { state?: S; props?: Partial<P> }): OOPInstance<S, P>;
}
```

Construction accepts an optional starting `state` (defaults to `artifact.state`) and `props` (merged over `artifact.props`).

## `OOPInstance<S, P>`

| Member | Type | Notes |
|---|---|---|
| `state` | `S` (readonly getter) | Assigning throws `TypeError` — see [encapsulation.md](./encapsulation.md). |
| `props` | `P` (readonly getter) | Frozen with `Object.freeze`. |
| `dispatch(actionName, payload?)` | `(string, unknown?) => S` | Runs one action through the vendored reducer; returns the new state. |
| `replay(trace)` | `(ActionTrace) => S` | Runs a sequence of `[actionName, payload?]` pairs in order. |
| `render()` | `() => string` | Calls the artifact's `render` over the current state/props/derived. |
| `validate()` | `() => ValidationResult` | Calls the artifact's `validate`, or `{ valid: true, violations: [] }` if none is defined. |
| `[actionName]` | generated method | One per key in `artifact.actions` — each is `(payload?) => S`, delegating to `dispatch`. |
| `[derivedName]` | generated getter | One per key in `artifact.derived` — computes `artifact.derived[name](state, props)` on access. |

## Exported types

`ActionContext`, `ActionFn`, `ActionTrace`, `DOPComponent`, `EffectDescriptor`, `RenderView`, `ValidationResult` (re-exported from `./types.js`), plus `OOPInstance`/`OOPConstructor` declared locally.

See [dop-contract.md](./dop-contract.md) for what a valid `DOPComponent` artifact must provide.
