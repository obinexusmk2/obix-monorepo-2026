/**
 * Pure Pong physics — no DOM, no randomness, no state mutation.
 *
 * Every function here is `(...) => newValue`; nothing is ever assigned back
 * into an argument. This is the layer the test suite exercises directly, and
 * the only layer `step()` (in actions.ts) depends on.
 */
import type { BallState, PaddleState, Side } from "./types.js";

/** Reflect the ball off the top/bottom walls, clamping so it never tunnels past. */
export function bounceOffWalls(ball: BallState, height: number): BallState {
  if (ball.y - ball.radius < 0) {
    return { ...ball, y: ball.radius, vy: Math.abs(ball.vy) };
  }
  if (ball.y + ball.radius > height) {
    return { ...ball, y: height - ball.radius, vy: -Math.abs(ball.vy) };
  }
  return ball;
}

/** Axis-aligned circle/rect overlap test. */
export function ballOverlapsPaddle(ball: BallState, paddle: PaddleState): boolean {
  const closestX = clamp(ball.x, paddle.x, paddle.x + paddle.width);
  const closestY = clamp(ball.y, paddle.y, paddle.y + paddle.height);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  return dx * dx + dy * dy <= ball.radius * ball.radius;
}

export interface PaddleHit {
  ball: BallState;
  /** -1 (top of paddle) .. 1 (bottom of paddle) — how far off-center the hit was. */
  offset: number;
}

/**
 * Resolve a ball/paddle collision: reflect x-velocity away from the paddle,
 * steer y-velocity by where on the paddle it hit (classic "paddle english"),
 * and reposition the ball flush against the paddle face so it can't tunnel
 * through on the next step at high speed.
 */
export function resolvePaddleHit(
  ball: BallState,
  paddle: PaddleState,
  side: Side,
  speed: number,
  maxBounceAngle = (5 * Math.PI) / 12, // 75 degrees
): PaddleHit {
  const center = paddle.y + paddle.height / 2;
  const offset = clamp((ball.y - center) / (paddle.height / 2), -1, 1);
  const angle = offset * maxBounceAngle;
  const direction = side === "left" ? 1 : -1;
  const x = side === "left" ? paddle.x + paddle.width + ball.radius : paddle.x - ball.radius;
  return {
    ball: {
      ...ball,
      x,
      vx: direction * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
    },
    offset,
  };
}

/** Which side conceded, given the ball has crossed a goal line — or null mid-court. */
export function whoConceded(ball: BallState, width: number): Side | null {
  if (ball.x - ball.radius < 0) return "left";
  if (ball.x + ball.radius > width) return "right";
  return null;
}

/** Move a paddle by `delta` pixels, clamped to stay fully inside the court. */
export function movePaddleWithin(paddle: PaddleState, delta: number, height: number): PaddleState {
  const y = clamp(paddle.y + delta, 0, height - paddle.height);
  return y === paddle.y ? paddle : { ...paddle, y };
}

/** Ball position advanced by one time step, no collision handling. */
export function integrateBall(ball: BallState, dtSeconds: number): BallState {
  return { ...ball, x: ball.x + ball.vx * dtSeconds, y: ball.y + ball.vy * dtSeconds };
}

export function speedOf(ball: BallState): number {
  return Math.hypot(ball.vx, ball.vy);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
