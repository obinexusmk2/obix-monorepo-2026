# Usage Guide — `@obinexusltd/obix-adapter-reactive`

## Install

```bash
npm install @obinexusltd/obix-adapter-reactive
```

Zero runtime dependencies.

## When to reach for this adapter

Use `toReactive` when you need to **react** to state changes (re-render on every transition, drive a UI framework's update cycle, log a transition history) rather than just calling into state on demand. If you don't need `subscribe` or `effects`, `obix-adapter-oop` or the artifact's own `{ actions, render }` directly are simpler.

## Subscribing to changes

```ts
import { toReactive } from "@obinexusltd/obix-adapter-reactive";

const counter = toReactive(Counter)();
const unsubscribe = counter.subscribe((next, prev, meta) => {
  console.log(`${meta.action} changed:`, meta.changedKeys);
  document.querySelector("#slot")!.innerHTML = counter.render();
});

counter.dispatch("inc");
// logs: "inc changed: [ 'count' ]", then re-renders

unsubscribe(); // stop listening
```

## Declarative effects

An artifact can declare polling-style effects that fire on an interval while a predicate holds:

```ts
const Counter = {
  name: "Counter",
  state: { count: 0, running: true },
  actions: { inc: (ctx) => { ctx.state.count += 1; }, stop: (ctx) => { ctx.state.running = false; } },
  effects: {
    autotick: { everyMs: 1000, while: (s) => s.running && s.count < 10, dispatch: "inc" },
  },
};

const counter = toReactive(Counter)();
counter.startEffects();       // begins the interval using the real global setInterval
// ... later ...
counter.stopEffects();
```

`startEffects` is idempotent — calling it twice without `stopEffects` in between does nothing on the second call.

## Injecting a fake clock (for tests or virtual time)

```ts
const clock = { setInterval: (fn) => { fn(); return 1; }, clearInterval: () => {} };
counter.startEffects(clock);
```

See [effects.md](./effects.md) for how the effects scheduler actually decides when to stop, and [dop-contract.md](./dop-contract.md) for `EffectDescriptor`'s shape.
