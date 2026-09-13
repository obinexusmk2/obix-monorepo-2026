/**
 * @obinexusltd/obix-game-pong
 *
 * A neon Pong built as a Data-Oriented component: `createPong(config)`
 * returns `{ name, state, actions, render }`. Actions are pure
 * `(state, ...args) => newState`; `render(state)` is a deterministic SVG
 * string. Zero dependencies — see docs/architecture.md for how the game
 * loop, physics, rendering and DOM wiring are kept in separate modules.
 */
import { serve as serveAction, movePaddle, pause, resume, reset, step } from "./actions.js";
import { PONG_ASSETS } from "./assets.js";
import { renderPong } from "./render.js";
import type { DOPComponent, PongConfig, PongState } from "./types.js";

export type {
  Action,
  BallState,
  DOPComponent,
  GameStatus,
  PaddleState,
  PongConfig,
  PongState,
  Side,
} from "./types.js";
export {
  bounceOffWalls,
  ballOverlapsPaddle,
  clamp,
  integrateBall,
  movePaddleWithin,
  resolvePaddleHit,
  speedOf,
  whoConceded,
} from "./physics.js";
export { movePaddle, step, pause, resume, reset } from "./actions.js";
export { serve } from "./actions.js";
export { renderPong, describePong } from "./render.js";
export {
  PONG_ASSETS,
  PONG_ASSET_FILES,
  PONG_ASSET_CREDIT,
  PONG_FONT,
  resolveAssets,
  type PongAssets,
} from "./assets.js";
export { mountPong, type PongController, type MountOptions } from "./mount.js";

const PADDLE_MARGIN = 24;

const DEFAULTS: Required<PongConfig> = {
  width: 800,
  height: 450,
  paddleWidth: 16,
  paddleHeight: 90,
  paddleSpeed: 480,
  ballRadius: 10,
  ballSpeed: 320,
  ballSpeedIncrement: 1.08,
  maxBallSpeed: 900,
  winningScore: 11,
};

export function createPong(config: PongConfig = {}): DOPComponent<PongState> {
  const cfg: Required<PongConfig> = { ...DEFAULTS, ...config };
  const state: PongState = {
    width: cfg.width,
    height: cfg.height,
    paddleSpeed: cfg.paddleSpeed,
    initialBallSpeed: cfg.ballSpeed,
    ballSpeedIncrement: cfg.ballSpeedIncrement,
    maxBallSpeed: cfg.maxBallSpeed,
    winningScore: cfg.winningScore,
    left: {
      x: PADDLE_MARGIN,
      y: (cfg.height - cfg.paddleHeight) / 2,
      width: cfg.paddleWidth,
      height: cfg.paddleHeight,
      score: 0,
    },
    right: {
      x: cfg.width - PADDLE_MARGIN - cfg.paddleWidth,
      y: (cfg.height - cfg.paddleHeight) / 2,
      width: cfg.paddleWidth,
      height: cfg.paddleHeight,
      score: 0,
    },
    ball: { x: cfg.width / 2, y: cfg.height / 2, vx: 0, vy: 0, radius: cfg.ballRadius },
    status: "serving",
    winner: null,
    rally: 0,
  };

  return {
    name: "ObixPong",
    state,
    actions: { movePaddle, step, serve: serveAction, pause, resume, reset },
    render: (s: PongState) => renderPong(s, PONG_ASSETS),
  };
}
