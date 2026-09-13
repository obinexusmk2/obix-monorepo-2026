/**
 * The Pong DOPComponent's actions — pure `(state, ...args) => newState`,
 * built entirely on top of ./physics.ts. Nothing here touches the DOM,
 * `Math.random()`, `Date.now()`, or a timer: every input this layer needs
 * (elapsed time, serve angle) is passed in by the caller (see mount.ts),
 * exactly the way obix-adapter-reactive's effects take an injected `Clock`
 * instead of calling setInterval directly. That's what keeps `step` and
 * `serve` deterministic and unit-testable without a browser.
 */
import {
  bounceOffWalls,
  clamp,
  integrateBall,
  movePaddleWithin,
  resolvePaddleHit,
  speedOf,
  ballOverlapsPaddle,
  whoConceded,
} from "./physics.js";
import type { PongState, Side } from "./types.js";

/** Move a paddle by `delta` pixels (negative = up, positive = down). No-op when paused/over. */
export function movePaddle(state: PongState, side: Side, delta: number): PongState {
  if (state.status === "gameOver") return state;
  const paddle = state[side];
  const moved = movePaddleWithin(paddle, delta, state.height);
  return moved === paddle ? state : { ...state, [side]: moved };
}

/**
 * Advance the ball by `dtSeconds`. A no-op unless `status === "playing"`.
 * Handles wall bounces, paddle hits (with speed ramp + angle steering), and
 * scoring — including the game-over transition at `winningScore`.
 */
export function step(state: PongState, dtSeconds: number): PongState {
  if (state.status !== "playing" || dtSeconds <= 0) return state;

  let ball = integrateBall(state.ball, dtSeconds);
  ball = bounceOffWalls(ball, state.height);

  let rally = state.rally;
  if (ball.vx < 0 && ballOverlapsPaddle(ball, state.left)) {
    const speed = Math.min(speedOf(ball) * state.ballSpeedIncrement, state.maxBallSpeed);
    ball = resolvePaddleHit(ball, state.left, "left", speed).ball;
    rally += 1;
  } else if (ball.vx > 0 && ballOverlapsPaddle(ball, state.right)) {
    const speed = Math.min(speedOf(ball) * state.ballSpeedIncrement, state.maxBallSpeed);
    ball = resolvePaddleHit(ball, state.right, "right", speed).ball;
    rally += 1;
  }

  const conceded = whoConceded(ball, state.width);
  if (!conceded) {
    return ball === state.ball && rally === state.rally ? state : { ...state, ball, rally };
  }

  const scorer: Side = conceded === "left" ? "right" : "left";
  const nextState: PongState = {
    ...state,
    [scorer]: { ...state[scorer], score: state[scorer].score + 1 },
    rally: 0,
  };
  if (nextState[scorer].score >= state.winningScore) {
    return { ...nextState, ball: centerBall(state), status: "gameOver", winner: scorer };
  }
  return { ...nextState, ball: centerBall(state), status: "serving", winner: null };
}

/**
 * Serve the ball from center. `towards` is the side the ball initially
 * travels at; `angle` (radians, clamped to ±60°) steers it off the
 * horizontal. Both are supplied by the caller so this stays pure — see the
 * module doc comment above.
 */
export function serve(state: PongState, towards: Side, angle = 0): PongState {
  if (state.status === "gameOver") return state;
  const a = clamp(angle, -Math.PI / 3, Math.PI / 3);
  const speed = Math.min(state.initialBallSpeed, state.maxBallSpeed);
  const direction = towards === "right" ? 1 : -1;
  return {
    ...state,
    status: "playing",
    ball: {
      ...centerBall(state),
      vx: direction * speed * Math.cos(a),
      vy: speed * Math.sin(a),
    },
  };
}

export function pause(state: PongState): PongState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

export function resume(state: PongState): PongState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}

/** New game: scores to zero, ball centered and idle, status back to "serving". */
export function reset(state: PongState): PongState {
  return {
    ...state,
    left: { ...state.left, score: 0 },
    right: { ...state.right, score: 0 },
    ball: centerBall(state),
    status: "serving",
    winner: null,
    rally: 0,
  };
}

function centerBall(state: PongState) {
  return { ...state.ball, x: state.width / 2, y: state.height / 2, vx: 0, vy: 0 };
}
