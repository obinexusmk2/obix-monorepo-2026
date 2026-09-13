# Encapsulation — `@obinexusltd/obix-adapter-oop`

## Private fields, read-only accessors

```ts
class Component {
  #state: S;
  #props: P;
  get state(): S { return this.#state; }
  set state(_next: S) { throw new TypeError(`[obix] ${artifact.name}.state is read-only`); }
  get props(): P { return this.#props; }
}
```

`#state`/`#props` are true JavaScript private fields (`#`-prefixed) — they are not accessible from outside the class at all, not even via `Object.getOwnPropertyNames` or bracket access. The `state` getter exposes a read view; the `state` **setter** exists purely to throw a clear `TypeError` rather than silently failing (assigning to a getter-only property without a setter would otherwise fail silently in non-strict mode, or throw a generic error in strict mode with no explanation of why).

```ts
const c = new CounterClass();
c.state = { count: 99 }; // throws: "[obix] Counter.state is read-only"
```

## Why state can't be set directly

The only sanctioned way to change state is through `dispatch` (or a generated action method, or `replay`), all of which route through the vendored `reduce()` — see [dop-contract.md](./dop-contract.md). Allowing direct assignment would let a consumer bypass the reducer entirely, breaking the guarantee that every state transition in the application is an auditable, named action. This is the same invariant `obix-adapter-ssr`'s `compliance()` checker relies on: if state could be set arbitrarily, "replay this trace and compare to the reference" would no longer mean anything.

## `props` is frozen, not just getter-guarded

```ts
this.#props = Object.freeze({ ...(artifact.props ?? {}), ...(opts.props ?? {}) }) as P;
```

Unlike `state` (protected by the missing setter), `props` is additionally `Object.freeze`d — since `props` is a plain object handed out by the `props` getter, freezing it prevents `instance.props.someField = x` from silently mutating it in place even though `instance.props = {...}` (reassigning the whole reference) would already be impossible (there's no setter for `props` at all, only a getter).

## What this buys you

An `OOPInstance` can be handed to arbitrary consumer code with the same safety guarantees as an immutable value object — the caller can read `state`/`props` freely and call the documented methods, but cannot corrupt the instance's internal state through any property assignment.
