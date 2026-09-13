# Physics — `@obinexusltd/obix-game-pong`

The whole simulation is five pure functions in `src/physics.ts`, composed by
`step()` in `src/actions.ts`. Nothing here uses `Math.random`, the DOM, or
mutates an argument.

## The per-frame pipeline (`step`)

```
integrateBall  ->  bounceOffWalls  ->  paddle collision?  ->  whoConceded?
```

1. **`integrateBall(ball, dtSeconds)`** — moves the ball by `velocity × dt`.
   Straight Euler integration; there's no sub-stepping, which is why very
   large `dt` values (a backgrounded tab resuming) are clamped by the
   caller (`mount.ts` clamps to 50ms) rather than inside physics itself —
   physics stays a pure function of whatever `dt` it's given.

2. **`bounceOffWalls(ball, height)`** — if the integrated position would
   put the ball past the top or bottom edge, the position is clamped back
   to the edge (`radius` in from it) and `vy`'s sign is flipped. This
   happens *after* integration, on the already-moved ball, not before —
   otherwise a fast-moving ball could still tunnel past the wall in the
   same frame it bounces.

3. **Paddle collision** — `step` only tests the paddle the ball is moving
   toward (`vx < 0` → left, `vx > 0` → right), via
   **`ballOverlapsPaddle(ball, paddle)`**, an axis-aligned circle/rect
   overlap test (closest-point-on-rect, compared against `radius²`). On a
   hit, **`resolvePaddleHit(ball, paddle, side, speed)`**:
   - computes `offset` = how far off the paddle's vertical center the
     ball struck, normalized to `[-1, 1]`;
   - maps that to a bounce angle up to ±75° (`maxBounceAngle`) — a hit
     dead-center goes straight across, a hit near either edge sends the
     ball off at a steep angle ("paddle english" / "steering"), the
     classic arcade-Pong skill mechanic;
   - repositions the ball flush against the paddle's outer face, so it
     can never end up embedded inside the paddle on the next frame;
   - the caller (`step`) computes the new `speed` as
     `min(currentSpeed × ballSpeedIncrement, maxBallSpeed)` — the ball
     gets faster with every rally, capped so it never becomes literally
     unplayable.

4. **`whoConceded(ball, width)`** — after walls and paddles are resolved,
   if the ball's edge has crossed `x = 0` or `x = width`, that side
   conceded the point. `step` awards the point to the other side, resets
   `rally` to `0`, and either ends the game (`winningScore` reached) or
   re-centers the ball and returns to `"serving"`.

## Paddle movement

**`movePaddleWithin(paddle, delta, height)`** just clamps
`paddle.y + delta` to `[0, height - paddle.height]` — paddles cannot be
pushed off either edge of the court, and moving into a wall is silently
absorbed rather than erroring.

## Determinism

Every function above is a pure mapping from its arguments to a new value.
`step(state, dt)` called twice with the same `state` and `dt` produces two
deep-equal results (see `test/pong.test.mjs`, "step is deterministic") —
the same guarantee `@obinexusltd/obix-adapter-ssr`'s `compliance()` checker
relies on for its five projections to agree with each other.
