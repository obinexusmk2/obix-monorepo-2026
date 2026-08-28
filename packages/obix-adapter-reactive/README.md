# @obinexusltd/obix-adapter-reactive

**The Reactive projection — subscribers, `changedKeys`, effects lifecycle.**

```bash
npm install @obinexusltd/obix-adapter-reactive
```

## API

```ts
const create = toReactive(artifact);
const r = create({ props: { limitSeconds: 5 } });
const off = r.subscribe((next, prev, meta) => { meta.changedKeys; });
r.dispatch("Start");
r.startEffects(clock);   // scheduler re-checks while(state,props) after each tick
r.stopEffects();
r.state; r.transitions; r.render(); r.validate();
```

Transitions go through `obix-ir.applyAction`. `dispatch` no-ops (returns the same
reference, no `transitions++`, no subscriber calls) when an action returns its
input — matching identity semantics like `Start` at the Timer's terminal state.

## Dependency role

`obix-spec` + `obix-ir` + `obix-effects`. **Not** a dependency of `obix-effects`
(that would be a cycle). Consumed by `obix-test`, `obix-adapter-native`,
`obix-timer`.

## Level 0 status

✅ State, props, subscribers, `changedKeys`, `every` effects via the injected
clock. Deferred: `after` / `on` effects.
