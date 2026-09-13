# Effects — `@obinexusltd/obix-adapter-reactive`

## The scheduling loop

```ts
startEffects(nextClock: Clock = defaultClock) {
  if (clock) return;               // idempotent — already running
  clock = nextClock;
  for (const desc of Object.values(artifact.effects ?? {})) {
    const handle = clock.setInterval(() => {
      if (desc.while(current, props)) dispatch(desc.dispatch);
    }, desc.everyMs);
    handles.push(handle);
  }
}
```

For every declared effect, `startEffects` schedules one interval at `desc.everyMs`. On each tick, it checks `desc.while(current, props)` — reading the **live** `current` state (via closure), not a snapshot taken when the effect started — and only dispatches if the predicate still holds. This means an effect naturally stops firing useful dispatches once its own predicate becomes false (e.g. `count < 3`), without anyone having to call `stopEffects()` for the effect to become inert — though the interval itself keeps running (and re-checking the predicate) until `stopEffects()` is called.

## Effects never own logic

`desc.dispatch` is a plain action name — the scheduler does not run arbitrary code, only `dispatch(name)` with no payload. If an effect needs a payload, express it inside the action itself (reading from `state`/`props`) rather than trying to pass one through the effect descriptor, since `EffectDescriptor` intentionally has no `payload` field.

## Stopping

```ts
stopEffects() {
  for (const handle of handles.splice(0)) clock?.clearInterval(handle);
  clock = undefined;
}
```

Every handle collected by `startEffects` is cleared, the handle list is emptied, and `clock` is reset to `undefined` — this is what makes a second `startEffects()` call after a `stopEffects()` actually restart the effects (recall `startEffects` bails out early only when `clock` is already set).

## Injecting a deterministic clock

Because `Clock` is just `{ setInterval, clearInterval }`, tests (see [testing.md](./testing.md)) can substitute a fake clock that runs callbacks synchronously and immediately, turning what would be a real-time, flaky test into a deterministic one — call the captured task function directly instead of waiting on `setTimeout`/`setInterval` in real time.
