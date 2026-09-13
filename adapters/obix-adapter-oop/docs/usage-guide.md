# Usage Guide — `@obinexusltd/obix-adapter-oop`

## Install

```bash
npm install @obinexusltd/obix-adapter-oop
```

Zero runtime dependencies.

## When to reach for this adapter

Use `toOOP` when your integration (or the team maintaining it) is more comfortable with a class-based API — instances, methods, getters — than with a bare `{ state, actions, render }` artifact. Functionally it is equivalent to using the artifact directly, or to `obix-adapter-reactive`/`obix-adapter-func`; pick the projection that fits the surrounding code, not the one with "more features."

## Basic instance

```ts
import { toOOP } from "@obinexusltd/obix-adapter-oop";
import { createButton } from "@obinexusltd/obix-component-button";

const ButtonClass = toOOP(createButton({ label: "Save" }) as any);
const button = new ButtonClass();
button.click();          // generated method, delegates to dispatch("click")
button.render();
```

Any `DOPComponent`-shaped artifact works here — including the `obix-component-*` primitives, since TypeScript's structural typing means their `{ name, state, actions, render }` output already satisfies `DOPComponent`.

## Multiple independent instances

```ts
const CounterClass = toOOP(Counter);
const a = new CounterClass();
const b = new CounterClass({ state: { count: 10 } });
a.Inc();
b.Inc();
// a.state === { count: 1 }, b.state === { count: 11} — fully independent
```

## Replaying a recorded trace

```ts
const c = new CounterClass();
c.replay([["Inc"], ["Inc"], ["Reset"], ["Inc", 7]]);
c.state; // { count: 7 }
```

Useful for time-travel debugging, or for reconstructing state on the client from a trace recorded on the server (see `obix-adapter-ssr`'s `renderTrace`, which does the equivalent for the SSR projection).

## Derived values as getters

```ts
c.Inc(5);
c.label; // "count: 5" — computed on access via artifact.derived.label(state, props)
```

See [api-reference.md](./api-reference.md) for the full instance surface and [encapsulation.md](./encapsulation.md) for why `state`/`props` can't be assigned directly.
