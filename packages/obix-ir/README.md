# @obinexusltd/obix-ir

**Canonical DOP artifact construction + the shared adapter execution primitive.**

```bash
npm install @obinexusltd/obix-ir
```

## Purpose

`obix-ir` sits directly **below the adapters**. It owns:

| Export | Role |
|---|---|
| `createDOP(def)` | build the frozen canonical `DOPArtifact` (deep-freezes state + props, computes `meta.actionDecls` / `meta.derivedDeps`) |
| `applyAction(artifact, state, name, payload, props)` | **the one primitive every adapter uses** to run a transition — always `actions[name](state, payload, props)` |
| `replayTrace(artifact, trace, from?, props?)` | convenience fold — *not* the equivalence oracle |
| `calculateChangedKeys(prev, next)` | `Object.is` diff of two state snapshots |
| `assertClosedStateShape(state, shape)` | enforce closed state shape |
| `describeTransition` / `validateTransition` | `TransitionMeta` + structural transition check |
| `deepFreeze` / `freezeState` / `freezeProps` | structural freeze helpers |

## Why `applyAction` matters (Problem 8)

Adapters must not each re-implement argument threading. They all call
`applyAction`, so `Action(state, payload, props)` is invoked identically in every
projection. `applyAction` is independently unit-tested here.

## Why `replayTrace` is *not* the oracle (Problem 1)

`replayTrace` is a normal fold built on `applyAction`. The equivalence oracle
(`obix-validator.referenceFold`) is a **separate, deliberately duplicated**
implementation that never imports this package — so a bug here cannot hide by
also being in the thing that checks it.

## Dependency role

Depends only on `@obinexusltd/obix-spec`. Imported by every adapter, the
validator, the compiler, the test harness and the Timer fixture.

## Level 0 status

✅ Complete.
