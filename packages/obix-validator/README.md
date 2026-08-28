# @obinexusltd/obix-validator

**Validation + the independent reference evaluator (`referenceFold`).**

```bash
npm install @obinexusltd/obix-validator
```

## The oracle (Problem 1)

`referenceFold(artifact, initialState, props, trace)` folds the trace by calling

```js
current = artifact.actions[name](current, payload, props)
```

**directly**. It does not use `toData` / `toFunctional` / `toOOP` / `toReactive`,
and it does not use `obix-ir.applyAction` / `replayTrace`. This package does not
import any adapter. The duplication is deliberate: the code that judges the
adapters shares nothing with the code the adapters run, so a shared bug is
impossible.

`referenceFold` returns `{ finalState, history, renders, validations }` —
per-step snapshots so `obix-test` can compare every transition, plus render and
validation output computed straight from `artifact.render` / `artifact.validate`.

## Other exports

| Export | Role |
|---|---|
| `validateProps` / `validateState` / `validateRules` | descriptor-driven checks |
| `checkActionPropDeps(artifact)` | declared action prop-deps exist on props |
| `checkPipelineInvariant(artifact)` | DATA FIRST — no business logic past the IR |
| `validateArtifactShape` / `validateObixAST` | re-exported from `obix-spec` |

## Dependency role

`obix-spec` + `obix-ir` only. **Never** an adapter, **never** `obix-test`.
Consumed by `obix-compiler`, `obix-test` and `obix-cli`.

## Level 0 status

✅ Complete.
