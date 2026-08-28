# @obinexusltd/obix-effects

**State-machine-agnostic scheduler primitives for OBIX effects.**

```bash
npm install @obinexusltd/obix-effects
```

## Purpose

| Export | Level 0 |
|---|---|
| `createScheduler(clock?)` | ✅ |
| `scheduler.every(name, ms, whileFn, onTick)` | ✅ operational |
| `scheduler.after(...)` / `scheduler.on(...)` | ❌ throw `UnsupportedFeatureError` (Level 1) |
| `createVirtualClock()` | ✅ deterministic time for tests |
| `evaluateWhile(expr, state, props)` | ✅ single identifier / negation |

## Problem 9 — effect quiescence

The scheduler does **not** know Model A / Model B semantics. It re-evaluates the
declared `while(state, props)` predicate after each tick and clears its interval
when the predicate is false. Component actions decide when that happens. There is
no `quiesces` language feature. Timer's `while: ({ running }) => running`
quiesces by itself once an action sets `running: false`.

## Dependency role

Depends only on `@obinexusltd/obix-spec` (types). It is **not** a dependency of
the reactive adapter's *code path* for pure transitions — only its effects
lifecycle uses it. `obix-effects` never imports any adapter.

## Level 0 status

✅ `every` + virtual clock. `after` / `on` are typed but throw.
