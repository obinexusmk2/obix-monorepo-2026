# @obinexusltd/obix-adapter-oop

**The OOP projection — a generated class.** `state` is read-only from outside,
`props` is frozen, and each action becomes a method that delegates to `dispatch`.

```bash
npm install @obinexusltd/obix-adapter-oop
```

> **Zero dependencies.** The shared reducer lives in `src/dop.ts`, byte-identical
> across the whole `@obinexusltd/obix-adapter-*` family.

## The DOP artifact

The plain object every `@obinexusltd/obix-adapter-*` package consumes
(see `obix/docs/obix-docs/GETTING-STARTED.md` §1):

```ts
interface DOPComponent<S, P = {}> {
  name: string;
  state: S;
  actions: Record<string, (ctx, payload?) => void>;   // mutate ctx.state
  derived?: Record<string, (state, props) => unknown>;
  render?: (view: { state; props; derived }) => string;
  validate?: (state, props) => { valid: boolean; violations: string[] };
}
```

## API

```ts
import { toOOP } from "@obinexusltd/obix-adapter-oop";

const Counter = toOOP(CounterArtifact);
const c = new Counter({ props: { max: 10 } });

c.Inc();            // generated from actions.Inc — delegates to c.dispatch("Inc")
c.Inc(2);
c.state;            // { count: 3 }   (read-only — assigning throws)
c.label;            // "count: 3"     (generated from derived.label)
c.render();          // '<button aria-label="count: 3">3</button>'
c.replay([["Inc"], ["Reset"]]);
c.validate();        // { valid: true, violations: [] }
```

| Member | Notes |
|---|---|
| `new C({ state?, props? })` | `props` merged over `artifact.props`, then frozen |
| `c.state` | getter only — the setter throws `TypeError` |
| `c.dispatch(action, payload?)` | runs the shared reducer, returns new state |
| `c.<ActionName>(payload?)` | generated per `artifact.actions` — delegates to `dispatch` |
| `c.<derivedName>` | generated getter per `artifact.derived` |
| `c.replay(trace)` · `c.render()` · `c.validate()` | |

## Compliance

`@obinexusltd/obix-adapter-ssr` is the reference: for any trace, `c.render()`
returns the **identical** HTML string that `data`, `func`, `reactive` and `ssr`
produce. `@obinexusltd/obix` ships `checkCompliance()` to assert it.
See `OBIX_JSX_ADAPTER_ARCHITECTURE.md` — "Paradigm Agnostic".
