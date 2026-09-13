/**
 * @obinexusltd/obix-game-pong — types.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Side = "left" | "right";
export type GameStatus = "serving" | "playing" | "paused" | "gameOver";

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface PaddleState {
  /** Top edge, in court pixels. */
  y: number;
  height: number;
  width: number;
  /** Fixed horizontal position — paddles never move on x. */
  x: number;
  score: number;
}

export interface PongConfig {
  width?: number;
  height?: number;
  paddleWidth?: number;
  paddleHeight?: number;
  /** px/second the paddle moves under a full movePaddle delta. */
  paddleSpeed?: number;
  ballRadius?: number;
  /** Initial px/second speed magnitude at serve. */
  ballSpeed?: number;
  /** Multiplier applied to ball speed on every paddle hit. */
  ballSpeedIncrement?: number;
  maxBallSpeed?: number;
  winningScore?: number;
}

export interface PongState {
  width: number;
  height: number;
  paddleSpeed: number;
  /** Speed a freshly-served ball starts at — every subsequent hit scales up from here. */
  initialBallSpeed: number;
  ballSpeedIncrement: number;
  maxBallSpeed: number;
  winningScore: number;
  left: PaddleState;
  right: PaddleState;
  ball: BallState;
  status: GameStatus;
  winner: Side | null;
  /** Consecutive paddle hits since the last serve — resets to 0 on score. */
  rally: number;
}

export type Action<S> = (state: S, ...args: any[]) => S;

/** The Data-Oriented component contract (state + actions + deterministic render). */
export interface DOPComponent<S> {
  name: string;
  state: S;
  actions: Record<string, Action<S>>;
  render: (state: S) => string;
}
