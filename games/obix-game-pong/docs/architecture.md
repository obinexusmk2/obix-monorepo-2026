# Architecture — `@obinexusltd/obix-game-pong`

## Four modules, four concerns, one direction of dependency

```
mount.ts   (DOM, keyboard, rAF, Math.random — the ONLY impure module)
   │  calls
   ▼
actions.ts  (the DOPComponent's pure state transitions)
   │  calls
   ▼
physics.ts  (pure collision/movement primitives, no game rules)

render.ts   (pure state -> SVG string; depended on by mount.ts, not by actions.ts)
assets.ts   (asset filename manifest; depended on by render.ts and mount.ts)
```

- **`physics.ts`** knows nothing about scoring, serving, or game status. It
  exposes generic primitives — bounce a ball off a wall, test a circle/rect
  overlap, reflect a velocity off a paddle, integrate a position — that make
  sense outside of Pong entirely. Nothing here is Pong-specific.
- **`actions.ts`** is where Pong's actual rules live: what happens when the
  ball reaches a goal line, when a game ends, what a serve looks like. It
  composes `physics.ts`'s primitives but adds no DOM, timing, or randomness
  of its own — every action is `(state, ...args) => newState`, and every
  argument it needs (`dtSeconds`, `towards`, `angle`) is supplied by the
  caller.
- **`render.ts`** turns a `PongState` into an SVG string and a plain-text
  summary. It cannot corrupt state (it never receives a mutable reference
  it could write to) and produces the same string for the same state, so a
  render call is trivially cacheable, diffable, or snapshot-testable.
- **`mount.ts`** is the only file that imports `document`/`window`, calls
  `requestAnimationFrame`, reads `KeyboardEvent`s, or calls
  `Math.random()`. It owns exactly one thing: turning real-world,
  non-deterministic browser events into calls against the pure `actions.ts`
  API, then handing the result to `render.ts`.

This is the same discipline `@obinexusltd/obix-adapter-reactive` uses for
its effects scheduler (a `Clock` is injected rather than called directly)
and the same reasoning `@obinexusltd/obix-adapter-ssr` documents for why it
never imports its sibling adapters: keep the impure edge as thin and as
clearly marked as possible, so everything else stays a plain, testable
function.

## The DOP contract, applied to a game loop

```ts
interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, (state: S, ...args) => S>;
  render: (state: S) => string;
}
```

The same shape used by every `obix-component-*` primitive in this monorepo.
The novelty here isn't the contract — it's that a real-time game turns out
to fit it without modification: `step(state, dtSeconds)` is just another
action, no different in kind from `obix-component-button`'s `click(state)`.
The game loop in `mount.ts` is nothing more than "call `step` every frame
instead of once per user gesture."

## Why render returns an SVG string, not canvas draw calls

Every other primitive in this monorepo (`obix-component-button`,
`obix-component-modal`, …) renders to an HTML string that gets assigned via
`innerHTML`. Pong keeps that convention — `renderPong` returns an SVG
string assigned into a plain `<div>` — rather than introducing a second,
imperative rendering paradigm (a `CanvasRenderingContext2D` this package
would have to draw into) just for one component. The trade-off is a fresh
`innerHTML` write every animation frame instead of incremental canvas
draws; for a five-element scene (background, two paddles, a ball, two
score labels) at 60fps this is not a meaningful cost, and it keeps
`render` exactly as pure and string-testable as every sibling package's
`render`.
