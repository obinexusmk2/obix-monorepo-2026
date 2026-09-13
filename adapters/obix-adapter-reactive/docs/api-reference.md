# API Reference — `@obinexusltd/obix-adapter-reactive`

## `toReactive<S, P>(artifact: DOPComponent<S, P>): ReactiveFactory<S, P>`

Returns a factory function; calling it builds one independent reactive instance.

```ts
import { toReactive } from "@obinexusltd/obix-adapter-reactive";

const Counter = {
  name: "Counter",
  state: { count: 0, running: true },
  actions: {
    inc: (ctx, by = 1) => { ctx.state.count += by; },
    stop: (ctx) => { ctx.state.running = false; },
  },
  effects: { autotick: { everyMs: 10, while: (s) => s.running && s.count < 3, dispatch: "inc" } },
};

const counter = toReactive(Counter)();
counter.subscribe((next, prev, meta) => console.log(meta.changedKeys));
counter.dispatch("inc");
```

## `ReactiveInstance<S, P>`

| Member | Type | Notes |
|---|---|---|
| `state` | `S` (readonly getter) | Current state. |
| `props` | `P` (readonly getter) | Frozen, merged from `artifact.props` + constructor `opts.props`. |
| `transitions` | `number` (readonly getter) | Count of `dispatch` calls so far. |
| `activeEffects` | `number` (readonly getter) | Count of currently-scheduled effect intervals. |
| `dispatch(actionName, payload?)` | `(string, unknown?) => S` | Runs the action, notifies subscribers, returns the new state. |
| `replay(trace)` | `(ActionTrace) => S` | Dispatches a sequence of `[actionName, payload?]` pairs. |
| `subscribe(fn)` | `(Subscriber<S>) => () => void` | Registers a listener; returns an unsubscribe function. |
| `render()` | `() => string` | Renders the current state. |
| `validate()` | `() => ValidationResult` | Validates the current state. |
| `startEffects(clock?)` | `(Clock?) => void` | Starts every declared effect on the given (or default) clock. No-op if already started. |
| `stopEffects()` | `() => void` | Clears every scheduled interval. |

## `Subscriber<S>`

```ts
type Subscriber<S> = (next: S, prev: S, meta: TransitionMeta<S>) => void;
interface TransitionMeta<S> { action: string; payload?: unknown; from: S; to: S; changedKeys: string[]; }
```

## `Clock` / `defaultClock`

```ts
interface Clock { setInterval(fn: () => void, ms: number): unknown; clearInterval(handle: unknown): void; }
export const defaultClock: Clock; // wraps the global setInterval/clearInterval
```

Injectable so tests (and non-browser/non-Node timing sources) can supply their own — see [testing.md](./testing.md).

## Exported types

`ActionContext`, `ActionFn`, `ActionTrace`, `DOPComponent`, `EffectDescriptor`, `RenderView`, `ValidationResult` (re-exported), plus `TransitionMeta`, `Subscriber`, `Clock`, `ReactiveInstance`, `ReactiveFactory` declared locally.

See [dop-contract.md](./dop-contract.md) for the underlying `DOPComponent`/`EffectDescriptor` shapes.
