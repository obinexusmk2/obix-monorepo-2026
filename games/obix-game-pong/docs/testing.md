# Testing — `@obinexusltd/obix-game-pong`

## Running the tests

```bash
npm test                # from this package directory
npm run test:games      # from the monorepo root
```

Runs `node --test "test/*.test.mjs"` against the built `dist/` — run
`npm run build` first after editing `src/`.

## Why this game's logic is 100% unit-testable

Because `physics.ts` and `actions.ts` never touch the DOM, a timer, or
`Math.random()` (see [architecture.md](./architecture.md)), every rule in
the game — wall bounces, paddle steering, speed ramp-up, scoring, win
conditions — is testable with plain object literals and `node:assert`, no
browser, no fake timers, no mocking. `mount.ts` is the only untested module
here, precisely because it's the only one that isn't pure; it's kept
deliberately thin so there's as little untested surface as possible (see
the demo in `examples/` for manual/visual verification of that layer).

## What `test/pong.test.mjs` covers

- **Initial state** — `createPong()` produces a centered, zero-score,
  `"serving"` state; config overrides apply correctly.
- **`movePaddle`** — clamps to the court, doesn't mutate its input, is a
  no-op once the game is over.
- **`step`** — a no-op unless `status === "playing"`; wall bounces flip
  `vy` and clamp position; a paddle hit reflects `vx`, steers `vy` by
  strike offset, ramps speed by `ballSpeedIncrement`, and increments
  `rally`; missing a paddle scores the other side, resets `rally`, and
  either re-serves or ends the game at `winningScore`; **is deterministic**
  — the same `(state, dt)` always produces a deep-equal result.
- **`serve`** — aims the ball at the requested side; clamps the angle to
  ±60°.
- **`pause`/`resume`** — only transition from the expected status.
- **`reset`** — zeroes scores, re-centers the ball, clears the winner.
- **Physics primitives directly** — `bounceOffWalls`, `ballOverlapsPaddle`,
  `resolvePaddleHit` (including the exact steering angle at the paddle's
  edge), `whoConceded`, `movePaddleWithin`, `clamp`.
- **`renderPong`** — deterministic output for a given state; score digits
  and the status overlay appear correctly; no overlay while `"playing"`.
- **`describePong`** — one correct summary line per status.

## Adding a test

Prefer testing through `physics.ts`/`actions.ts` directly — that's where
the actual rules live:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPong, step } from "../dist/index.js";

test("a very fast ball still stops exactly at the wall, never past it", () => {
  const { state } = createPong({ height: 300 });
  const s = { ...state, status: "playing", ball: { ...state.ball, y: 5, vy: -10_000, vx: 0 } };
  const after = step(s, 0.1);
  assert.equal(after.ball.y, after.ball.radius);
});
```

If you add browser-only behavior to `mount.ts`, verify it manually via
`examples/index.html` (see the README) rather than reaching for a DOM
mocking library — this package's zero-dependency policy extends to
devDependencies used for testing.
