# The DOP Contract — `@obinexusltd/obix-adapter-oop`

Every `@obinexusltd/obix-adapter-*` package vendors a **byte-identical** copy of the same two files: `types.ts` (the `DOPComponent` shape) and `dop.ts` (the `reduce`/`replay`/`view`/`renderHtml`/`validate`/`changedKeys` functions). This is deliberate duplication, not drift — see [architecture.md](./architecture.md) for why.

## `DOPComponent<S, P>`

```ts
interface DOPComponent<S extends object = Record<string, unknown>, P extends object = Record<string, unknown>> {
  name: string;
  state: S;
  props?: P;
  actions: Record<string, ActionFn<S, P>>;
  derived?: Record<string, (state: S, props: P) => unknown>;
  effects?: Record<string, EffectDescriptor<S, P>>;
  render?: (view: RenderView<S, P>) => string;
  validate?: (state: S, props: P) => ValidationResult;
}
```

## `ActionFn<S, P>` — mutate the draft, not the original

```ts
type ActionFn<S, P> = (ctx: ActionContext<S, P>, payload?: unknown) => void;
```

Unlike the `obix-component-*` primitives (whose actions are `(state) => newState`, pure and returning a new object), a `DOPComponent` action here receives a **mutable draft** via `ctx.state` and mutates it directly (`ctx.state.count += by`). The vendored `reduce()` function is what makes this safe: it clones the incoming state with `structuredClone` *before* calling the action, so the original `state` object passed into `reduce` is never touched — only the throwaway clone is mutated. From the outside (via `dispatch`), the overall effect is still "immutable in, new object out."

## `reduce(component, state, actionName, payload?, props?): S`

1. Looks up `component.actions[actionName]`; throws if it doesn't exist.
2. Clones `state` (`structuredClone`, falling back to `JSON` round-trip).
3. Builds an `ActionContext` — `{ state: draft, props }` — plus one callable entry per action name, so an action can invoke a sibling action (`ctx.otherAction(payload)`) without a separate dispatcher.
4. Runs the action against the draft, returns the draft.

## `replay(component, trace, from?, props?): S`

Folds an `ActionTrace` (`ReadonlyArray<[string, unknown?]>`) through `reduce`, left to right, starting from `from` (or `component.state`).

## `view`, `renderHtml`, `validate`, `changedKeys`

- `view` — flattens `state` + `props` + computed `derived` into one object for templates (spread order: `props`, then `state`, then `derived`, so `derived` wins on key collisions).
- `renderHtml` — calls `component.render(view(...))`, or `""` if no `render` is defined.
- `validate` — calls `component.validate(state, props)`, or `{ valid: true, violations: [] }` if none is defined.
- `changedKeys` — a shallow diff between two states, used by `obix-adapter-reactive`'s subscriber notifications.
